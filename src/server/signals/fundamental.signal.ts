/**
 * Fundamental Signal (Phase 5 — LLD §5, capability RESEARCH_FUNDAMENTAL).
 *
 * Deterministic [ENGINE] code — no LLM. Reads public.fundamentals_cache for a
 * symbol; when the row is missing or older than MAX_AGE_HOURS it performs ONE
 * lazy fetch through the indianapi.in adapter and persists the payload.
 * Metrics the provider does not expose stay null — never inferred, never
 * borrowed from a peer.
 */
import { normalizeFundamentals } from "@/lib/market-data";
import type { StockFundamentals } from "@/lib/market-data";
import { fundamentals as fetchFundamentals, persistFundamentals, FUNDAMENTALS_SOURCE } from "@/server/mip/indianapi-fundamentals.adapter";

export const MAX_AGE_HOURS = 24;

export interface FundamentalSignal {
  symbol: string;
  available: boolean;
  reason?: string;
  observedAt: string | null;
  source: string;
  metrics: Pick<
    StockFundamentals,
    | "name"
    | "sector"
    | "cmp"
    | "marketCap"
    | "pe"
    | "pb"
    | "roe"
    | "roce"
    | "debtToEquity"
    | "dividendYield"
    | "netProfitMargin"
    | "yearHigh"
    | "yearLow"
  > | null;
  /** Deterministic observations — evidence, not recommendations. */
  flags: string[];
  missingMetrics: string[];
  summary: string;
}

async function readCache(
  symbol: string,
): Promise<{ payload: unknown; fetchedAt: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("fundamentals_cache")
    .select("payload, fetched_at")
    .eq("symbol", symbol)
    .maybeSingle();
  if (error || !data) return null;
  return { payload: data.payload, fetchedAt: data.fetched_at };
}

function unavailable(symbol: string, reason: string): FundamentalSignal {
  return {
    symbol,
    available: false,
    reason,
    observedAt: null,
    source: FUNDAMENTALS_SOURCE,
    metrics: null,
    flags: [],
    missingMetrics: [],
    summary: `Fundamentals unavailable for ${symbol}: ${reason}`,
  };
}

const fmt = (n: number | null, suffix = "") => (n == null ? "n/a" : `${n}${suffix}`);

export async function computeFundamental(symbolInput: string): Promise<FundamentalSignal> {
  const symbol = symbolInput.trim().toUpperCase();
  if (!symbol) return unavailable(symbolInput, "no symbol supplied");

  let raw: unknown = null;
  let observedAt: string | null = null;

  const cached = await readCache(symbol);
  const ageMs = cached ? Date.now() - new Date(cached.fetchedAt).getTime() : Infinity;
  if (cached && ageMs <= MAX_AGE_HOURS * 3_600_000) {
    raw = cached.payload;
    observedAt = cached.fetchedAt;
  } else {
    // Lazy fetch — one attempt, then fall back to whatever stale row exists.
    try {
      const fresh = await fetchFundamentals(symbol);
      if (fresh.payload) {
        raw = fresh.payload;
        observedAt = fresh.fetchedAt ?? new Date().toISOString();
        await persistFundamentals(symbol, fresh.payload);
      }
    } catch (err) {
      console.warn("[fundamental.signal] provider fetch failed:", (err as Error).message);
    }
    if (!raw && cached) {
      raw = cached.payload;
      observedAt = cached.fetchedAt; // stale, and labelled as such by the caller
    }
  }

  if (!raw) return unavailable(symbol, "no cached fundamentals and the provider fetch did not return data");

  const f = normalizeFundamentals(raw as Parameters<typeof normalizeFundamentals>[0]);
  if (!f.found) return unavailable(symbol, "provider payload did not resolve to a company");

  const metrics = {
    name: f.name,
    sector: f.sector,
    cmp: f.cmp,
    marketCap: f.marketCap,
    pe: f.pe,
    pb: f.pb,
    roe: f.roe,
    roce: f.roce,
    debtToEquity: f.debtToEquity,
    dividendYield: f.dividendYield,
    netProfitMargin: f.netProfitMargin,
    yearHigh: f.yearHigh,
    yearLow: f.yearLow,
  };

  const missingMetrics = Object.entries(metrics)
    .filter(([, v]) => v == null)
    .map(([k]) => k);

  const flags: string[] = [];
  if (f.roe != null) flags.push(f.roe >= 15 ? `Strong ROE ${f.roe}%` : `Modest ROE ${f.roe}%`);
  if (f.debtToEquity != null)
    flags.push(
      f.debtToEquity > 1 ? `Leveraged balance sheet (D/E ${f.debtToEquity})` : `Low leverage (D/E ${f.debtToEquity})`,
    );
  if (f.pe != null) flags.push(f.pe > 45 ? `Rich earnings multiple (P/E ${f.pe})` : `P/E ${f.pe}`);
  if (f.netProfitMargin != null)
    flags.push(
      f.netProfitMargin < 5
        ? `Thin net margin ${f.netProfitMargin}%`
        : `Net margin ${f.netProfitMargin}%`,
    );
  if (f.dividendYield != null && f.dividendYield >= 2)
    flags.push(`Dividend yield ${f.dividendYield}%`);
  if (missingMetrics.length > 0)
    flags.push(`Provider did not expose: ${missingMetrics.join(", ")} (left null, not estimated)`);

  return {
    symbol,
    available: true,
    observedAt,
    source: FUNDAMENTALS_SOURCE,
    metrics,
    flags,
    missingMetrics,
    summary: `${f.name || symbol} fundamentals${f.sector ? ` (${f.sector})` : ""}: market cap ${fmt(
      f.marketCap,
      " Cr",
    )}, P/E ${fmt(f.pe)}, P/B ${fmt(f.pb)}, ROE ${fmt(f.roe, "%")}, D/E ${fmt(
      f.debtToEquity,
    )}, net margin ${fmt(f.netProfitMargin, "%")}, dividend yield ${fmt(f.dividendYield, "%")}.`,
  };
}
