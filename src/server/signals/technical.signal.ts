/**
 * Technical Signal (Phase 5 — LLD §5, capability RESEARCH_TECHNICAL).
 *
 * Deterministic [ENGINE] code — no LLM. Reads public.candles (daily) for a
 * symbol and derives trend/momentum indicators. On a cold start (fewer than
 * MIN_CANDLES rows) it attempts ONE lazy backfill through the Angel One
 * adapter; if credentials are absent or the provider is unavailable it
 * degrades to an explicit `available: false` result. Never fabricates a
 * price, an indicator, or a trend label.
 */
import { getCandleData } from "@/server/mip/angel-one.adapter";
import { resolveSymbol } from "@/server/mip/angel-one.instruments";

export const CANDLE_INTERVAL = "ONE_DAY";
export const MIN_CANDLES = 30;
const BACKFILL_DAYS = 400;

export interface CandleRow {
  ts: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface TechnicalSignal {
  symbol: string;
  available: boolean;
  /** Populated only when available === false. */
  reason?: string;
  observedAt: string | null;
  candleCount: number;
  close: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  atr14Pct: number | null;
  high52w: number | null;
  low52w: number | null;
  distFromHigh52wPct: number | null;
  distFromLow52wPct: number | null;
  volumeVsAvg20Pct: number | null;
  trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS" | "UNKNOWN";
  momentum: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" | "UNKNOWN";
  summary: string;
}

// ---- pure indicator maths ---------------------------------------------------

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** Wilder's RSI. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Average True Range over `period` bars. */
export function atr(rows: CandleRow[], period = 14): number | null {
  const usable = rows.filter(
    (r) => r.high != null && r.low != null && r.close != null,
  );
  if (usable.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < usable.length; i++) {
    const cur = usable[i]!;
    const prevClose = usable[i - 1]!.close!;
    trs.push(
      Math.max(
        cur.high! - cur.low!,
        Math.abs(cur.high! - prevClose),
        Math.abs(cur.low! - prevClose),
      ),
    );
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// ---- data access ------------------------------------------------------------

async function readCandles(symbol: string, limit = 400): Promise<CandleRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("candles")
    .select("ts, open, high, low, close, volume")
    .eq("symbol", symbol)
    .eq("interval", CANDLE_INTERVAL)
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).slice().reverse() as CandleRow[];
}

function istStamp(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(ist.getUTCDate())} ${p(
    ist.getUTCHours(),
  )}:${p(ist.getUTCMinutes())}`;
}

/** One-shot backfill of daily candles. Returns rows written (0 on degrade). */
export async function backfillCandles(symbol: string): Promise<number> {
  const resolved = await resolveSymbol(symbol);
  if (!resolved) return 0;
  const to = new Date();
  const from = new Date(to.getTime() - BACKFILL_DAYS * 86_400_000);
  const res = await getCandleData({
    symbolToken: resolved.symbolToken,
    interval: CANDLE_INTERVAL,
    fromDate: istStamp(from),
    toDate: istStamp(to),
  });
  if (!res.ok || res.data.length === 0) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rows = res.data.map((c) => ({
    symbol,
    interval: CANDLE_INTERVAL,
    ts: c.ts,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
  const { error } = await supabaseAdmin
    .from("candles")
    .upsert(rows, { onConflict: "symbol,interval,ts" });
  if (error) {
    console.warn("[technical.signal] candle upsert failed:", error.message);
    return 0;
  }
  return rows.length;
}

// ---- public surface ---------------------------------------------------------

function unavailable(symbol: string, reason: string, count: number): TechnicalSignal {
  return {
    symbol,
    available: false,
    reason,
    observedAt: null,
    candleCount: count,
    close: null,
    sma20: null,
    sma50: null,
    sma200: null,
    rsi14: null,
    atr14Pct: null,
    high52w: null,
    low52w: null,
    distFromHigh52wPct: null,
    distFromLow52wPct: null,
    volumeVsAvg20Pct: null,
    trend: "UNKNOWN",
    momentum: "UNKNOWN",
    summary: `Technical signal unavailable for ${symbol}: ${reason}`,
  };
}

export async function computeTechnical(symbolInput: string): Promise<TechnicalSignal> {
  const symbol = symbolInput.trim().toUpperCase();
  if (!symbol) return unavailable(symbolInput, "no symbol supplied", 0);

  let rows: CandleRow[];
  try {
    rows = await readCandles(symbol);
  } catch (err) {
    return unavailable(symbol, `candle store unreadable (${(err as Error).message})`, 0);
  }

  if (rows.length < MIN_CANDLES) {
    // Cold start — one lazy backfill attempt, then re-read.
    const written = await backfillCandles(symbol);
    if (written > 0) {
      try {
        rows = await readCandles(symbol);
      } catch {
        /* keep the rows we had */
      }
    }
  }

  if (rows.length < MIN_CANDLES) {
    return unavailable(
      symbol,
      `only ${rows.length} daily candles stored (need ${MIN_CANDLES}); historical backfill requires Angel One credentials`,
      rows.length,
    );
  }

  const closes = rows.map((r) => r.close).filter((c): c is number => c != null);
  if (closes.length < MIN_CANDLES) {
    return unavailable(symbol, "stored candles have no usable close prices", rows.length);
  }

  const last = rows[rows.length - 1]!;
  const close = closes[closes.length - 1]!;
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);
  const r14 = rsi(closes, 14);
  const a14 = atr(rows, 14);
  const window52 = closes.slice(-250);
  const high52w = Math.max(...window52);
  const low52w = Math.min(...window52);

  const volumes = rows.map((r) => r.volume).filter((v): v is number => v != null && v > 0);
  const avgVol20 = volumes.length >= 20 ? sma(volumes, 20) : null;
  const lastVol = volumes.length > 0 ? volumes[volumes.length - 1]! : null;

  let trend: TechnicalSignal["trend"] = "UNKNOWN";
  if (s20 != null && s50 != null) {
    if (close > s20 && s20 > s50) trend = "UPTREND";
    else if (close < s20 && s20 < s50) trend = "DOWNTREND";
    else trend = "SIDEWAYS";
  }

  let momentum: TechnicalSignal["momentum"] = "UNKNOWN";
  if (r14 != null) momentum = r14 >= 70 ? "OVERBOUGHT" : r14 <= 30 ? "OVERSOLD" : "NEUTRAL";

  const pct = (n: number) => Number(n.toFixed(2));
  const distHigh = pct(((close - high52w) / high52w) * 100);
  const distLow = pct(((close - low52w) / low52w) * 100);
  const atrPct = a14 != null ? pct((a14 / close) * 100) : null;
  const volVs = avgVol20 != null && lastVol != null ? pct((lastVol / avgVol20 - 1) * 100) : null;

  const parts = [
    `close ₹${close.toFixed(2)}`,
    s20 != null ? `SMA20 ₹${s20.toFixed(2)}` : null,
    s50 != null ? `SMA50 ₹${s50.toFixed(2)}` : null,
    s200 != null ? `SMA200 ₹${s200.toFixed(2)}` : null,
    r14 != null ? `RSI14 ${r14.toFixed(1)} (${momentum.toLowerCase()})` : null,
    atrPct != null ? `ATR14 ${atrPct}% of price` : null,
    `${distHigh}% vs 52w high ₹${high52w.toFixed(2)}`,
    `${distLow}% vs 52w low ₹${low52w.toFixed(2)}`,
    volVs != null ? `volume ${volVs}% vs 20d average` : null,
  ].filter(Boolean);

  return {
    symbol,
    available: true,
    observedAt: last.ts,
    candleCount: rows.length,
    close,
    sma20: s20 != null ? pct(s20) : null,
    sma50: s50 != null ? pct(s50) : null,
    sma200: s200 != null ? pct(s200) : null,
    rsi14: r14 != null ? pct(r14) : null,
    atr14Pct: atrPct,
    high52w: pct(high52w),
    low52w: pct(low52w),
    distFromHigh52wPct: distHigh,
    distFromLow52wPct: distLow,
    volumeVsAvg20Pct: volVs,
    trend,
    momentum,
    summary: `${symbol} technicals (${rows.length} daily candles, ${trend.toLowerCase()}): ${parts.join(", ")}.`,
  };
}
