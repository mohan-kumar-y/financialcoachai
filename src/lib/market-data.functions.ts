import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeFundamentals,
  normalizePeers,
  normalizeNews,
  normalizeAnalyst,
  type StockResearchData,
  type StockFundamentals,
  type NewsItem,
  type DataMeta,
} from "@/lib/market-data";

const nameInput = z.object({ query: z.string().min(1).max(80) });
const symbolsInput = z.object({ symbols: z.array(z.string().min(1).max(40)).max(40) });

// ---- Deep research bundle for one stock ------------------------------------
export const getStockResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => nameInput.parse(i))
  .handler(async ({ data }): Promise<StockResearchData> => {
    const { getCached } = await import("@/lib/market-data.server");
    const key = `stock:${data.query.trim().toLowerCase()}`;
    const res = await getCached<Record<string, unknown>>(
      key,
      "/stock",
      `/stock?name=${encodeURIComponent(data.query.trim())}`,
      30, // fundamentals+price cached 30 min
    );
    const meta: DataMeta = { source: res.source, fetchedAt: res.fetchedAt, status: res.status };
    return {
      fundamentals: normalizeFundamentals(res.payload),
      peers: normalizePeers(res.payload),
      news: normalizeNews(res.payload),
      analyst: normalizeAnalyst(res.payload),
      meta,
    };
  });

// ---- Batch fundamentals for portfolio / watchlist symbols ------------------
export interface QuoteResult {
  fundamentals: StockFundamentals;
  meta: DataMeta;
}

export const getQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => symbolsInput.parse(i))
  .handler(async ({ data }): Promise<Record<string, QuoteResult>> => {
    const { getCached } = await import("@/lib/market-data.server");
    const out: Record<string, QuoteResult> = {};
    // Sequential to respect provider rate limits.
    for (const sym of data.symbols) {
      const clean = sym.trim();
      if (!clean) continue;
      const key = `stock:${clean.toLowerCase()}`;
      try {
        const res = await getCached<Record<string, unknown>>(
          key,
          "/stock",
          `/stock?name=${encodeURIComponent(clean)}`,
          30,
        );
        out[sym] = {
          fundamentals: normalizeFundamentals(res.payload),
          meta: { source: res.source, fetchedAt: res.fetchedAt, status: res.status },
        };
      } catch {
        out[sym] = {
          fundamentals: normalizeFundamentals(null),
          meta: { source: "indianapi.in", fetchedAt: null, status: "unavailable" },
        };
      }
    }
    return out;
  });

// ---- Trending gainers / losers ---------------------------------------------
export interface TrendingStock {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
}
export interface TrendingResult {
  gainers: TrendingStock[];
  losers: TrendingStock[];
  meta: DataMeta;
}

function mapTrending(list: unknown): TrendingStock[] {
  if (!Array.isArray(list)) return [];
  return list.map((r) => {
    const o = r as Record<string, unknown>;
    const toN = (v: unknown) => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
    return {
      symbol: String(o.ticker_id ?? o.ric ?? ""),
      name: String(o.company_name ?? o.company ?? ""),
      price: toN(o.price),
      changePct: toN(o.percent_change),
    };
  });
}

export const getTrending = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<TrendingResult> => {
    const { getCached } = await import("@/lib/market-data.server");
    const res = await getCached<Record<string, unknown>>("trending", "/trending", "/trending", 15);
    const t = (res.payload?.trending_stocks ?? {}) as Record<string, unknown>;
    return {
      gainers: mapTrending(t.top_gainers),
      losers: mapTrending(t.top_losers),
      meta: { source: res.source, fetchedAt: res.fetchedAt, status: res.status },
    };
  });

// ---- Market news ------------------------------------------------------------
export interface NewsResult {
  news: NewsItem[];
  meta: DataMeta;
}

export const getMarketNews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<NewsResult> => {
    const { getCached } = await import("@/lib/market-data.server");
    const res = await getCached<unknown>("news", "/news", "/news", 30);
    const list = Array.isArray(res.payload) ? res.payload : [];
    const news: NewsItem[] = list.slice(0, 12).map((n) => {
      const o = n as Record<string, unknown>;
      return {
        title: String(o.title ?? o.headline ?? "Untitled"),
        url: typeof o.url === "string" ? o.url : null,
        date: typeof o.date === "string" ? o.date : typeof o.pub_date === "string" ? (o.pub_date as string) : null,
      };
    });
    return { news, meta: { source: res.source, fetchedAt: res.fetchedAt, status: res.status } };
  });
