// Server-only FX rates. Source: open.er-api.com (free, no API key).
// Cached ~24h through the shared market_cache layer. Falls back to the last
// cached value, and only as an absolute last resort to the hardcoded
// constants in finance.ts — that path is logged loudly, never silent.

import { cachedFetch } from "@/lib/market-data.server";

export type FxCurrency = "INR" | "USD" | "EUR";

const FX_SOURCE = "open.er-api.com";
const FX_URL = "https://open.er-api.com/v6/latest/USD";

/** Last-resort constants — identical to finance.ts CURRENCY_TO_INR. */
export const FALLBACK_TO_INR: Record<FxCurrency, number> = { INR: 1, USD: 84, EUR: 90 };

interface ErApiResponse {
  result?: string;
  rates?: Record<string, number>;
}

export interface FxRates {
  toInr: Record<FxCurrency, number>;
  source: string;
  fetchedAt: string | null;
  /** true when the hardcoded constants were used (no live data, no cache). */
  fallback: boolean;
}

export async function getFxRatesToInr(): Promise<FxRates> {
  const cached = await cachedFetch<ErApiResponse>(
    "fx:usd-base",
    "/v6/latest/USD",
    FX_SOURCE,
    24 * 60,
    async () => {
      const res = await fetch(FX_URL, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`FX provider ${res.status}`);
      const json = (await res.json()) as ErApiResponse;
      if (json.result !== "success" || !json.rates?.INR) throw new Error("FX provider returned no INR rate");
      return json;
    },
  );

  const rates = cached.payload?.rates;
  if (rates?.INR && rates?.EUR) {
    return {
      toInr: { INR: 1, USD: rates.INR, EUR: rates.INR / rates.EUR },
      source: cached.source ?? FX_SOURCE,
      fetchedAt: cached.fetchedAt ?? null,
      fallback: false,
    };
  }

  console.warn(
    "[fx-rates] No live or cached FX data available — falling back to hardcoded CURRENCY_TO_INR constants (USD:84, EUR:90). These are NOT live rates.",
  );
  return { toInr: { ...FALLBACK_TO_INR }, source: "hardcoded-fallback", fetchedAt: null, fallback: true };
}

/** Convenience: INR per one unit of `currency`. */
export async function getRateToInr(currency: FxCurrency): Promise<number> {
  const { toInr } = await getFxRatesToInr();
  return toInr[currency] ?? FALLBACK_TO_INR[currency];
}
