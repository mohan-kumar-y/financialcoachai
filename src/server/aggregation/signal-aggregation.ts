/**
 * Signal Aggregation (LLD §8) — deterministic [ENGINE], no LLM.
 *
 * Combines per-engine signals into one composite state via a weighted score.
 *
 * NOTE: strategy-registry.ts and the `strategies` table land in Phase 7. Until
 * then this file carries a minimal local StrategyPack and one hardcoded
 * DEFAULT_STRATEGY with equal weights across the engines that actually exist
 * today (TECHNICAL, FUNDAMENTAL). Phase 7 replaces DEFAULT_STRATEGY with real
 * per-strategy weights loaded from the strategies table.
 */
import type { Signal, SignalEngine } from "@/server/signals/signal-types";

export type CompositeState =
  | "STRONGLY_BULLISH"
  | "BULLISH"
  | "NEUTRAL"
  | "BEARISH"
  | "STRONGLY_BEARISH";

export interface StrategyPack {
  id: string;
  /** Partial map — engines absent from the map are ignored entirely. */
  signalWeights: Partial<Record<SignalEngine, number>>;
}

/** Phase 6 placeholder — equal weights over the two live engines. */
export const DEFAULT_STRATEGY: StrategyPack = {
  id: "default-phase6",
  signalWeights: { TECHNICAL: 0.5, FUNDAMENTAL: 0.5 },
};

export interface AggregationResult {
  symbol: string;
  strategy: string;
  state: CompositeState;
  /** -1 (max bearish) .. +1 (max bullish). */
  score: number;
  contributions: { engine: SignalEngine; weight: number; contribution: number }[];
  usedEngines: SignalEngine[];
  ignoredEngines: SignalEngine[];
}

const dirSign = (d: Signal["direction"]) => (d === "BULLISH" ? 1 : d === "BEARISH" ? -1 : 0);

/**
 * Thresholds are judgment calls, documented here:
 *   |score| >= 0.60 -> STRONGLY_*, >= 0.20 -> directional, else NEUTRAL.
 */
export function stateFor(score: number): CompositeState {
  if (score >= 0.6) return "STRONGLY_BULLISH";
  if (score >= 0.2) return "BULLISH";
  if (score <= -0.6) return "STRONGLY_BEARISH";
  if (score <= -0.2) return "BEARISH";
  return "NEUTRAL";
}

export function aggregate(
  signals: Signal[],
  strategy: StrategyPack = DEFAULT_STRATEGY,
): AggregationResult {
  const symbol = signals[0]?.symbol ?? "";
  const used: SignalEngine[] = [];
  const ignored: SignalEngine[] = [];
  const contributions: AggregationResult["contributions"] = [];

  let weighted = 0;
  let weightSum = 0;

  for (const s of signals) {
    const weight = strategy.signalWeights[s.engine];
    if (weight == null || weight <= 0) {
      ignored.push(s.engine);
      continue;
    }
    // Each signal contributes direction * strength * confidence, weighted.
    const contribution = dirSign(s.direction) * s.strength * s.confidence;
    weighted += weight * contribution;
    weightSum += weight;
    used.push(s.engine);
    contributions.push({ engine: s.engine, weight, contribution: Number(contribution.toFixed(4)) });
  }

  // No usable signal => score 0 / NEUTRAL. Never invent a lean.
  const score = weightSum > 0 ? Number((weighted / weightSum).toFixed(4)) : 0;

  return {
    symbol,
    strategy: strategy.id,
    state: weightSum > 0 ? stateFor(score) : "NEUTRAL",
    score,
    contributions,
    usedEngines: used,
    ignoredEngines: ignored,
  };
}
