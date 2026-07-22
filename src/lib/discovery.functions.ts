// Stock Discovery Center — server-side screens computed from LIVE fundamentals.
// Reuses getCached (which caches raw provider JSON in market_cache per-symbol
// for 60 min). We fetch symbols in small parallel batches to respect provider
// rate limits, and then run pure screening logic on the normalized numbers.
// Every field on every card is a real number; any stock missing the metrics a
// given screen requires is skipped rather than fabricated.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeFundamentals,
  type StockFundamentals,
  type DataMeta,
  type CacheStatus,
} from "@/lib/market-data";
import { DISCOVERY_UNIVERSE } from "@/lib/discovery-universe";
import type { CapTier, RiskRating, DiscoveryTag } from "@/lib/market";

const UNIVERSE_TTL_MIN = 60; // discovery doesn't need tick-fresh data
const BATCH_SIZE = 6;

// SEBI-ish market-cap tiers (₹ Cr).
function capTierFromMarketCap(mcap: number | null): CapTier | null {
  if (mcap === null) return null;
  if (mcap >= 67000) return "Large Cap";
  if (mcap >= 20000) return "Mid Cap";
  return "Small Cap";
}

function riskFrom(cap: CapTier | null, de: number | null): RiskRating {
  if (cap === "Small Cap") return de !== null && de > 1 ? "Very High" : "High";
  if (cap === "Mid Cap") return de !== null && de > 1.5 ? "High" : "Medium";
  if (cap === "Large Cap") return de !== null && de > 1.5 ? "Medium" : "Low";
  return "Medium";
}

export interface DiscoveryIdea {
  symbol: string;
  name: string;
  sector: string;
  cap: CapTier;
  price: number;
  changePct: number | null;
  marketCap: number | null;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  debtEquity: number | null;
  dividendYield: number | null;
  netProfitMargin: number | null;
  risk: RiskRating;
  thesis: string;
}

export interface DiscoverySectorRow {
  name: string;
  changePct: number; // avg across sector
  pe: number | null; // avg where available
  count: number;
  leader: string;
  leaderChangePct: number;
  momentum: "Strong" | "Neutral" | "Weak";
}

export interface DiscoveryResult {
  screens: Record<DiscoveryTag, DiscoveryIdea[]>;
  sectors: DiscoverySectorRow[];
  meta: DataMeta;
  universeSize: number;
  covered: number;
}

interface Row {
  query: string;
  fundamentals: StockFundamentals;
  status: CacheStatus;
  fetchedAt: string | null;
  cap: CapTier | null;
}

function fmt(n: number | null, digits = 1): string {
  return n === null ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

function toIdea(row: Row, thesis: string): DiscoveryIdea | null {
  const f = row.fundamentals;
  if (!row.cap || f.cmp === null) return null;
  return {
    symbol: f.symbol || row.query,
    name: f.name || row.query,
    sector: f.sector ?? "Other",
    cap: row.cap,
    price: f.cmp,
    changePct: f.changePct,
    marketCap: f.marketCap,
    pe: f.pe,
    pb: f.pb,
    roe: f.roe,
    debtEquity: f.debtToEquity,
    dividendYield: f.dividendYield,
    netProfitMargin: f.netProfitMargin,
    risk: riskFrom(row.cap, f.debtToEquity),
    thesis,
  };
}

export const getDiscoveryScreens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<DiscoveryResult> => {
    const { getCached } = await import("@/lib/market-data.server");

    // Fetch fundamentals in small parallel batches — cached rows hit DB only.
    const rows: Row[] = [];
    for (let i = 0; i < DISCOVERY_UNIVERSE.length; i += BATCH_SIZE) {
      const slice = DISCOVERY_UNIVERSE.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        slice.map(async (q) => {
          try {
            const res = await getCached<Record<string, unknown>>(
              `stock:${q.toLowerCase()}`,
              "/stock",
              `/stock?name=${encodeURIComponent(q)}`,
              UNIVERSE_TTL_MIN,
            );
            const f = normalizeFundamentals(res.payload);
            return {
              query: q,
              fundamentals: f,
              status: res.status,
              fetchedAt: res.fetchedAt,
              cap: capTierFromMarketCap(f.marketCap),
            } satisfies Row;
          } catch {
            return null;
          }
        }),
      );
      for (const r of results) if (r) rows.push(r);
    }

    // Aggregate meta across the whole batch.
    const successes = rows.filter((r) => r.fundamentals.found && r.fundamentals.cmp !== null);
    const status: CacheStatus = successes.some((r) => r.status === "ok")
      ? "ok"
      : successes.some((r) => r.status === "stale")
        ? "stale"
        : "unavailable";
    const fetchedAt = successes
      .map((r) => r.fetchedAt)
      .filter((x): x is string => !!x)
      .sort()
      .at(-1) ?? null;
    const meta: DataMeta = { source: "indianapi.in", status, fetchedAt };

    // ---- Screens ----------------------------------------------------------
    // Compounders: high ROE, moderate leverage, positive margins.
    const compounders = rows
      .filter(
        (r) =>
          r.fundamentals.roe !== null &&
          r.fundamentals.roe >= 15 &&
          (r.fundamentals.debtToEquity === null || r.fundamentals.debtToEquity <= 1) &&
          (r.fundamentals.netProfitMargin === null || r.fundamentals.netProfitMargin > 0),
      )
      .sort((a, b) => (b.fundamentals.roe ?? 0) - (a.fundamentals.roe ?? 0))
      .slice(0, 12)
      .map((r) =>
        toIdea(
          r,
          `ROE of ${fmt(r.fundamentals.roe)}% with D/E ${fmt(r.fundamentals.debtToEquity, 2)} — quality compounder trading at ${fmt(r.fundamentals.pe)}× earnings.`,
        ),
      )
      .filter((x): x is DiscoveryIdea => !!x);

    // Value: low PE and/or low PB with positive earnings (pe > 0).
    const value = rows
      .filter(
        (r) =>
          r.fundamentals.pe !== null &&
          r.fundamentals.pe > 0 &&
          r.fundamentals.pe < 25 &&
          (r.fundamentals.pb === null || r.fundamentals.pb < 4),
      )
      .sort((a, b) => (a.fundamentals.pe ?? 999) - (b.fundamentals.pe ?? 999))
      .slice(0, 12)
      .map((r) =>
        toIdea(
          r,
          `Trades at ${fmt(r.fundamentals.pe)}× earnings and ${fmt(r.fundamentals.pb, 2)}× book — value setup with ROE ${fmt(r.fundamentals.roe)}%.`,
        ),
      )
      .filter((x): x is DiscoveryIdea => !!x);

    // Momentum: highest positive day change.
    const momentum = rows
      .filter((r) => r.fundamentals.changePct !== null && r.fundamentals.changePct > 0)
      .sort((a, b) => (b.fundamentals.changePct ?? 0) - (a.fundamentals.changePct ?? 0))
      .slice(0, 12)
      .map((r) =>
        toIdea(
          r,
          `Up ${fmt(r.fundamentals.changePct, 2)}% today; range ₹${fmt(r.fundamentals.yearLow, 0)}–₹${fmt(r.fundamentals.yearHigh, 0)} over 52 weeks.`,
        ),
      )
      .filter((x): x is DiscoveryIdea => !!x);

    // Dividend: highest yields with positive PE (positive earnings).
    const dividend = rows
      .filter(
        (r) =>
          r.fundamentals.dividendYield !== null &&
          r.fundamentals.dividendYield >= 1.5 &&
          (r.fundamentals.pe === null || r.fundamentals.pe > 0),
      )
      .sort((a, b) => (b.fundamentals.dividendYield ?? 0) - (a.fundamentals.dividendYield ?? 0))
      .slice(0, 12)
      .map((r) =>
        toIdea(
          r,
          `Yields ${fmt(r.fundamentals.dividendYield, 2)}% at ${fmt(r.fundamentals.pe)}× earnings — steady payer with D/E ${fmt(r.fundamentals.debtToEquity, 2)}.`,
        ),
      )
      .filter((x): x is DiscoveryIdea => !!x);

    // Sector leaders: largest market cap per sector.
    const bySector = new Map<string, Row[]>();
    for (const r of successes) {
      const s = r.fundamentals.sector ?? "Other";
      if (!bySector.has(s)) bySector.set(s, []);
      bySector.get(s)!.push(r);
    }
    const sectorLeaders: DiscoveryIdea[] = [];
    for (const [, list] of bySector) {
      const leader = [...list]
        .filter((r) => r.fundamentals.marketCap !== null)
        .sort((a, b) => (b.fundamentals.marketCap ?? 0) - (a.fundamentals.marketCap ?? 0))[0];
      if (!leader) continue;
      const idea = toIdea(
        leader,
        `Largest listed name in ${leader.fundamentals.sector ?? "its sector"} at ${fmt(leader.fundamentals.marketCap, 0)} Cr market cap; ROE ${fmt(leader.fundamentals.roe)}%.`,
      );
      if (idea) sectorLeaders.push(idea);
    }
    sectorLeaders.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));

    // ---- Sector aggregates for the leaders table --------------------------
    const sectorRows: DiscoverySectorRow[] = [];
    for (const [name, list] of bySector) {
      const changes = list.map((r) => r.fundamentals.changePct).filter((n): n is number => n !== null);
      if (changes.length === 0) continue;
      const pes = list.map((r) => r.fundamentals.pe).filter((n): n is number => n !== null && n > 0);
      const avgChange = changes.reduce((s, n) => s + n, 0) / changes.length;
      const avgPe = pes.length ? pes.reduce((s, n) => s + n, 0) / pes.length : null;
      const topByChange = [...list]
        .filter((r) => r.fundamentals.changePct !== null)
        .sort((a, b) => (b.fundamentals.changePct ?? 0) - (a.fundamentals.changePct ?? 0))[0];
      sectorRows.push({
        name,
        changePct: avgChange,
        pe: avgPe,
        count: list.length,
        leader: topByChange?.fundamentals.name ?? "—",
        leaderChangePct: topByChange?.fundamentals.changePct ?? 0,
        momentum: avgChange >= 1 ? "Strong" : avgChange <= -0.5 ? "Weak" : "Neutral",
      });
    }
    sectorRows.sort((a, b) => b.count - a.count || b.changePct - a.changePct);

    return {
      screens: {
        compounder: compounders,
        value,
        momentum,
        dividend,
        "sector-leader": sectorLeaders,
      },
      sectors: sectorRows,
      meta,
      universeSize: DISCOVERY_UNIVERSE.length,
      covered: successes.length,
    };
  });
