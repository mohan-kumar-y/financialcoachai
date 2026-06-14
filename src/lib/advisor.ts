// Pure analytics for the Financial Advisor (AI Wealth Coach) module.
import type { HoldingRow } from "@/lib/holdings.functions";

export const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "etf", label: "ETF" },
  { value: "gold", label: "Gold" },
  { value: "ppf", label: "PPF" },
  { value: "nps", label: "NPS" },
  { value: "bond", label: "Bond" },
] as const;

export const ASSET_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_TYPES.map((a) => [a.value, a.label]),
);

export const ASSET_COLORS: Record<string, string> = {
  stock: "#6366f1",
  mutual_fund: "#22c55e",
  etf: "#0f8b8d",
  gold: "#f59e0b",
  ppf: "#0b6b6f",
  nps: "#8b5cf6",
  bond: "#ec4899",
};

export interface HoldingComputed extends HoldingRow {
  invested: number;
  current: number;
  pnl: number;
  pnlPct: number;
  weight: number; // % of portfolio
}

export interface PortfolioSummary {
  holdings: HoldingComputed[];
  invested: number;
  current: number;
  pnl: number;
  pnlPct: number;
  byType: { name: string; value: number; color: string; type: string }[];
  diversificationScore: number;
  concentrationRisk: number; // top holding weight %
  healthScore: number;
}

export function analyzePortfolio(rows: HoldingRow[]): PortfolioSummary {
  const enriched = rows.map((h) => {
    const invested = h.units * h.avg_buy_price;
    const current = h.units * h.current_price;
    const pnl = current - invested;
    return { ...h, invested, current, pnl, pnlPct: invested > 0 ? (pnl / invested) * 100 : 0, weight: 0 };
  });
  const current = enriched.reduce((s, h) => s + h.current, 0);
  const invested = enriched.reduce((s, h) => s + h.invested, 0);
  enriched.forEach((h) => (h.weight = current > 0 ? (h.current / current) * 100 : 0));
  enriched.sort((a, b) => b.current - a.current);

  const typeMap = new Map<string, number>();
  enriched.forEach((h) => typeMap.set(h.asset_type, (typeMap.get(h.asset_type) ?? 0) + h.current));
  const byType = [...typeMap.entries()]
    .map(([type, value]) => ({
      type,
      name: ASSET_LABEL[type] ?? type,
      value,
      color: ASSET_COLORS[type] ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);

  // Diversification: based on number of asset types + Herfindahl on holdings.
  const hhi = enriched.reduce((s, h) => s + Math.pow(h.weight / 100, 2), 0);
  const effectiveHoldings = hhi > 0 ? 1 / hhi : 0;
  const typeBonus = Math.min(byType.length / 5, 1) * 30;
  const spreadScore = Math.min(effectiveHoldings / 10, 1) * 70;
  const diversificationScore = Math.round(Math.min(100, typeBonus + spreadScore));

  const concentrationRisk = enriched.length ? Math.round(enriched[0].weight) : 0;

  const pnlPct = invested > 0 ? ((current - invested) / invested) * 100 : 0;
  const returnScore = Math.max(0, Math.min(100, 50 + pnlPct * 2.5));
  const concentrationScore = Math.max(0, 100 - Math.max(0, concentrationRisk - 25) * 2);
  const healthScore = Math.round(
    diversificationScore * 0.4 + returnScore * 0.35 + concentrationScore * 0.25,
  );

  return {
    holdings: enriched,
    invested,
    current,
    pnl: current - invested,
    pnlPct,
    byType,
    diversificationScore,
    concentrationRisk,
    healthScore: Math.max(0, Math.min(100, healthScore)),
  };
}

export interface AdvisorAction {
  type: "Buy" | "Hold" | "Reduce" | "Rebalance" | "Increase SIP" | "Diversify";
  text: string;
  severity: "high" | "medium" | "low";
}

export function buildAdvisorActions(p: PortfolioSummary): AdvisorAction[] {
  const actions: AdvisorAction[] = [];
  if (p.holdings.length === 0) {
    return [{ type: "Buy", text: "Add your first holdings to unlock portfolio analysis.", severity: "high" }];
  }
  if (p.concentrationRisk > 35) {
    actions.push({
      type: "Reduce",
      text: `${p.holdings[0].name} is ${p.concentrationRisk}% of your portfolio — trim to reduce concentration risk.`,
      severity: "high",
    });
  }
  if (p.diversificationScore < 60) {
    actions.push({
      type: "Diversify",
      text: "Diversification is low. Add holdings across more asset classes to smooth volatility.",
      severity: "medium",
    });
  }
  const hasIntl = p.byType.some((t) => t.type === "etf");
  if (!hasIntl) {
    actions.push({
      type: "Diversify",
      text: "No international exposure detected. Consider a global / Nasdaq ETF for geographic diversification.",
      severity: "medium",
    });
  }
  const losers = p.holdings.filter((h) => h.pnlPct < -8);
  losers.forEach((h) =>
    actions.push({
      type: "Hold",
      text: `${h.name} is down ${Math.abs(h.pnlPct).toFixed(1)}% — review fundamentals before averaging.`,
      severity: "low",
    }),
  );
  const equityWeight = p.byType
    .filter((t) => t.type === "stock" || t.type === "mutual_fund" || t.type === "etf")
    .reduce((s, t) => s + t.value, 0);
  if (p.current > 0 && equityWeight / p.current < 0.5) {
    actions.push({ type: "Rebalance", text: "Equity allocation is below 50% — rebalance toward growth assets.", severity: "medium" });
  }
  actions.push({ type: "Increase SIP", text: "Step up SIPs by 10% at your next appraisal to accelerate compounding.", severity: "low" });
  return actions.slice(0, 6);
}

// ---- Mock market intelligence (illustrative) ----
export interface MarketItem {
  name: string;
  symbol: string;
  change: number; // %
  note: string;
}

export const MARKET_INDICES: MarketItem[] = [
  { name: "Nifty 50", symbol: "NIFTY", change: 0.82, note: "Banking & IT led gains" },
  { name: "Sensex", symbol: "BSE", change: 0.74, note: "Broad-based buying" },
  { name: "Nifty Bank", symbol: "BANKNIFTY", change: 1.21, note: "PSU banks outperform" },
  { name: "Nasdaq 100", symbol: "NDX", change: -0.34, note: "Tech cools after rally" },
  { name: "Gold (₹/g)", symbol: "GOLD", change: 0.45, note: "Safe-haven demand steady" },
];

export const MARKET_NEWS: { title: string; impact: "positive" | "negative" | "neutral"; source: string }[] = [
  { title: "RBI holds repo rate; signals stable outlook for borrowers", impact: "positive", source: "Markets Desk" },
  { title: "IT majors guide for stronger H2 on AI deal pipeline", impact: "positive", source: "Sector Watch" },
  { title: "Crude oil ticks up on supply concerns", impact: "negative", source: "Commodities" },
  { title: "Domestic mutual fund SIP inflows hit record high", impact: "positive", source: "AMFI" },
];

export interface WhatIfResult {
  years: number;
  corpus: number;
  invested: number;
  gains: number;
}

export function simulateSip(
  monthlySip: number,
  years: number,
  annualReturn: number,
  stepUpPct = 0,
  lumpSum = 0,
): WhatIfResult {
  const r = annualReturn / 12;
  let corpus = lumpSum;
  let sip = monthlySip;
  let invested = lumpSum;
  for (let y = 0; y < years; y++) {
    for (let m = 0; m < 12; m++) {
      corpus = corpus * (1 + r) + sip;
      invested += sip;
    }
    sip = sip * (1 + stepUpPct / 100);
  }
  return { years, corpus: Math.round(corpus), invested: Math.round(invested), gains: Math.round(corpus - invested) };
}

export function wealthScore(p: PortfolioSummary, monthlySip: number, monthlyIncome: number): number {
  const sipRate = monthlyIncome > 0 ? Math.min(1, monthlySip / (monthlyIncome * 0.3)) : 0;
  const sipScore = sipRate * 100;
  return Math.round(
    p.healthScore * 0.4 + p.diversificationScore * 0.25 + sipScore * 0.35,
  );
}
