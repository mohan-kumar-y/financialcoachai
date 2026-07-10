// ---------------------------------------------------------------------------
// WealthOS market data engine.
//
// ⚠️ MOCK / ILLUSTRATIVE DATA. Everything below is realistic but static sample
// data for building and demoing the product. To go live, replace the exported
// datasets & helpers with a real market-data + research provider (e.g. an
// NSE/BSE data feed, a fundamentals API, and an LLM research pipeline).
// Search for "LIVE-DATA" markers to find every integration point.
// ---------------------------------------------------------------------------

import type { HoldingComputed } from "@/lib/advisor";

export type RiskRating = "Low" | "Medium" | "High" | "Very High";
export type CapTier = "Large Cap" | "Mid Cap" | "Small Cap";
export type DiscoveryTag =
  | "compounder"
  | "value"
  | "momentum"
  | "dividend"
  | "sector-leader";

export interface StockIdea {
  symbol: string;
  name: string;
  sector: string;
  cap: CapTier;
  price: number;
  changePct: number; // day change
  returns1y: number; // %
  pe: number;
  roe: number; // %
  debtEquity: number;
  dividendYield: number; // %
  risk: RiskRating;
  tags: DiscoveryTag[];
  thesis: string;
}

// LIVE-DATA: replace with screener output from a fundamentals provider.
export const STOCK_UNIVERSE: StockIdea[] = [
  { symbol: "TITAN", name: "Titan Company", sector: "Consumer", cap: "Large Cap", price: 3720, changePct: 0.9, returns1y: 22, pe: 84, roe: 32, debtEquity: 0.4, dividendYield: 0.3, risk: "Medium", tags: ["compounder", "sector-leader"], thesis: "Category-leading jewellery franchise compounding on formalisation & premiumisation." },
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Financials", cap: "Large Cap", price: 1680, changePct: 0.4, returns1y: 9, pe: 18, roe: 16, debtEquity: 0, dividendYield: 1.1, risk: "Low", tags: ["compounder", "value", "sector-leader"], thesis: "Best-in-class deposit franchise; merger overhang easing as CASA normalises." },
  { symbol: "ASIANPAINT", name: "Asian Paints", sector: "Materials", cap: "Large Cap", price: 2380, changePct: -0.6, returns1y: -18, pe: 52, roe: 27, debtEquity: 0.1, dividendYield: 1.2, risk: "Medium", tags: ["compounder", "sector-leader"], thesis: "Dominant paints distribution moat, but new competition pressuring near-term margins." },
  { symbol: "ITC", name: "ITC", sector: "Consumer", cap: "Large Cap", price: 465, changePct: 0.2, returns1y: 7, pe: 26, roe: 28, debtEquity: 0, dividendYield: 3.4, risk: "Low", tags: ["dividend", "value"], thesis: "High cash-generative cigarettes + FMCG optionality; a reliable dividend compounder." },
  { symbol: "POWERGRID", name: "Power Grid Corp", sector: "Utilities", cap: "Large Cap", price: 320, changePct: 0.5, returns1y: 12, pe: 17, roe: 19, debtEquity: 1.4, dividendYield: 3.6, risk: "Low", tags: ["dividend", "value"], thesis: "Regulated transmission monopoly with predictable RoE and steady dividend." },
  { symbol: "COALINDIA", name: "Coal India", sector: "Energy", cap: "Large Cap", price: 415, changePct: -0.3, returns1y: 14, pe: 8, roe: 42, debtEquity: 0.1, dividendYield: 6.1, risk: "Medium", tags: ["dividend", "value"], thesis: "Deep-value PSU with fat dividend yield; energy-transition risk is the swing factor." },
  { symbol: "TATAMOTORS", name: "Tata Motors", sector: "Auto", cap: "Large Cap", price: 985, changePct: 1.8, returns1y: 28, pe: 12, roe: 20, debtEquity: 0.9, dividendYield: 0.6, risk: "High", tags: ["momentum", "value"], thesis: "JLR turnaround + EV leadership driving deleveraging; cyclical and momentum-heavy." },
  { symbol: "PERSISTENT", name: "Persistent Systems", sector: "IT", cap: "Mid Cap", price: 5650, changePct: 2.4, returns1y: 55, pe: 62, roe: 24, debtEquity: 0, dividendYield: 0.5, risk: "High", tags: ["momentum", "compounder"], thesis: "Fastest-growing mid-cap IT on AI deal wins; rich valuation demands execution." },
  { symbol: "DIXON", name: "Dixon Technologies", sector: "Electronics", cap: "Mid Cap", price: 14200, changePct: 3.1, returns1y: 92, pe: 110, roe: 26, debtEquity: 0.2, dividendYield: 0.1, risk: "Very High", tags: ["momentum"], thesis: "PLI-driven EMS scale-up; explosive growth but priced for perfection." },
  { symbol: "CAMS", name: "Computer Age Mgmt", sector: "Financials", cap: "Mid Cap", price: 4100, changePct: 1.2, returns1y: 46, pe: 48, roe: 44, debtEquity: 0, dividendYield: 1.3, risk: "Medium", tags: ["compounder", "momentum"], thesis: "Duopoly RTA play riding mutual-fund AUM boom; asset-light, high-RoE compounder." },
  { symbol: "POLYCAB", name: "Polycab India", sector: "Industrials", cap: "Mid Cap", price: 6800, changePct: 0.8, returns1y: 34, pe: 42, roe: 22, debtEquity: 0.1, dividendYield: 0.5, risk: "Medium", tags: ["compounder", "momentum", "sector-leader"], thesis: "Wires & cables leader with capex + FMEG optionality; benefits from infra cycle." },
  { symbol: "IEX", name: "Indian Energy Exchange", sector: "Financials", cap: "Small Cap", price: 185, changePct: -1.1, returns1y: 18, pe: 32, roe: 42, debtEquity: 0, dividendYield: 1.6, risk: "High", tags: ["value", "dividend"], thesis: "Asset-light power-trading monopoly; regulatory 'market coupling' risk caps re-rating." },
  { symbol: "KPITTECH", name: "KPIT Technologies", sector: "IT", cap: "Mid Cap", price: 1480, changePct: 2.0, returns1y: 41, pe: 58, roe: 28, debtEquity: 0.1, dividendYield: 0.3, risk: "High", tags: ["momentum"], thesis: "Pure-play automotive software on the software-defined-vehicle wave." },
  { symbol: "NESTLEIND", name: "Nestlé India", sector: "Consumer", cap: "Large Cap", price: 2250, changePct: 0.1, returns1y: 4, pe: 68, roe: 110, debtEquity: 0.1, dividendYield: 1.4, risk: "Low", tags: ["compounder", "dividend"], thesis: "Premium FMCG franchise with pricing power; defensive, low-beta compounder." },
  { symbol: "IRCTC", name: "IRCTC", sector: "Consumer", cap: "Mid Cap", price: 780, changePct: -0.7, returns1y: 6, pe: 44, roe: 38, debtEquity: 0, dividendYield: 0.9, risk: "Medium", tags: ["compounder"], thesis: "Monopoly on rail ticketing, catering & tourism; policy-sensitive but cash-rich." },
];

export interface SectorRow {
  name: string;
  changePct: number;
  returns1y: number;
  pe: number;
  momentum: "Strong" | "Neutral" | "Weak";
  leader: string;
}

// LIVE-DATA: replace with sector index feed.
export const SECTORS: SectorRow[] = [
  { name: "IT", changePct: 1.6, returns1y: 24, pe: 29, momentum: "Strong", leader: "Persistent Systems" },
  { name: "Financials", changePct: 0.5, returns1y: 11, pe: 18, momentum: "Neutral", leader: "HDFC Bank" },
  { name: "Auto", changePct: 1.2, returns1y: 26, pe: 22, momentum: "Strong", leader: "Tata Motors" },
  { name: "Consumer", changePct: -0.2, returns1y: 8, pe: 46, momentum: "Neutral", leader: "Titan Company" },
  { name: "Energy", changePct: 0.3, returns1y: 15, pe: 11, momentum: "Neutral", leader: "Coal India" },
  { name: "Industrials", changePct: 0.9, returns1y: 31, pe: 38, momentum: "Strong", leader: "Polycab" },
  { name: "Materials", changePct: -0.5, returns1y: -4, pe: 40, momentum: "Weak", leader: "Asian Paints" },
  { name: "Utilities", changePct: 0.4, returns1y: 13, pe: 16, momentum: "Neutral", leader: "Power Grid" },
];

export const MARKET_CAP_TARGET: Record<CapTier, number> = {
  "Large Cap": 60,
  "Mid Cap": 25,
  "Small Cap": 15,
};

export interface FundRow {
  name: string;
  category: string;
  amc: string;
  aum: number; // ₹ Cr
  expenseRatio: number; // %
  ret1y: number;
  ret3y: number;
  ret5y: number;
  manager: string;
  managerTenureYrs: number;
  styleDrift: "None" | "Mild" | "Notable";
  managerChanged: boolean;
  rating: number; // 1-5
  topHoldings: string[];
}

// LIVE-DATA: replace with AMFI / fund fact-sheet API.
export const FUNDS: FundRow[] = [
  { name: "Parag Parikh Flexi Cap", category: "Flexi Cap", amc: "PPFAS", aum: 82000, expenseRatio: 0.63, ret1y: 24, ret3y: 19, ret5y: 22, manager: "Rajeev Thakkar", managerTenureYrs: 11, styleDrift: "None", managerChanged: false, rating: 5, topHoldings: ["HDFC Bank", "Bajaj Holdings", "Power Grid", "Coal India", "ITC"] },
  { name: "Mirae Asset Large Cap", category: "Large Cap", amc: "Mirae", aum: 38000, expenseRatio: 0.54, ret1y: 12, ret3y: 13, ret5y: 15, manager: "Gaurav Misra", managerTenureYrs: 6, styleDrift: "Mild", managerChanged: true, rating: 4, topHoldings: ["HDFC Bank", "Reliance", "ICICI Bank", "Infosys", "ITC"] },
  { name: "Quant Small Cap", category: "Small Cap", amc: "Quant", aum: 26000, expenseRatio: 0.64, ret1y: 34, ret3y: 26, ret5y: 34, manager: "Sandeep Tandon", managerTenureYrs: 8, styleDrift: "Notable", managerChanged: false, rating: 4, topHoldings: ["Reliance", "Aegis Logistics", "JIO Financial", "HDFC Bank", "RBL Bank"] },
  { name: "Axis Midcap", category: "Mid Cap", amc: "Axis", aum: 30000, expenseRatio: 0.56, ret1y: 28, ret3y: 17, ret5y: 21, manager: "Shreyash Devalkar", managerTenureYrs: 7, styleDrift: "Mild", managerChanged: false, rating: 4, topHoldings: ["Coforge", "Persistent", "Cholamandalam", "Trent", "Max Healthcare"] },
  { name: "SBI Bluechip", category: "Large Cap", amc: "SBI", aum: 45000, expenseRatio: 0.8, ret1y: 10, ret3y: 12, ret5y: 14, manager: "Saurabh Pant", managerTenureYrs: 2, styleDrift: "Mild", managerChanged: true, rating: 3, topHoldings: ["HDFC Bank", "ICICI Bank", "Reliance", "L&T", "ITC"] },
];

// ---------------------------------------------------------------------------
// Discovery helpers
// ---------------------------------------------------------------------------
export const DISCOVERY_SECTIONS: {
  tag: DiscoveryTag;
  title: string;
  blurb: string;
}[] = [
  { tag: "compounder", title: "Long-term Compounders", blurb: "High-quality businesses that reinvest at strong returns." },
  { tag: "value", title: "Value Opportunities", blurb: "Reasonable valuations relative to earnings & assets." },
  { tag: "momentum", title: "Momentum Picks", blurb: "Strong price & earnings momentum right now." },
  { tag: "dividend", title: "Dividend Picks", blurb: "Steady payouts with healthy yields." },
  { tag: "sector-leader", title: "Sector Leaders", blurb: "Category kings with durable competitive moats." },
];

export function ideasByTag(tag: DiscoveryTag): StockIdea[] {
  return STOCK_UNIVERSE.filter((s) => s.tags.includes(tag));
}

export const RISK_COLOR: Record<RiskRating, string> = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#f97316",
  "Very High": "#ef4444",
};

// ---------------------------------------------------------------------------
// Portfolio health (extends advisor analysis with sector & cap allocation)
// ---------------------------------------------------------------------------
export interface HealthReport {
  diversificationScore: number;
  riskScore: number; // 0-100 (higher = riskier)
  qualityScore: number; // 0-100
  bySector: { name: string; value: number; pct: number }[];
  byCap: { name: CapTier; value: number; pct: number }[];
  warnings: { level: Severity; text: string }[];
}

function metaFor(h: HoldingComputed): { sector: string; cap: CapTier; risk: RiskRating } {
  const match = STOCK_UNIVERSE.find(
    (s) => s.symbol === (h.symbol ?? "").toUpperCase() || s.name.toLowerCase() === h.name.toLowerCase(),
  );
  if (match) return { sector: match.sector, cap: match.cap, risk: match.risk };
  // Fallback by asset type.
  const byType: Record<string, { sector: string; cap: CapTier; risk: RiskRating }> = {
    mutual_fund: { sector: "Diversified", cap: "Large Cap", risk: "Medium" },
    etf: { sector: "Index", cap: "Large Cap", risk: "Low" },
    gold: { sector: "Commodity", cap: "Large Cap", risk: "Low" },
    bond: { sector: "Debt", cap: "Large Cap", risk: "Low" },
    ppf: { sector: "Debt", cap: "Large Cap", risk: "Low" },
    nps: { sector: "Retirement", cap: "Large Cap", risk: "Low" },
  };
  return byType[h.asset_type] ?? { sector: "Other", cap: "Mid Cap", risk: "High" };
}

const RISK_WEIGHT: Record<RiskRating, number> = { Low: 20, Medium: 50, High: 75, "Very High": 95 };

export function analyzeHealth(holdings: HoldingComputed[], diversificationScore: number): HealthReport {
  const total = holdings.reduce((s, h) => s + h.current, 0);
  const sectorMap = new Map<string, number>();
  const capMap = new Map<CapTier, number>();
  let riskAcc = 0;

  holdings.forEach((h) => {
    const m = metaFor(h);
    sectorMap.set(m.sector, (sectorMap.get(m.sector) ?? 0) + h.current);
    capMap.set(m.cap, (capMap.get(m.cap) ?? 0) + h.current);
    riskAcc += RISK_WEIGHT[m.risk] * (total > 0 ? h.current / total : 0);
  });

  const bySector = [...sectorMap.entries()]
    .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
  const byCap = (["Large Cap", "Mid Cap", "Small Cap"] as CapTier[])
    .map((name) => ({ name, value: capMap.get(name) ?? 0, pct: total > 0 ? Math.round(((capMap.get(name) ?? 0) / total) * 100) : 0 }))
    .filter((c) => c.value > 0);

  const riskScore = Math.round(riskAcc);
  const qualityScore = Math.round(
    diversificationScore * 0.45 + (100 - riskScore) * 0.3 + Math.min(100, bySector.length * 14) * 0.25,
  );

  const warnings: { level: Severity; text: string }[] = [];
  bySector.forEach((s) => {
    if (s.pct >= 40) warnings.push({ level: "Critical", text: `${s.name} is ${s.pct}% of your portfolio — heavy sector concentration.` });
    else if (s.pct >= 30) warnings.push({ level: "Warning", text: `${s.name} allocation at ${s.pct}% — watch sector concentration.` });
  });
  const top = [...holdings].sort((a, b) => b.current - a.current)[0];
  if (top && total > 0 && top.current / total >= 0.25) {
    warnings.push({ level: "Warning", text: `${top.name} is ${Math.round((top.current / total) * 100)}% of holdings — single-stock concentration risk.` });
  }
  const smallCap = byCap.find((c) => c.name === "Small Cap");
  if (smallCap && smallCap.pct >= 35) warnings.push({ level: "Warning", text: `Small caps are ${smallCap.pct}% — expect higher volatility.` });
  if (riskScore >= 70) warnings.push({ level: "Critical", text: `Portfolio risk score is high (${riskScore}/100) — consider adding stable assets.` });
  if (warnings.length === 0) warnings.push({ level: "Info", text: "No major concentration or risk warnings detected. Well balanced." });

  return { diversificationScore, riskScore, qualityScore: Math.max(0, Math.min(100, qualityScore)), bySector, byCap, warnings };
}

// ---------------------------------------------------------------------------
// Red Alert Center
// ---------------------------------------------------------------------------
export type Severity = "Critical" | "Warning" | "Info";
export const SEVERITY_COLOR: Record<Severity, string> = {
  Critical: "#ef4444",
  Warning: "#f59e0b",
  Info: "#0ea5e9",
};

export type AlertKind =
  | "Earnings"
  | "Debt"
  | "Promoter Pledge"
  | "Governance"
  | "Price Move"
  | "News";

export interface RedAlert {
  id: string;
  holding: string;
  symbol: string;
  kind: AlertKind;
  severity: Severity;
  title: string;
  detail: string;
  time: string;
}

// LIVE-DATA: replace with a corporate-actions + news + fundamentals event stream.
const ALERT_TEMPLATES: { kind: AlertKind; severity: Severity; title: (n: string) => string; detail: string }[] = [
  { kind: "Earnings", severity: "Critical", title: (n) => `${n} missed Q earnings estimates`, detail: "Revenue below consensus and margins compressed vs prior quarter." },
  { kind: "Debt", severity: "Warning", title: (n) => `${n} debt levels rising`, detail: "Net debt/EBITDA up quarter-on-quarter; watch interest coverage." },
  { kind: "Promoter Pledge", severity: "Critical", title: (n) => `Promoter pledge increased in ${n}`, detail: "Promoter pledged additional shares — a governance red flag." },
  { kind: "Governance", severity: "Warning", title: (n) => `Governance concern flagged at ${n}`, detail: "Auditor commentary / related-party transaction under review." },
  { kind: "Price Move", severity: "Warning", title: (n) => `${n} moved sharply today`, detail: "Large single-day price move on above-average volume." },
  { kind: "News", severity: "Info", title: (n) => `Major news for ${n}`, detail: "New order win / regulatory update likely to impact sentiment." },
];

export function buildAlerts(holdings: HoldingComputed[]): RedAlert[] {
  const alerts: RedAlert[] = [];
  holdings.forEach((h, i) => {
    // Price-move alert derived from real position P&L.
    if (Math.abs(h.pnlPct) >= 12) {
      alerts.push({
        id: `pm-${h.id}`,
        holding: h.name,
        symbol: h.symbol ?? h.name,
        kind: "Price Move",
        severity: Math.abs(h.pnlPct) >= 20 ? "Critical" : "Warning",
        title: `${h.name} ${h.pnlPct >= 0 ? "surged" : "dropped"} ${Math.abs(h.pnlPct).toFixed(0)}%`,
        detail: `Your position is ${h.pnlPct >= 0 ? "up" : "down"} ${Math.abs(h.pnlPct).toFixed(1)}% vs cost. Review thesis and position size.`,
        time: `${(i % 6) + 1}h ago`,
      });
    }
    // Deterministic sample event so the feed is populated for demos.
    const t = ALERT_TEMPLATES[(h.name.length + i) % ALERT_TEMPLATES.length];
    alerts.push({
      id: `ev-${h.id}`,
      holding: h.name,
      symbol: h.symbol ?? h.name,
      kind: t.kind,
      severity: t.severity,
      title: t.title(h.name),
      detail: t.detail,
      time: `${(i % 3) + 1}d ago`,
    });
  });
  const order: Record<Severity, number> = { Critical: 0, Warning: 1, Info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ---------------------------------------------------------------------------
// Sell Signal Engine
// ---------------------------------------------------------------------------
export type SellReason =
  | "Fundamental deterioration"
  | "Valuation excess"
  | "Goal achievement"
  | "Risk increase";

export interface SellSignal {
  holding: string;
  symbol: string;
  reason: SellReason;
  strength: "Strong" | "Moderate" | "Watch";
  explanation: string;
}

export function buildSellSignals(holdings: HoldingComputed[]): SellSignal[] {
  const signals: SellSignal[] = [];
  const total = holdings.reduce((s, h) => s + h.current, 0);
  holdings.forEach((h) => {
    const match = STOCK_UNIVERSE.find((s) => s.symbol === (h.symbol ?? "").toUpperCase());
    // Valuation excess.
    if (match && match.pe >= 70) {
      signals.push({ holding: h.name, symbol: h.symbol ?? h.name, reason: "Valuation excess", strength: match.pe >= 100 ? "Strong" : "Moderate", explanation: `Trading at ~${match.pe}x earnings — richly valued. Consider trimming to book gains and rebalance.` });
    }
    // Goal achievement (big winners).
    if (h.pnlPct >= 60) {
      signals.push({ holding: h.name, symbol: h.symbol ?? h.name, reason: "Goal achievement", strength: h.pnlPct >= 100 ? "Strong" : "Moderate", explanation: `Up ${h.pnlPct.toFixed(0)}% from cost. Booking partial profits locks in gains and reduces concentration.` });
    }
    // Fundamental deterioration.
    if (match && match.returns1y < 0 && h.pnlPct < -10) {
      signals.push({ holding: h.name, symbol: h.symbol ?? h.name, reason: "Fundamental deterioration", strength: "Watch", explanation: `Sector/stock 1Y return is negative and your position is down ${Math.abs(h.pnlPct).toFixed(0)}%. Re-check the investment thesis.` });
    }
    // Risk increase (concentration).
    if (total > 0 && h.current / total >= 0.3) {
      signals.push({ holding: h.name, symbol: h.symbol ?? h.name, reason: "Risk increase", strength: "Moderate", explanation: `This single holding is ${Math.round((h.current / total) * 100)}% of your portfolio. Trimming reduces single-name risk.` });
    }
  });
  const order = { Strong: 0, Moderate: 1, Watch: 2 } as const;
  return signals.sort((a, b) => order[a.strength] - order[b.strength]);
}

// ---------------------------------------------------------------------------
// Daily brief
// ---------------------------------------------------------------------------
export interface DailyBrief {
  headline: string;
  marketSummary: string;
  watch: StockIdea[];
  portfolioNews: { holding: string; note: string; impact: "positive" | "negative" | "neutral" }[];
  opportunities: string[];
  risks: string[];
}

export function buildDailyBrief(holdings: HoldingComputed[]): DailyBrief {
  const watch = [...STOCK_UNIVERSE].sort((a, b) => b.changePct - a.changePct).slice(0, 4);
  const portfolioNews = holdings.slice(0, 5).map((h, i) => {
    const impacts = ["positive", "neutral", "negative"] as const;
    const impact = impacts[(h.name.length + i) % 3];
    const notes = {
      positive: `${h.name}: brokerages positive after in-line results; sector tailwind intact.`,
      neutral: `${h.name}: trading in line with sector; no fresh triggers today.`,
      negative: `${h.name}: under pressure on margin worries; monitor closely.`,
    };
    return { holding: h.name, note: notes[impact], impact };
  });
  return {
    headline: "Markets edge higher; IT & Auto lead, Materials lag",
    marketSummary:
      "Benchmarks closed modestly higher led by IT and Auto on strong deal-flow and export cues. Financials were mixed while Materials underperformed on margin concerns. Breadth was positive with mid-caps outperforming. FIIs were net buyers; DIIs added on dips.",
    watch,
    portfolioNews: portfolioNews.length ? portfolioNews : [{ holding: "Your portfolio", note: "Add holdings to get personalised, position-specific news.", impact: "neutral" }],
    opportunities: [
      "IT momentum strengthening on AI deal pipeline — quality mid-caps in focus.",
      "Rate-sensitive financials attractive if RBI stays on hold.",
      "SIP top-up window: use market dips to accelerate long-term compounding.",
    ],
    risks: [
      "Rich valuations in small/mid caps leave little margin for error.",
      "Global risk-off or crude spike could pressure importers.",
      "Earnings season: watch for margin misses in consumer names.",
    ],
  };
}

// Overlap between two funds by shared top holdings (illustrative).
export function fundOverlap(a: FundRow, b: FundRow): number {
  const setB = new Set(b.topHoldings.map((h) => h.toLowerCase()));
  const shared = a.topHoldings.filter((h) => setB.has(h.toLowerCase())).length;
  const denom = Math.max(a.topHoldings.length, b.topHoldings.length);
  return denom ? Math.round((shared / denom) * 100) : 0;
}

export function formatINRc(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
