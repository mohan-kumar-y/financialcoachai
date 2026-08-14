// MIP provider adapter — indianapi.in (LLD §1.2).
// Fundamentals/profile, historical financials + ratios, corporate actions,
// IPO data, analyst forecasts and news. Key handling and fetch-through-cache
// are reused from market-data.server.ts (single INDIAN_STOCK_API_KEY path,
// not duplicated here).
//
// Provider adapter ONLY: nothing outside src/server/mip/ or the Capability
// Gateway may import this. Never fabricates — on failure cachedFetch returns
// stale cache or an explicit "unavailable" status.

import { getCached, MARKET_SOURCE } from "@/lib/market-data.server";
import type { CachedPayload } from "@/lib/market-data";

export const FUNDAMENTALS_SOURCE = MARKET_SOURCE;

const key = (s: string) => s.trim().toLowerCase();
const q = (s: string) => encodeURIComponent(s.trim());

/** Company fundamentals / profile bundle (daily cache). */
export function fundamentals(
  name: string,
  ttlMinutes = 24 * 60,
): Promise<CachedPayload<Record<string, unknown>>> {
  return getCached<Record<string, unknown>>(
    `fundamentals:${key(name)}`,
    "/stock",
    `/stock?name=${q(name)}`,
    ttlMinutes,
  );
}

/** Historical financials + ratios (quarterly, results-driven refresh). */
export function financials(
  name: string,
  stats: "quarterly" | "annual" = "quarterly",
  ttlMinutes = 24 * 60,
): Promise<CachedPayload<Record<string, unknown>>> {
  return getCached<Record<string, unknown>>(
    `financials:${stats}:${key(name)}`,
    "/statement",
    `/statement?stock_name=${q(name)}&stats=${stats}`,
    ttlMinutes,
  );
}

/** Corporate actions (daily). */
export function corporateActions(
  name: string,
  ttlMinutes = 12 * 60,
): Promise<CachedPayload<unknown>> {
  return getCached<unknown>(
    `corporate-actions:${key(name)}`,
    "/corporate_actions",
    `/corporate_actions?stock_name=${q(name)}`,
    ttlMinutes,
  );
}

/** IPO calendar / data (daily). */
export function ipo(ttlMinutes = 12 * 60): Promise<CachedPayload<unknown>> {
  return getCached<unknown>("ipo", "/ipo", "/ipo", ttlMinutes);
}

/** Analyst forecasts / target prices — CONTEXT ONLY, never authoritative. */
export function forecasts(
  name: string,
  measureCode = "EPS",
  ttlMinutes = 7 * 24 * 60,
): Promise<CachedPayload<unknown>> {
  return getCached<unknown>(
    `forecasts:${measureCode}:${key(name)}`,
    "/stock_forecasts",
    `/stock_forecasts?stock_id=${q(name)}&measure_code=${q(measureCode)}&period_type=Annual&data_type=Actuals&age=Current`,
    ttlMinutes,
  );
}

/** Market news (few-hourly). */
export function news(ttlMinutes = 3 * 60): Promise<CachedPayload<unknown>> {
  return getCached<unknown>("news", "/news", "/news", ttlMinutes);
}

/** Persist a fundamentals payload into public.fundamentals_cache. */
export async function persistFundamentals(symbol: string, payload: unknown): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("fundamentals_cache").upsert(
    {
      symbol: symbol.trim().toUpperCase(),
      payload: payload as never,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "symbol" },
  );
}

/** Append a market event (news / results / corporate action) — append-only. */
export async function recordMarketEvent(input: {
  symbol: string;
  eventType: "NEWS" | "RESULTS" | "CORP_ACTION" | "IPO";
  payload: unknown;
  observedAt?: string;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("market_events").insert({
    symbol: input.symbol.trim().toUpperCase(),
    event_type: input.eventType,
    payload: input.payload as never,
    source: FUNDAMENTALS_SOURCE,
    observed_at: input.observedAt ?? new Date().toISOString(),
  });
}

export const indianApiFundamentalsAdapter = {
  id: "indianapi" as const,
  source: FUNDAMENTALS_SOURCE,
  fundamentals,
  financials,
  corporateActions,
  ipo,
  forecasts,
  news,
};
