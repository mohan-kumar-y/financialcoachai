// Client-safe market-data types + pure normalizers for the Indian Stock
// Market API (indianapi.in). No secrets, no fetch — safe to import anywhere.

export type CacheStatus = "ok" | "stale" | "unavailable";

export interface DataMeta {
  source: string;
  fetchedAt: string | null;
  status: CacheStatus;
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
 * Normalize the /stock response into a flat fundamentals object.
 * Uses top-level price fields + the company's own row in peerCompanyList
 * (indianapi returns the queried company inside that list) for ratios.
 * Anything the provider does not supply stays null — never fabricated.
 */
export function normalizeFundamentals(raw: RawStock | null): StockFundamentals {
  if (!raw) {
    return {
      symbol: "", name: "", sector: null, cmp: null, changePct: null, yearHigh: null, yearLow: null,
      marketCap: null, pe: null, pb: null, roe: null, roce: null, debtToEquity: null,
      dividendYield: null, netProfitMargin: null, found: false,
    };
  }

  const tickerId = String(raw.tickerId ?? "");
  const name = String(raw.companyName ?? tickerId);
  const cpObj = raw.currentPrice as Record<string, unknown> | undefined;
  const cmp = firstNum(cpObj, ["NSE", "BSE"]);

  const profile = raw.companyProfile as Record<string, unknown> | undefined;
  const peerList = (profile?.peerCompanyList as Record<string, unknown>[] | undefined) ?? [];
  // Find the queried company's own row; fall back to first peer.
  const self =
    peerList.find(
      (p) =>
        String(p.tickerId ?? "").toUpperCase() === tickerId.toUpperCase() ||
        String(p.companyName ?? "").toLowerCase() === name.toLowerCase(),
    ) ?? peerList[0];

  const sector =
    (typeof raw.industry === "string" && raw.industry) ||
    (self && typeof self.mgIndustry === "string" && (self.mgIndustry as string)) ||
    (profile && typeof profile.mgIndustry === "string" ? (profile.mgIndustry as string) : null);

  return {
    symbol: tickerId,
    name,
    sector: sector || null,
    cmp,
    changePct: num(raw.percentChange),
    yearHigh: num(raw.yearHigh),
    yearLow: num(raw.yearLow),
    marketCap: firstNum(self, ["marketCap"]),
    pe: firstNum(self, ["priceToEarningsValueRatio", "ttmPe", "priceEarningsRatio"]),
    pb: firstNum(self, ["priceToBookValueRatio"]),
    roe: firstNum(self, [
      "returnOnAverageEquityTrailing12Month",
      "returnOnAverageEquity5YearAverage",
      "returnOnEquity",
    ]),
    roce: firstNum(self, ["returnOnAverageCapitalEmployed", "returnOnCapitalEmployed"]),
    debtToEquity: firstNum(self, ["ltDebtPerEquityMostRecentFiscalYear", "totalDebtToEquityRatio", "debtToEquity"]),
    dividendYield: firstNum(self, ["dividendYieldIndicatedAnnualDividend", "dividendYield"]),
    netProfitMargin: firstNum(self, ["netProfitMargin5YearAverage", "netProfitMarginPercentTrailing12Month", "netProfitMargin"]),
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
