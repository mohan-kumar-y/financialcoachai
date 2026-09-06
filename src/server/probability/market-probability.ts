/**
 * Market Probability Engine (LLD §10 / HLD §16) — deterministic [ENGINE].
 *
 * Per-instrument bullish/bearish/sideways probability derived from the
 * weighted signal set. These are EVIDENCE for the Investment Brain, never a
 * recommendation, and never presented to a user as a guaranteed prediction.
 *
 * Drivers and risks are copied verbatim from the evidence strings of the
 * signals that produced them — nothing is authored here.
 */
import type { Signal, SignalEngine } from "@/server/signals/signal-types";
import { clamp01 } from "@/server/signals/signal-types";
import { DEFAULT_STRATEGY } from "@/server/aggregation/signal-aggregation";

export interface ProbabilityResult {
  bullishPct: number;
  bearishPct: number;
  sidewaysPct: number;
  /** 0-100. */
  confidence: number;
  keyBullishDrivers: string[];
  keyBearishRisks: string[];
}

export const DEFAULT_WEIGHTS: Partial<Record<SignalEngine, number>> =
  DEFAULT_STRATEGY.signalWeights;

/** Rounds three percentages so they sum to exactly 100. */
function normalizeTo100(a: number, b: number, c: number): [number, number, number] {
  const total = a + b + c;
  if (total <= 0) return [0, 0, 100];
  const raw = [(a / total) * 100, (b / total) * 100, (c / total) * 100];
  const rounded = raw.map((n) => Math.round(n)) as [number, number, number];
  const drift = 100 - (rounded[0] + rounded[1] + rounded[2]);
  // Push the rounding drift onto the largest bucket.
  const maxIdx = raw.indexOf(Math.max(...raw)) as 0 | 1 | 2;
  rounded[maxIdx] += drift;
  return rounded;
}

export function computeProbability(
  signals: Signal[],
  weights: Partial<Record<SignalEngine, number>> = DEFAULT_WEIGHTS,
): ProbabilityResult {
  const keyBullishDrivers: string[] = [];
  const keyBearishRisks: string[] = [];

  let bull = 0;
  let bear = 0;
  let neutral = 0;
  let weightSum = 0;
  let confAccum = 0;

  for (const s of signals) {
    const w = weights[s.engine];
    if (w == null || w <= 0) continue;
    const mass = w * clamp01(s.strength) * clamp01(s.confidence);
    const idle = w * (1 - clamp01(s.strength) * clamp01(s.confidence));
    if (s.direction === "BULLISH") {
      bull += mass;
      neutral += idle;
      keyBullishDrivers.push(...s.evidence);
    } else if (s.direction === "BEARISH") {
      bear += mass;
      neutral += idle;
      keyBearishRisks.push(...s.evidence);
    } else {
      neutral += w;
    }
    weightSum += w;
    confAccum += w * clamp01(s.confidence);
  }

  if (weightSum === 0) {
    // No weighted signal at all — say sideways/unknown with zero confidence
    // rather than implying a view.
    return {
      bullishPct: 0,
      bearishPct: 0,
      sidewaysPct: 100,
      confidence: 0,
      keyBullishDrivers: [],
      keyBearishRisks: [],
    };
  }

  const [bullishPct, bearishPct, sidewaysPct] = normalizeTo100(bull, bear, neutral);

  return {
    bullishPct,
    bearishPct,
    sidewaysPct,
    confidence: Math.round((confAccum / weightSum) * 100),
    keyBullishDrivers,
    keyBearishRisks,
  };
}
