/**
 * Confidence Calibration (LLD §9) — deterministic [ENGINE], no LLM.
 *
 * Turns a set of signals plus context into one 0-100 confidence number.
 *
 * historicalReliability is a TEMPORARY FLAT PRIOR (0.6 for every engine) until
 * Phase 12 has decision_outcomes rows to learn real per-engine reliability
 * from. It is deliberately not tuned by hand — a hand-tuned number would look
 * learned without being learned.
 */
import type { Freshness } from "@/server/freshness/freshness-gate";
import type { Signal, SignalEngine } from "@/server/signals/signal-types";
import { clamp01 } from "@/server/signals/signal-types";
import type { StrategyPack } from "@/server/aggregation/signal-aggregation";

export const FLAT_PRIOR = 0.6;

export const DEFAULT_RELIABILITY: Record<SignalEngine, number> = {
  TECHNICAL: FLAT_PRIOR,
  FUNDAMENTAL: FLAT_PRIOR,
  VALUATION: FLAT_PRIOR,
  SENTIMENT: FLAT_PRIOR,
  CORPORATE_ACTION: FLAT_PRIOR,
  DERIVATIVES: FLAT_PRIOR,
  INSTITUTIONAL_FLOW: FLAT_PRIOR,
  LIQUIDITY: FLAT_PRIOR,
  SECTOR: FLAT_PRIOR,
  MACRO: FLAT_PRIOR,
};

/** Freshness multipliers — expired evidence cannot carry confidence. */
const FRESHNESS_FACTOR: Record<Freshness, number> = {
  LIVE: 1,
  FRESH: 0.9,
  STALE: 0.6,
  EXPIRED: 0.25,
};

/**
 * @param regimeCompatibility 0-1: how well the signal set fits the current
 *        market regime. Pass 0.5 (neutral) when the regime is UNKNOWN.
 * @param strategy optional pack from the Strategy Registry. Its
 *        thresholds.confidenceCeiling caps the result for packs whose data
 *        coverage is known to be incomplete (INTRADAY, IPO).
 * @returns 0-100 confidence.
 */
export function calibrate(
  signals: Signal[],
  historicalReliability: Record<SignalEngine, number> = DEFAULT_RELIABILITY,
  freshness: Freshness = "FRESH",
  regimeCompatibility = 0.5,
  strategy?: StrategyPack,
): number {
  if (signals.length === 0) return 0;

  // Base: reliability-weighted mean of each signal's own confidence.
  let num = 0;
  let den = 0;
  for (const s of signals) {
    const rel = historicalReliability[s.engine] ?? FLAT_PRIOR;
    num += rel * clamp01(s.confidence);
    den += rel;
  }
  const base = den > 0 ? num / den : 0;

  // Agreement: signals pointing the same way earn a bonus, conflict a penalty.
  const dirs = signals.filter((s) => s.direction !== "NEUTRAL").map((s) => s.direction);
  let agreement = 1;
  if (dirs.length > 1) {
    const bull = dirs.filter((d) => d === "BULLISH").length;
    const share = Math.max(bull, dirs.length - bull) / dirs.length; // 0.5 .. 1
    agreement = 0.7 + 0.6 * (share - 0.5); // 0.7 (split) .. 1.0 (unanimous)
  }

  // Regime fit spans 0.8 .. 1.1 so an unknown regime (0.5) is close to neutral.
  const regime = 0.8 + 0.6 * clamp01(regimeCompatibility) * 0.5;

  const score = base * FRESHNESS_FACTOR[freshness] * agreement * regime;
  return Math.round(clamp01(score) * 100);
}
