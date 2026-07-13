// Server-only mutual-fund provider adapter (mfapi.in — AMFI NAV data).
// No API key required. Uses the shared cache layer for source + freshness
// tracking. Search is live (dynamic query); scheme NAV is cached.

import type { CachedPayload, FundSearchItem } from "@/lib/market-data";
import { normalizeFundSearch } from "@/lib/market-data";
import { MF_SOURCE } from "@/lib/providers";
import { cachedFetch } from "@/lib/market-data.server";

const MF_BASE = "https://api.mfapi.in";

async function callMf(path: string): Promise<unknown> {
  const res = await fetch(`${MF_BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MF provider ${res.status}: ${body.slice(0, 160)}`);
  }
  return res.json();
}

export const mfProvider = {
  id: "mfapi" as const,
  source: MF_SOURCE,
  async search(query: string): Promise<FundSearchItem[]> {
    try {
      const raw = await callMf(`/mf/search?q=${encodeURIComponent(query.trim())}`);
      return normalizeFundSearch(raw).slice(0, 20);
    } catch {
      return [];
    }
  },
  scheme(schemeCode: number | string): Promise<CachedPayload<Record<string, unknown>>> {
    const code = String(schemeCode).trim();
    // NAV updates a few times daily; cache 3h.
    return cachedFetch<Record<string, unknown>>(
      `fund:${code}`,
      "/mf",
      MF_SOURCE,
      180,
      () => callMf(`/mf/${code}`),
    );
  },
};
