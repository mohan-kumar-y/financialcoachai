/**
 * Investment Brain (HLD §3, §21 / LLD §4).
 *
 * The bounded agentic reasoning loop:
 *   UNDERSTAND -> PLAN -> INVESTIGATE (Capability Gateway only)
 *   -> OBSERVE EVIDENCE -> DECIDE -> (hand off to Decision Validator)
 *
 * The Brain never imports an Engine directly and never talks to the user.
 * It returns a DraftDecision; nothing downstream may use it unvalidated.
 */
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, WEALTH_MODEL } from "@/lib/ai-gateway.server";
import {
  BRAIN_VERSION,
  PROMPT_VERSION,
  type DraftDecision,
  type Evidence,
  type CapabilityId,
  type TriggerType,
} from "@/server/contracts";
import {
  createRunState,
  invoke,
  PHASE1_GATEWAY_CONFIG,
  type CapabilityGatewayConfig,
  type GatewayContext,
  type GatewayRunState,
} from "@/server/gateway/capability-gateway";
import type { Signal } from "@/server/signals/signal-types";
import {
  aggregate,
  type AggregationResult,
  type StrategyPack,
} from "@/server/aggregation/signal-aggregation";
import { calibrate } from "@/server/calibration/confidence-calibration";
import { computeProbability, type ProbabilityResult } from "@/server/probability/market-probability";
import { getCurrentRegime, type MarketRegime } from "@/server/regime/market-regime";
import { getStrategyOrFallback, type StrategyId } from "@/server/strategy/strategy-registry";
import type { Freshness } from "@/server/freshness/freshness-gate";

/**
 * Deterministic strategy inference. This is a judgment call, kept as a plain
 * keyword heuristic on purpose: it must be reproducible and auditable, so no
 * LLM decides which strategy pack governs a run. Order matters — the more
 * specific instrument classes are matched before the generic LONG_TERM default.
 */
export function inferStrategyId(request: string, triggerType: TriggerType): StrategyId {
  const r = request.toLowerCase();
  if (/\bsip\b/.test(r)) return "SIP";
  if (/\bipo\b/.test(r)) return "IPO";
  if (/\bintraday\b|\btoday\b/.test(r)) return "INTRADAY";
  if (/\bswing\b|short[- ]term/.test(r)) return "SWING";
  if (/\betf\b/.test(r)) return "ETF";
  if (/mutual fund|\bfund\b/.test(r)) return "MUTUAL_FUND";
  if (/portfolio|review|rebalance/.test(r)) return "PORTFOLIO_REVIEW";
  // A scheduled run with no explicit request is a portfolio review by nature.
  if (!request.trim() && triggerType !== "MANUAL") return "PORTFOLIO_REVIEW";
  return "LONG_TERM";
}

/**
 * Regime compatibility (0-1), documented judgment call:
 *   aligned lean (BULL + bullish, BEAR + bearish)          -> 0.8
 *   opposing lean (BULL + bearish, BEAR + bullish)         -> 0.3
 *   SIDEWAYS, or a neutral composite in any regime         -> 0.5
 *   HIGH_VOLATILITY (directional calls are less reliable)  -> 0.4
 *   UNKNOWN (no index data — never penalise or reward)     -> 0.5
 */
export function regimeCompatibilityFor(regime: MarketRegime, state: string): number {
  const bullish = state.includes("BULLISH");
  const bearish = state.includes("BEARISH");
  if (regime === "UNKNOWN") return 0.5;
  if (regime === "HIGH_VOLATILITY") return 0.4;
  if (regime === "SIDEWAYS" || (!bullish && !bearish)) return 0.5;
  if (regime === "BULL") return bullish ? 0.8 : 0.3;
  if (regime === "BEAR") return bearish ? 0.8 : 0.3;
  return 0.5;
}

const FRESHNESS_RANK: Record<Freshness, number> = { LIVE: 0, FRESH: 1, STALE: 2, EXPIRED: 3 };

function worstFreshnessOf(evidence: Evidence[]): Freshness {
  let worst: Freshness = "LIVE";
  for (const e of evidence) {
    if (FRESHNESS_RANK[e.freshness] > FRESHNESS_RANK[worst]) worst = e.freshness;
  }
  return worst;
}

interface DeterministicBlock {
  strategyPack: StrategyPack;
  aggregation: AggregationResult;
  regime: MarketRegime;
  regimeReason: string;
  regimeCompatibility: number;
  calibratedConfidence: number;
  worstFreshness: Freshness;
  probability: ProbabilityResult;
}

export interface BrainRunInput {
  correlationId: string;
  userRequest?: string;
  triggerType: TriggerType;
  userId: string;
}

export interface BrainRunResult {
  draft: DraftDecision;
  evidence: Evidence[];
  plan: BrainPlan;
  runState: GatewayRunState;
  model: string;
  promptVersion: string;
  latencyMs: number;
  tokenCost: number;
  /** Null when no signal-bearing evidence was gathered in this run. */
  deterministic?: DeterministicBlock | null;
}

const capabilityEnum = z.enum(
  PHASE1_GATEWAY_CONFIG.approvedCapabilities as [CapabilityId, ...CapabilityId[]],
);

const planSchema = z.object({
  understanding: z.string().describe("One or two sentences restating what the user actually needs."),
  instrument: z.string().nullable().describe("Ticker or fund name if the request is about one instrument, else null."),
  requiresPortfolioContext: z.boolean(),
  steps: z.array(z.string()).max(6),
  capabilities: z.array(capabilityEnum).max(4),
});
export type BrainPlan = z.infer<typeof planSchema>;

const sufficiencySchema = z.object({
  sufficient: z.boolean(),
  reason: z.string(),
  nextCapabilities: z.array(capabilityEnum).max(2),
});

const decisionSchema = z.object({
  action: z.enum([
    "BUY", "SELL", "HOLD", "TOP_UP", "REDUCE", "REBALANCE", "BOOK_PROFITS",
    "INCREASE_SIP", "PAUSE_SIP", "LUMPSUM", "APPLY_IPO", "AVOID_IPO",
    "WATCHLIST_ADD", "WATCHLIST_REMOVE", "NO_ACTION", "INSUFFICIENT_DATA",
  ]),
  instrument: z.string().nullable(),
  strategy: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  thesis: z.string(),
  counterThesis: z.string(),
  supportingEvidenceIds: z.array(z.string()),
  contradictingEvidenceIds: z.array(z.string()),
  risks: z.array(z.string()).max(6),
  invalidationConditions: z.array(z.string()).max(6),
  missingEvidence: z.array(z.string()).max(6),
  timeHorizon: z.string().nullable(),
  monitoringPlan: z.string().nullable(),
});

const BRAIN_SYSTEM = `You are the Investment Brain of WealthOS, a personal wealth platform for Indian investors (₹ INR, NSE/BSE).

You are NOT a chat assistant. You reason and decide. Another module writes the user-facing prose.

Hard rules:
- You may only obtain facts from the Capability Gateway evidence supplied to you. Never invent prices, valuations, fundamentals or news.
- If the evidence does not support a call, choose action INSUFFICIENT_DATA (data is missing) or NO_ACTION (evidence is adequate but nothing should change). Both are correct, expected outcomes — not failures.
- Confidence must reflect the evidence actually present, not your prior knowledge.
- Only cite evidence ids that were given to you.
- Available capabilities in this build: PORTFOLIO_SNAPSHOT (the user's holdings, value, P&L, concentration, health), RULES_EVALUATE (deterministic portfolio/risk/allocation rule findings), RESEARCH_TECHNICAL (trend, SMA/RSI/ATR, 52-week position from stored daily candles for ONE symbol) and RESEARCH_FUNDAMENTAL (market cap, P/E, P/B, ROE, D/E, margins for ONE symbol). The two RESEARCH capabilities need an instrument — set the plan's instrument field when you use them, and expect an explicit "unavailable" result rather than a guess when the data has not been collected yet.
- Evidence is labelled LIVE / FRESH / STALE / EXPIRED. STALE or EXPIRED evidence cannot on its own support an actionable call; say so and prefer INSUFFICIENT_DATA.
- When a DETERMINISTIC ANALYSIS block is supplied, it is authoritative. It comes from deterministic engines (signal aggregation, confidence calibration, market regime, market probability), not from you. Your own stated confidence is ignored and replaced by the calibrated confidence in that block, so do not argue with it — reason consistently with it. If your qualitative read contradicts the composite state, say so explicitly in the counter-thesis instead of overriding the numbers.`;

function evidenceBlock(evidence: Evidence[]): string {
  if (evidence.length === 0) return "(no evidence gathered)";
  return evidence
    .map((e) => `- [${e.id}] (${e.capability}, ${e.freshness}, ${e.source}) ${e.summary}`)
    .join("\n");
}

export async function run(
  input: BrainRunInput,
  ctx: GatewayContext,
  config: CapabilityGatewayConfig = PHASE1_GATEWAY_CONFIG,
): Promise<BrainRunResult> {
  const startedAt = Date.now();
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway(WEALTH_MODEL);

  const runState = createRunState();
  const evidence: Evidence[] = [];
  let tokenCost = 0;

  const request = input.userRequest?.trim() || "(no explicit request — scheduled review)";

  // ---------- 1. UNDERSTAND + PLAN ----------
  let plan: BrainPlan;
  try {
    const planned = await generateText({
      model,
      system: BRAIN_SYSTEM,
      output: Output.object({ schema: planSchema }),
      prompt: `Trigger: ${input.triggerType}\nUser request: ${request}\n\nProduce a short investigation plan. Only list capabilities you genuinely need.`,
    });
    tokenCost += planned.usage?.totalTokens ?? 0;
    plan = planned.output;
  } catch {
    plan = {
      understanding: request,
      instrument: null,
      requiresPortfolioContext: true,
      steps: ["Fallback plan: gather portfolio context and rule findings."],
      capabilities: ["PORTFOLIO_SNAPSHOT", "RULES_EVALUATE"],
    };
  }

  // Strategy pack is chosen deterministically from the request, before any
  // investigation, so the pack cannot be rationalised after seeing evidence.
  const strategyId = inferStrategyId(input.userRequest ?? "", input.triggerType);
  const strategyPack = await getStrategyOrFallback(strategyId);

  // ---------- 2. INVESTIGATE + OBSERVE (bounded loop) ----------
  let queue: CapabilityId[] = [...new Set(plan.capabilities)];

  while (
    queue.length > 0 &&
    runState.iterationsUsed < config.maxIterations &&
    runState.callsUsed < config.maxCapabilityCalls &&
    Date.now() - runState.startedAt < config.timeoutMs &&
    tokenCost < config.tokenBudget
  ) {
    runState.iterationsUsed += 1;

    for (const capability of queue) {
      const result = await invoke(
        {
          capability,
          params: { instrument: plan.instrument ?? undefined },
          correlationId: input.correlationId,
        },
        config,
        runState,
        ctx,
      );
      if ("evidence" in result) evidence.push(...result.evidence);
    }
    queue = [];

    if (
      runState.callsUsed >= config.maxCapabilityCalls ||
      runState.iterationsUsed >= config.maxIterations ||
      tokenCost >= config.tokenBudget
    ) {
      break;
    }

    // "Do I have enough?" — the adaptive part of the loop.
    try {
      const check = await generateText({
        model,
        system: BRAIN_SYSTEM,
        output: Output.object({ schema: sufficiencySchema }),
        prompt: `User request: ${request}\n\nEvidence gathered so far:\n${evidenceBlock(
          evidence,
        )}\n\nIs this enough to reach a decision? If not, name at most 2 further capabilities worth calling (they must be from the approved list, and repeating an already-served call is pointless).`,
      });
      tokenCost += check.usage?.totalTokens ?? 0;
      if (check.output.sufficient) break;
      const fp = JSON.stringify({ instrument: plan.instrument ?? undefined });
      queue = check.output.nextCapabilities.filter((c) => !runState.seen.has(`${c}:${fp}`));
    } catch {
      break;
    }
  }

  // ---------- 2b. DETERMINISTIC LAYER (only when signals exist) ----------
  // Guardrail: runs that never touched RESEARCH_TECHNICAL / RESEARCH_FUNDAMENTAL
  // carry no Signal, so this block is skipped entirely and behaviour is
  // byte-for-byte what it was before this wiring.
  const signals: Signal[] = evidence
    .map((e) => e.signal)
    .filter((s): s is Signal => s != null);

  let deterministic: DeterministicBlock | null = null;
  if (signals.length > 0) {
    const aggregation = aggregate(signals, strategyPack);
    const regimeResult = await getCurrentRegime();
    const regimeCompatibility = regimeCompatibilityFor(regimeResult.regime, aggregation.state);
    // Only the signal-bearing evidence governs the freshness penalty; portfolio
    // and rule evidence is always FRESH by construction and would mask decay.
    const worstFreshness = worstFreshnessOf(
      evidence.filter((e) => e.signal != null),
    );
    const calibratedConfidence = calibrate(
      signals,
      undefined,
      worstFreshness,
      regimeCompatibility,
      strategyPack,
    );
    deterministic = {
      strategyPack,
      aggregation,
      regime: regimeResult.regime,
      regimeReason: regimeResult.reason,
      regimeCompatibility,
      calibratedConfidence,
      worstFreshness,
      probability: computeProbability(signals, strategyPack.signalWeights),
    };
  }

  const deterministicPrompt = deterministic
    ? `
DETERMINISTIC ANALYSIS (authoritative — produced by deterministic engines, not by you):
- Strategy pack: ${deterministic.strategyPack.id} (weights ${JSON.stringify(deterministic.strategyPack.signalWeights)})
- Composite state: ${deterministic.aggregation.state} (score ${deterministic.aggregation.score}, engines used: ${deterministic.aggregation.usedEngines.join(", ") || "none"})
- Market regime: ${deterministic.regime} — ${deterministic.regimeReason}
- Regime compatibility: ${deterministic.regimeCompatibility}
- Worst freshness across signal evidence: ${deterministic.worstFreshness}
- Calibrated confidence: ${deterministic.calibratedConfidence}/100 (this REPLACES whatever confidence you state)
- Probability: bullish ${deterministic.probability.bullishPct}% / bearish ${deterministic.probability.bearishPct}% / sideways ${deterministic.probability.sidewaysPct}% (probability-model confidence ${deterministic.probability.confidence})
- Key bullish drivers: ${deterministic.probability.keyBullishDrivers.join(" | ") || "none"}
- Key bearish risks: ${deterministic.probability.keyBearishRisks.join(" | ") || "none"}
`
    : "";

  // ---------- 3 + 4. THESIS / COUNTER-THESIS -> DECIDE ----------
  let draft: DraftDecision;
  try {
    const decided = await generateText({
      model,
      system: BRAIN_SYSTEM,
      output: Output.object({ schema: decisionSchema }),
      prompt: `Trigger: ${input.triggerType}
User request: ${request}
Plan understanding: ${plan.understanding}

Evidence (the ONLY facts you may use):
${evidenceBlock(evidence)}

${deterministicPrompt}
Budget used: ${runState.iterationsUsed} iterations, ${runState.callsUsed} capability calls.

Build a thesis and an honest counter-thesis, then decide. Cite evidence ids exactly as given. If a live quote, valuation or company fundamental is required and absent, the action is INSUFFICIENT_DATA and you must list what is missing.`,
    });
    tokenCost += decided.usage?.totalTokens ?? 0;
    const o = decided.output;
    const known = new Set(evidence.map((e) => e.id));
    const llmStatedConfidence = Math.max(0, Math.min(100, o.confidence));
    draft = {
      correlationId: input.correlationId,
      instrument: o.instrument ?? plan.instrument,
      strategy: o.strategy ?? strategyPack.id,
      action: o.action,
      // The LLM never sets confidence when the deterministic layer ran.
      confidence: deterministic ? deterministic.calibratedConfidence : llmStatedConfidence,
      thesis: o.thesis,
      counterThesis: o.counterThesis,
      supportingEvidenceIds: o.supportingEvidenceIds.filter((id) => known.has(id)),
      contradictingEvidenceIds: o.contradictingEvidenceIds.filter((id) => known.has(id)),
      risks: o.risks,
      invalidationConditions: o.invalidationConditions,
      missingEvidence: o.missingEvidence,
      timeHorizon: o.timeHorizon,
      monitoringPlan: o.monitoringPlan,
      deterministic: deterministic
        ? {
            strategy: deterministic.strategyPack.id,
            compositeState: deterministic.aggregation.state,
            compositeScore: deterministic.aggregation.score,
            regime: deterministic.regime,
            regimeCompatibility: deterministic.regimeCompatibility,
            calibratedConfidence: deterministic.calibratedConfidence,
            llmStatedConfidence,
            worstFreshness: deterministic.worstFreshness,
            bullishPct: deterministic.probability.bullishPct,
            bearishPct: deterministic.probability.bearishPct,
            sidewaysPct: deterministic.probability.sidewaysPct,
          }
        : null,
      executionProposal: null,
      brainVersion: BRAIN_VERSION,
    };
  } catch (err) {
    draft = {
      correlationId: input.correlationId,
      instrument: plan.instrument,
      strategy: null,
      action: "INSUFFICIENT_DATA",
      confidence: 0,
      thesis: "The reasoning step could not complete.",
      counterThesis: "No counter-thesis could be formed without a completed reasoning step.",
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      risks: ["Decision engine error — treat as no guidance given."],
      invalidationConditions: [],
      missingEvidence: [err instanceof Error ? err.message : "Unknown Brain error"],
      timeHorizon: null,
      monitoringPlan: null,
      executionProposal: null,
      brainVersion: BRAIN_VERSION,
    };
  }

  return {
    draft,
    evidence,
    plan,
    runState,
    model: WEALTH_MODEL,
    promptVersion: PROMPT_VERSION,
    latencyMs: Date.now() - startedAt,
    tokenCost,
  };
}
