/**
 * Market Regime Engine (LLD §10 / HLD §17) — deterministic [ENGINE], no LLM.
 *
 * Market-wide (not per-instrument — that's the Market Probability Engine).
 *
 * Scope limitation: RISK_ON / RISK_OFF are deliberately NOT in the union. They
 * need macro inputs (rates, currency, global cues) that Phase 11 wires up. And
 * `getCurrentRegime()` can only read a broad index through Angel One; with no
 * credentials configured it returns UNKNOWN rather than inferring a market
 * regime from unrelated single-stock data.
 */
import type { Signal } from "@/server/signals/signal-types";
import { computeTechnical, toSignal } from "@/server/signals/technical.signal";

export type MarketRegime = "BULL" | "BEAR" | "SIDEWAYS" | "HIGH_VOLATILITY" | "UNKNOWN";

export interface RegimeResult {
  regime: MarketRegime;
  /** 0-1 — how much index data actually backed this call. */
  confidence: number;
  reason: string;
  observedAt: string | null;
}

/** ATR as % of price above this is treated as a volatility regime. */
export const HIGH_VOL_ATR_PCT = 2.5;

export function computeRegime(marketWideSignals: Signal[]): MarketRegime {
  const usable = marketWideSignals.filter((s) => s.confidence > 0);
  if (usable.length === 0) return "UNKNOWN";

  // Volatility dominates: a high-ATR tape is its own regime regardless of lean.
  const volatile = usable.some((s) =>
    s.evidence.some((e) => {
      const m = /ATR14 ([\d.]+)% of price/.exec(e);
      return m ? Number(m[1]) >= HIGH_VOL_ATR_PCT : false;
    }),
  );
  if (volatile) return "HIGH_VOLATILITY";

  let lean = 0;
  for (const s of usable) {
    const sign = s.direction === "BULLISH" ? 1 : s.direction === "BEARISH" ? -1 : 0;
    lean += sign * s.strength * s.confidence;
  }
  const avg = lean / usable.length;
  if (avg >= 0.15) return "BULL";
  if (avg <= -0.15) return "BEAR";
  return "SIDEWAYS";
}

/** Broad-index proxies, tried in order. */
const INDEX_PROXIES = ["NIFTY 50", "NIFTY", "NIFTYBEES"];

/**
 * Best-effort current regime from a broad index.
 * Known limitation until Phase 11: there is no dedicated index/macro pipeline,
 * so this leans on whichever proxy the Angel One instrument master resolves.
 */
export async function getCurrentRegime(): Promise<RegimeResult> {
  for (const proxy of INDEX_PROXIES) {
    const t = await computeTechnical(proxy);
    if (!t.available) continue;
    const signal = toSignal(t);
    return {
      regime: computeRegime([signal]),
      confidence: signal.confidence,
      reason: t.summary,
      observedAt: t.observedAt,
    };
  }
  return {
    regime: "UNKNOWN",
    confidence: 0,
    reason:
      "No broad-index candle history available (index proxies unresolved or Angel One credentials not configured) — regime not inferred from unrelated data.",
    observedAt: null,
  };
}
