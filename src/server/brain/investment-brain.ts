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
- Available capabilities in this build: PORTFOLIO_SNAPSHOT (the user's holdings, value, P&L, concentration, health) and RULES_EVALUATE (deterministic portfolio/risk/allocation rule findings). There is no live market-data capability yet — any request needing a live quote, valuation or company fundamental is INSUFFICIENT_DATA for decision purposes.`;

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

Budget used: ${runState.iterationsUsed} iterations, ${runState.callsUsed} capability calls.

Build a thesis and an honest counter-thesis, then decide. Cite evidence ids exactly as given. If a live quote, valuation or company fundamental is required and absent, the action is INSUFFICIENT_DATA and you must list what is missing.`,
    });
    tokenCost += decided.usage?.totalTokens ?? 0;
    const o = decided.output;
    const known = new Set(evidence.map((e) => e.id));
    draft = {
      correlationId: input.correlationId,
      instrument: o.instrument ?? plan.instrument,
      strategy: o.strategy,
      action: o.action,
      confidence: Math.max(0, Math.min(100, o.confidence)),
      thesis: o.thesis,
      counterThesis: o.counterThesis,
      supportingEvidenceIds: o.supportingEvidenceIds.filter((id) => known.has(id)),
      contradictingEvidenceIds: o.contradictingEvidenceIds.filter((id) => known.has(id)),
      risks: o.risks,
      invalidationConditions: o.invalidationConditions,
      missingEvidence: o.missingEvidence,
      timeHorizon: o.timeHorizon,
      monitoringPlan: o.monitoringPlan,
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
