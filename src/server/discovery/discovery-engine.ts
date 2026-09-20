/**
 * Discovery Engine (Phase 9) — [ENGINE], no LLM.
 *
 * Owns the screening logic that previously lived inside the
 * getDiscoveryScreens server function (extracted, not duplicated — the server
 * fn is now a thin wrapper around computeScreens()).
 *
 * New in Phase 9: getDiscoveryWithContext() cross-references every screened
 * idea against the user's holdings and watchlist, so "new ideas" genuinely
 * means new. Anything already tracked moves to alreadyTracking instead of
 * being re-pitched as a fresh recommendation.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  normalizeFundamentals,
  type StockFundamentals,
  type DataMeta,
  type CacheStatus,
} from "@/lib/market-data";
import { DISCOVERY_UNIVERSE } from "@/lib/discovery-universe";
import type { CapTier, RiskRating, DiscoveryTag } from "@/lib/market";
import type { DiscoveryIdea, DiscoverySectorRow, DiscoveryResult } from "@/lib/discovery.functions";

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

/** The full live screen run over the curated universe. */
export async function computeScreens(): Promise<DiscoveryResult> {
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

  const successes = rows.filter((r) => r.fundamentals.found && r.fundamentals.cmp !== null);
  const status: CacheStatus = successes.some((r) => r.status === "ok")
    ? "ok"
    : successes.some((r) => r.status === "stale")
      ? "stale"
      : "unavailable";
  const fetchedAt =
    successes
      .map((r) => r.fetchedAt)
      .filter((x): x is string => !!x)
      .sort()
      .at(-1) ?? null;
  const meta: DataMeta = { source: "indianapi.in", status, fetchedAt };

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

  // Value: low PE and/or low PB with positive earnings.
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

  // Dividend: highest yields with positive earnings.
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

  // Sector aggregates for the leaders table.
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
}

export interface DiscoveryWithContext {
  newIdeas: Record<DiscoveryTag, DiscoveryIdea[]>;
  alreadyTracking: DiscoveryIdea[];
  meta: DataMeta;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

/** Symbols (and names, as a fallback key) the user already holds or watches. */
async function trackedKeys(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Set<string>> {
  const [holdings, watchlist] = await Promise.all([
    supabase.from("holdings").select("symbol, name").eq("user_id", userId).limit(500),
    supabase.from("watchlist").select("symbol, name").eq("user_id", userId).limit(500),
  ]);
  const keys = new Set<string>();
  for (const row of holdings.data ?? []) {
    if (row.symbol) keys.add(norm(row.symbol));
    if (row.name) keys.add(norm(row.name));
  }
  for (const row of watchlist.data ?? []) {
    if (row.symbol) keys.add(norm(row.symbol));
    if (row.name) keys.add(norm(row.name));
  }
  keys.delete("");
  return keys;
}

export async function getDiscoveryWithContext(
  userId: string,
  supabase?: SupabaseClient<Database>,
): Promise<DiscoveryWithContext> {
  const client =
    supabase ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;

  const [result, tracked] = await Promise.all([
    computeScreens(),
    trackedKeys(client as SupabaseClient<Database>, userId),
  ]);

  const newIdeas = {} as Record<DiscoveryTag, DiscoveryIdea[]>;
  const trackingById = new Map<string, DiscoveryIdea>();

  for (const [tag, ideas] of Object.entries(result.screens) as [DiscoveryTag, DiscoveryIdea[]][]) {
    const fresh: DiscoveryIdea[] = [];
    for (const idea of ideas) {
      const isTracked = tracked.has(norm(idea.symbol)) || tracked.has(norm(idea.name));
      if (isTracked) trackingById.set(norm(idea.symbol) || norm(idea.name), idea);
      else fresh.push(idea);
    }
    newIdeas[tag] = fresh;
  }

  return { newIdeas, alreadyTracking: [...trackingById.values()], meta: result.meta };
}

/**
 * Compact, token-cheap summary of the freshest non-duplicate ideas, used to
 * seed the scheduled Daily Brief request text. Deliberately capped — the Brain
 * gets a nudge toward what's new, not a full data dump.
 */
export function summarizeNewIdeas(ctx: DiscoveryWithContext, perScreen = 3): string {
  const lines: string[] = [];
  for (const [tag, ideas] of Object.entries(ctx.newIdeas) as [DiscoveryTag, DiscoveryIdea[]][]) {
    const top = ideas.slice(0, perScreen);
    if (top.length === 0) continue;
    lines.push(
      `${tag}: ${top
        .map((i) => `${i.symbol} (₹${Math.round(i.price).toLocaleString("en-IN")})`)
        .join(", ")}`,
    );
  }
  if (lines.length === 0) return "";
  return `Fresh screen ideas the user does not already hold or watch — ${lines.join("; ")}.`;
}
