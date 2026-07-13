// Server-only market-data cache + equity provider adapter.
// Talks to the Indian Stock Market API (indianapi.in) and caches raw responses
// in public.market_cache so screens show real values plus a "last updated"
// timestamp. NEVER fabricates values: on failure it returns the last cached
// payload (marked stale) or an explicit unavailable status.

import type { CachedPayload } from "@/lib/market-data";
import { EQUITY_SOURCE } from "@/lib/providers";

const API_BASE = "https://stock.indianapi.in";
export const MARKET_SOURCE = EQUITY_SOURCE;

export type { CachedPayload };

function apiKey(): string {
  const key = process.env.INDIAN_STOCK_API_KEY;
  if (!key) throw new Error("Missing INDIAN_STOCK_API_KEY");
  return key;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function readCacheRow(cacheKey: string) {
  const db = await admin();
  const { data } = await db
    .from("market_cache")
    .select("payload, source, status, fetched_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  return data;
}

async function writeCacheRow(cacheKey: string, endpoint: string, source: string, payload: unknown) {
  const db = await admin();
  await db.from("market_cache").upsert(
    {
      cache_key: cacheKey,
      endpoint,
      payload: payload as never,
      source,
      status: "ok",
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );
}

/**
 * Generic fetch-through-cache. Returns fresh cache when younger than
 * ttlMinutes; otherwise runs `fetcher`. On failure returns stale cache
 * (status "stale") or, if nothing cached, status "unavailable" with null.
 * Provider-agnostic: any adapter passes its own source + fetcher.
 */
export async function cachedFetch<T = unknown>(
  cacheKey: string,
  endpoint: string,
  source: string,
  ttlMinutes: number,
  fetcher: () => Promise<unknown>,
): Promise<CachedPayload<T>> {
  const existing = await readCacheRow(cacheKey);
  if (existing?.fetched_at) {
    const ageMin = (Date.now() - new Date(existing.fetched_at).getTime()) / 60000;
    if (ageMin < ttlMinutes) {
      return {
        payload: existing.payload as T,
        source: existing.source,
        status: "ok",
        fetchedAt: existing.fetched_at,
      };
    }
  }

  try {
    const fresh = await fetcher();
    await writeCacheRow(cacheKey, endpoint, source, fresh);
    return { payload: fresh as T, source, status: "ok", fetchedAt: new Date().toISOString() };
  } catch {
    if (existing?.payload) {
      return {
        payload: existing.payload as T,
        source: existing.source,
        status: "stale",
        fetchedAt: existing.fetched_at,
      };
    }
    return { payload: null, source, status: "unavailable", fetchedAt: null };
  }
}

async function callProvider(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-api-key": apiKey(), accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Provider ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Backwards-compatible equity fetch-through-cache (indianapi paths).
 */
export async function getCached<T = unknown>(
  cacheKey: string,
  endpoint: string,
  path: string,
  ttlMinutes: number,
): Promise<CachedPayload<T>> {
  return cachedFetch<T>(cacheKey, endpoint, MARKET_SOURCE, ttlMinutes, () => callProvider(path));
}

// ---- Equity adapter (indianapi.in) -----------------------------------------
export const equityProvider = {
  id: "indianapi" as const,
  source: MARKET_SOURCE,
  stock: (name: string, ttl = 30) =>
    getCached<Record<string, unknown>>(
      `stock:${name.trim().toLowerCase()}`,
      "/stock",
      `/stock?name=${encodeURIComponent(name.trim())}`,
      ttl,
    ),
  trending: (ttl = 15) =>
    getCached<Record<string, unknown>>("trending", "/trending", "/trending", ttl),
  news: (ttl = 30) => getCached<unknown>("news", "/news", "/news", ttl),
};

/** Direct pass-through (debugging only). */
export async function rawProvider(path: string): Promise<unknown> {
  return callProvider(path);
}
