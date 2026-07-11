// Server-only market-data provider client + cache layer.
// Talks to the Indian Stock Market API (indianapi.in) and caches raw
// responses in public.market_cache so screens can show real values plus a
// "last updated" timestamp. NEVER fabricates values: on failure it returns
// the last cached payload (marked stale) or an explicit unavailable status.

const API_BASE = "https://stock.indianapi.in";
export const MARKET_SOURCE = "indianapi.in";

export type CacheStatus = "ok" | "stale" | "unavailable";

export interface CachedPayload<T = unknown> {
  payload: T | null;
  source: string;
  status: CacheStatus;
  fetchedAt: string | null;
}

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

async function writeCacheRow(cacheKey: string, endpoint: string, payload: unknown) {
  const db = await admin();
  await db.from("market_cache").upsert(
    {
      cache_key: cacheKey,
      endpoint,
      payload: payload as never,
      source: MARKET_SOURCE,
      status: "ok",
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );
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
 * Fetch-through-cache. Returns fresh data when the cache is younger than
 * ttlMinutes, otherwise re-fetches. On provider failure returns stale cache
 * (status "stale") or, if nothing cached, status "unavailable" with null payload.
 */
export async function getCached<T = unknown>(
  cacheKey: string,
  endpoint: string,
  path: string,
  ttlMinutes: number,
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
    const fresh = await callProvider(path);
    await writeCacheRow(cacheKey, endpoint, fresh);
    return { payload: fresh as T, source: MARKET_SOURCE, status: "ok", fetchedAt: new Date().toISOString() };
  } catch {
    if (existing?.payload) {
      return {
        payload: existing.payload as T,
        source: existing.source,
        status: "stale",
        fetchedAt: existing.fetched_at,
      };
    }
    return { payload: null, source: MARKET_SOURCE, status: "unavailable", fetchedAt: null };
  }
}

/** Direct pass-through (used by the probe / debugging). */
export async function rawProvider(path: string): Promise<unknown> {
  return callProvider(path);
}
