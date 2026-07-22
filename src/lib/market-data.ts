// Client-safe market-data types + pure normalizers for the WealthOS market
// layer. No secrets, no fetch — safe to import anywhere (client or server).
//
// Sources:
//  - Equities/ETFs/fundamentals/news: Indian Stock Market API (indianapi.in)
//  - Mutual fund NAVs (AMFI): mfapi.in
// Anything a provider does not supply stays null — never fabricated.

export type CacheStatus = "ok" | "stale" | "unavailable";

export interface DataMeta {
  source: string;
  fetchedAt: string | null;
  status: CacheStatus;
}

export interface CachedPayload<T = unknown> {
  payload: T | null;
  source: string;
  status: CacheStatus;
  fetchedAt: string | null;
}

export interface StockFundamentals {
  symbol: string;
  name: string;
  sector: string | null;
  cmp: number | null; // current market price (₹)
  changePct: number | null; // day change %
  yearHigh: number | null;
  yearLow: number | null;
  marketCap: number | null; // ₹ Cr
  pe: number | null;
  pb: number | null;
  roe: number | null; // %
  roce: number | null; // % (may be null — provider does not always expose)
  debtToEquity: number | null;
  dividendYield: number | null; // %
  netProfitMargin: number | null; // %
  volume: number | null;
  found: boolean;
}

export interface NewsItem {
  title: string;
  url: string | null;
  date: string | null;
}

export interface AnalystView {
  buy: number | null;
  hold: number | null;
  sell: number | null;
  targetPrice: number | null;
}

export interface StockResearchData {
  fundamentals: StockFundamentals;
  peers: { name: string; pe: number | null; roe: number | null; marketCap: number | null }[];
  news: NewsItem[];
  analyst: AnalystView | null;
  meta: DataMeta;
}

// ---- Mutual funds (mfapi.in / AMFI) ----------------------------------------
export interface FundSearchItem {
  schemeCode: number;
  schemeName: string;
}

export interface MutualFundData {
  schemeCode: number | null;
  name: string;
  fundHouse: string | null;
  category: string | null; // scheme_category
  schemeType: string | null; // scheme_type (open/close ended)
  isin: string | null;
  nav: number | null; // latest NAV (₹)
  navDate: string | null; // dd-mm-yyyy from AMFI
  prevNav: number | null;
  changePct: number | null; // day-over-day NAV change %
  // AMFI/mfapi does NOT expose these — kept null so the UI shows "unavailable",
  // never a fabricated value:
  fundSize: number | null; // ₹ Cr (AUM)
  expenseRatio: number | null; // %
  topHoldings: string[] | null;
  found: boolean;
}

// ---- coercion helpers -------------------------------------------------------
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[,%₹\s]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function firstNum(obj: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    if (k in obj) {
      const n = num(obj[k]);
      if (n !== null) return n;
    }
  }
  return null;
}

type RawStock = Record<string, unknown>;

/**
 * Flatten indianapi's `keyMetrics` (nested groups of { key, value } rows) into
 * one lookup. Also indexes by a normalized key (strip `)`/spaces, lowercase)
 * to tolerate upstream typos like `returnOnAverageEquityMostRecentFiscalYear)`.
 */
function flattenKeyMetrics(raw: RawStock | null): Record<string, unknown> {
  const km = raw?.keyMetrics as Record<string, unknown> | undefined;
  const out: Record<string, unknown> = {};
  if (!km) return out;
  const norm = (k: string) => k.replace(/[)\s]/g, "").toLowerCase();
  for (const group of Object.values(km)) {
    if (Array.isArray(group)) {
      for (const row of group) {
        const r = row as Record<string, unknown>;
        const k = typeof r.key === "string" ? r.key : null;
        if (!k) continue;
        out[k] = r.value;
        out[norm(k)] = r.value;
      }
    } else if (group && typeof group === "object") {
      for (const [k, v] of Object.entries(group as Record<string, unknown>)) {
        out[k] = v;
        out[norm(k)] = v;
      }
    }
  }
  return out;
}

/**
 * Normalize the /stock response into a flat fundamentals object.
 *
 * The queried company's OWN fundamentals live in top-level `keyMetrics`
 * (grouped: valuation / margins / mgmtEffectiveness / financialstrength /
 * priceandVolume ...). `companyProfile.peerCompanyList` is for PEER
 * comparison and must NOT be used for the queried company's own numbers —
 * doing so returned large-cap peer market caps for small caps like JPPOWER.
 * Peers stay in normalizePeers().
 *
 * Anything the provider does not supply stays null — never fabricated.
 */
export function normalizeFundamentals(raw: RawStock | null): StockFundamentals {
  if (!raw) {
    return {
      symbol: "", name: "", sector: null, cmp: null, changePct: null, yearHigh: null, yearLow: null,
      marketCap: null, pe: null, pb: null, roe: null, roce: null, debtToEquity: null,
      dividendYield: null, netProfitMargin: null, volume: null, found: false,
    };
  }

  const tickerId = String(raw.tickerId ?? "");
  const name = String(raw.companyName ?? tickerId);
  const cpObj = raw.currentPrice as Record<string, unknown> | undefined;
  const cmp = firstNum(cpObj, ["NSE", "BSE"]);

  const profile = raw.companyProfile as Record<string, unknown> | undefined;
  const sector =
    (typeof raw.industry === "string" && raw.industry) ||
    (profile && typeof profile.mgIndustry === "string" ? (profile.mgIndustry as string) : null);

  const km = flattenKeyMetrics(raw);
  const nkm = (k: string) => k.replace(/[)\s]/g, "").toLowerCase();
  const pick = (keys: string[]) =>
    firstNum(km, keys.flatMap((k) => [k, nkm(k)]));

  return {
    symbol: tickerId,
    name,
    sector: sector || null,
    cmp,
    changePct: num(raw.percentChange),
    yearHigh: num(raw.yearHigh),
    yearLow: num(raw.yearLow),
    marketCap: pick(["marketCap"]),
    pe: pick([
      "pPerENormalizedMostRecentFiscalYear",
      "pPerEExcludingExtraordinaryItemsMostRecentFiscalYear",
      "pPerEBasicExcludingExtraordinaryItemsTTM",
      "pPerEIncludingExtraordinaryItemsTTM",
    ]),
    pb: pick([
      "priceToBookMostRecentQuarter",
      "priceToBookMostRecentFiscalYear",
    ]),
    roe: pick([
      "returnOnAverageEquityTrailing12Month",
      "returnOnAverageEquityMostRecentFiscalYear",
      "returnOnAverageEquity5YearAverage",
    ]),
    // ROCE isn't exposed by indianapi's keyMetrics — leave null rather than
    // substituting ROI or a peer's value.
    roce: null,
    debtToEquity: pick([
      "totalDebtPerTotalEquityMostRecentQuarter",
      "totalDebtPerTotalEquityMostRecentFiscalYear",
      "lTDebtPerEquityMostRecentQuarter",
      "ltDebtPerEquityMostRecentFiscalYear",
    ]),
    dividendYield: pick([
      "currentDividendYieldCommonStockPrimaryIssueLTM",
      "dividendYieldIndicatedAnnualDividendDividedByClosingprice",
      "dividendYield5YearAverage",
    ]),
    netProfitMargin: pick([
      "netProfitMarginPercentTrailing12Month",
      "netProfitMarginPercent1stHistoricalFiscalYear",
      "netProfitMargin5YearAverage",
    ]),
    volume: firstNum(raw, ["volume", "totalTradedVolume"]) ?? firstNum(cpObj, ["volume"]),
    found: true,
  };
}

export function normalizePeers(raw: RawStock | null): StockResearchData["peers"] {
  if (!raw) return [];
  const profile = raw.companyProfile as Record<string, unknown> | undefined;
  const peerList = (profile?.peerCompanyList as Record<string, unknown>[] | undefined) ?? [];
  return peerList.slice(0, 6).map((p) => ({
    name: String(p.companyName ?? p.tickerId ?? "—"),
    pe: firstNum(p, ["priceToEarningsValueRatio", "ttmPe"]),
    roe: firstNum(p, ["returnOnAverageEquityTrailing12Month", "returnOnAverageEquity5YearAverage"]),
    marketCap: firstNum(p, ["marketCap"]),
  }));
}

export function normalizeNews(raw: RawStock | null): NewsItem[] {
  if (!raw) return [];
  const list = raw.recentNews as Record<string, unknown>[] | undefined;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 8).map((n) => ({
    title: String(n.headline ?? n.title ?? n.name ?? "Untitled"),
    url: (typeof n.url === "string" && n.url) || (typeof n.link === "string" ? (n.link as string) : null),
    date: (typeof n.date === "string" && n.date) || (typeof n.pubDate === "string" ? (n.pubDate as string) : null),
  }));
}

export function normalizeAnalyst(raw: RawStock | null): AnalystView | null {
  if (!raw) return null;
  const recos = (raw.recosBar ?? raw.analystView) as Record<string, unknown> | undefined;
  if (!recos) return null;
  const stats = (recos.stdDev ? recos : (recos.recommendation as Record<string, unknown>) ?? recos) as Record<string, unknown>;
  const buy = firstNum(stats, ["buy", "Buy", "strongBuy"]);
  const hold = firstNum(stats, ["hold", "Hold"]);
  const sell = firstNum(stats, ["sell", "Sell", "strongSell"]);
  const targetPrice = firstNum(recos, ["priceTarget", "targetPrice", "meanTarget"]);
  if (buy === null && hold === null && sell === null && targetPrice === null) return null;
  return { buy, hold, sell, targetPrice };
}

// ---- Mutual fund normalizers (mfapi.in) ------------------------------------
export function normalizeFundSearch(raw: unknown): FundSearchItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = r as Record<string, unknown>;
      const code = num(o.schemeCode);
      const name = str(o.schemeName);
      return code !== null && name ? { schemeCode: code, schemeName: name } : null;
    })
    .filter((x): x is FundSearchItem => x !== null);
}

export function normalizeFund(raw: Record<string, unknown> | null): MutualFundData {
  const empty: MutualFundData = {
    schemeCode: null, name: "", fundHouse: null, category: null, schemeType: null, isin: null,
    nav: null, navDate: null, prevNav: null, changePct: null,
    fundSize: null, expenseRatio: null, topHoldings: null, found: false,
  };
  if (!raw) return empty;
  const meta = raw.meta as Record<string, unknown> | undefined;
  const data = raw.data as Record<string, unknown>[] | undefined;
  if (!meta) return empty;

  const latest = Array.isArray(data) && data.length ? data[0] : undefined;
  const prev = Array.isArray(data) && data.length > 1 ? data[1] : undefined;
  const nav = num(latest?.nav);
  const prevNav = num(prev?.nav);
  const changePct = nav !== null && prevNav !== null && prevNav !== 0 ? ((nav - prevNav) / prevNav) * 100 : null;

  return {
    schemeCode: num(meta.scheme_code),
    name: String(meta.scheme_name ?? ""),
    fundHouse: str(meta.fund_house),
    category: str(meta.scheme_category),
    schemeType: str(meta.scheme_type),
    isin: str(meta.isin_growth),
    nav,
    navDate: str(latest?.date),
    prevNav,
    changePct,
    fundSize: null,
    expenseRatio: null,
    topHoldings: null,
    found: nav !== null,
  };
}

// ---- Live-price merge helpers (client-safe) --------------------------------
type QuoteMap = Record<string, { fundamentals: StockFundamentals; meta: DataMeta }>;

/** symbol -> live CMP, only for symbols the provider actually returned. */
export function livePriceMap(quotes: QuoteMap | undefined): Record<string, number> {
  const map: Record<string, number> = {};
  if (!quotes) return map;
  for (const [sym, v] of Object.entries(quotes)) {
    if (v.fundamentals.cmp !== null) map[sym] = v.fundamentals.cmp;
  }
  return map;
}

/** Roll many per-symbol metas into one overall status for a screen badge. */
export function aggregateMeta(quotes: QuoteMap | undefined, fallbackSource: string): DataMeta {
  const metas = quotes ? Object.values(quotes).map((v) => v.meta) : [];
  if (metas.length === 0) return { source: fallbackSource, fetchedAt: null, status: "unavailable" };
  const status: CacheStatus = metas.some((m) => m.status === "ok")
    ? "ok"
    : metas.some((m) => m.status === "stale")
      ? "stale"
      : "unavailable";
  const fetchedAt = metas
    .map((m) => m.fetchedAt)
    .filter((x): x is string => !!x)
    .sort()
    .at(-1) ?? null;
  return { source: metas[0]?.source ?? fallbackSource, fetchedAt, status };
}

// ---- display helpers --------------------------------------------------------
export function fmtCr(v: number | null): string {
  if (v === null) return "—";
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L Cr`;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
}

export function fmtNum(v: number | null, suffix = "", digits = 2): string {
  if (v === null) return "—";
  return `${v.toLocaleString("en-IN", { maximumFractionDigits: digits })}${suffix}`;
}

export function fmtPrice(v: number | null): string {
  if (v === null) return "—";
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}
