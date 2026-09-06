/**
 * Anomaly Detection (LLD §10 / HLD §18) — deterministic [ENGINE], no LLM.
 * Runs on the Cron poll cadence, never from inside a Brain run.
 *
 * Inputs are limited to what actually exists today:
 *   - trailing daily candles (close + volume) from public.candles
 *   - the latest live_quotes tick (ltp only; the Angel One LTP endpoint does
 *     not return volume, so there is no intraday volume signal)
 *
 * DRIVER-CLASS SCOPE LIMITATION (known gap, not a bug):
 * the architecture doc's full driver taxonomy includes FII/DII flow reversal,
 * block/bulk deals, sector rotation and global-cue alignment. Those require
 * Tier 2/3 sources (options OI, FII/DII flows, block-deal feeds) that are not
 * wired up yet, so this engine classifies ONLY what price+volume alone can
 * support. It must never guess a driver it cannot evidence.
 */
import { volumeVsAverage, type CandleRow } from "@/server/signals/technical.signal";

export type DriverClass =
  | "LARGE_PRICE_MOVE_VS_VOLATILITY"
  | "VOLUME_SPIKE"
  | "PRICE_AND_VOLUME_ANOMALY"
  | "NO_ANOMALY";

export interface AnomalyFlag {
  symbol: string;
  flagged: boolean;
  /** Move in units of the symbol's trailing daily-return std dev. */
  deviationScore: number | null;
  /** Latest daily volume / 20-day average. */
  volumeRatio: number | null;
  driverClass: DriverClass;
  /** 0-1. */
  confidence: number;
  reason: string;
  observedAt: string | null;
}

export const DEFAULT_THRESHOLD_SIGMA = 2.5;
/** 3x the 20-day average volume: conventional "unusual volume" screen level. */
export const VOLUME_SPIKE_MULTIPLE = 3;
/** Need at least this many daily returns for a meaningful std dev. */
export const MIN_RETURNS = 20;

export interface AnomalyInput {
  symbol: string;
  /** Ascending daily candles, most recent last. */
  candles: CandleRow[];
  /** Latest traded price (live_quotes.ltp). */
  ltp: number | null;
  observedAt?: string | null;
}

function stdDev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function insufficient(symbol: string, reason: string): AnomalyFlag {
  return {
    symbol,
    flagged: false,
    deviationScore: null,
    volumeRatio: null,
    driverClass: "NO_ANOMALY",
    confidence: 0,
    reason,
    observedAt: null,
  };
}

export function detect(
  input: AnomalyInput,
  thresholdSigma: number = DEFAULT_THRESHOLD_SIGMA,
): AnomalyFlag {
  const { symbol, candles, ltp } = input;
  const closes = candles.map((c) => c.close).filter((c): c is number => c != null && c > 0);
  if (closes.length < MIN_RETURNS + 1) {
    return insufficient(
      symbol,
      `only ${closes.length} daily closes stored (need ${MIN_RETURNS + 1}) — volatility not computable`,
    );
  }

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i]! - closes[i - 1]!) / closes[i - 1]!);
  }
  const trailing = returns.slice(-MIN_RETURNS);
  const sigma = stdDev(trailing);
  const prevClose = closes[closes.length - 1]!;

  let deviationScore: number | null = null;
  if (ltp != null && Number.isFinite(ltp) && sigma != null && sigma > 0) {
    deviationScore = Number((((ltp - prevClose) / prevClose) / sigma).toFixed(3));
  }

  const volStat = volumeVsAverage(candles, 20);
  const volumeRatio = volStat ? Number(volStat.ratio.toFixed(3)) : null;

  const priceAnomaly = deviationScore != null && Math.abs(deviationScore) >= thresholdSigma;
  const volumeAnomaly = volumeRatio != null && volumeRatio >= VOLUME_SPIKE_MULTIPLE;

  const driverClass: DriverClass = priceAnomaly && volumeAnomaly
    ? "PRICE_AND_VOLUME_ANOMALY"
    : priceAnomaly
      ? "LARGE_PRICE_MOVE_VS_VOLATILITY"
      : volumeAnomaly
        ? "VOLUME_SPIKE"
        : "NO_ANOMALY";

  const flagged = driverClass !== "NO_ANOMALY";

  // Confidence rises with how far past the threshold we are and with how much
  // history backed the volatility estimate. It is never a probability of cause.
  let confidence = 0;
  if (flagged) {
    const priceExcess = priceAnomaly ? Math.min(Math.abs(deviationScore!) / thresholdSigma, 2) / 2 : 0;
    const volExcess = volumeAnomaly ? Math.min(volumeRatio! / VOLUME_SPIKE_MULTIPLE, 2) / 2 : 0;
    confidence = Number(Math.min(1, 0.4 + 0.3 * priceExcess + 0.3 * volExcess).toFixed(3));
  }

  const parts = [
    deviationScore != null
      ? `last price ${deviationScore}σ vs the trailing 20-day return volatility (prev close ₹${prevClose.toFixed(2)})`
      : "no live tick to compare against previous close",
    volumeRatio != null ? `latest daily volume ${volumeRatio}x the 20-day average` : "volume not available",
  ];

  return {
    symbol,
    flagged,
    deviationScore,
    volumeRatio,
    driverClass,
    confidence,
    reason: parts.join("; "),
    observedAt: input.observedAt ?? candles[candles.length - 1]?.ts ?? null,
  };
}

/** Persist a flag to public.anomaly_flags. Only flagged results are stored. */
export async function persistAnomaly(flag: AnomalyFlag): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("anomaly_flags").insert({
    symbol: flag.symbol,
    flagged: flag.flagged,
    deviation_score: flag.deviationScore,
    volume_ratio: flag.volumeRatio,
    driver_class: flag.driverClass,
    confidence: flag.confidence,
    details: { reason: flag.reason, observedAt: flag.observedAt },
  });
  if (error) console.warn("[anomaly] persist failed:", error.message);
}

/**
 * Cron path: load the trailing candles for a symbol, compare against the given
 * live tick, and persist a flag when one fires. Silent no-op when history is
 * too thin — the poll loop must never fail because of this.
 */
export async function detectAndPersist(symbol: string, ltp: number | null): Promise<AnomalyFlag | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("candles")
      .select("ts, open, high, low, close, volume")
      .eq("symbol", symbol)
      .eq("interval", "ONE_DAY")
      .order("ts", { ascending: false })
      .limit(40);
    if (error || !data || data.length < MIN_RETURNS + 1) {
      console.debug(`[anomaly] ${symbol}: insufficient candle history, skipping`);
      return null;
    }
    const candles = data.slice().reverse() as CandleRow[];
    const flag = detect({ symbol, candles, ltp, observedAt: new Date().toISOString() });
    if (flag.flagged) await persistAnomaly(flag);
    return flag;
  } catch (err) {
    console.debug("[anomaly] detection skipped:", (err as Error).message);
    return null;
  }
}
