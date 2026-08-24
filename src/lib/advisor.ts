// Advisor-level composition for the Financial Advisor (AI Wealth Coach) module.
//
// Phase 4: core portfolio scoring (analyzePortfolio + its types and the asset
// taxonomy constants) moved to the Portfolio Engine in
// "@/lib/portfolio-engine". This file re-exports them unchanged so every
// existing "@/lib/advisor" import keeps working.
export {
  ASSET_TYPES,
  ASSET_LABEL,
  ASSET_COLORS,
  analyzePortfolio,
} from "@/lib/portfolio-engine";
export type { HoldingComputed, PortfolioSummary } from "@/lib/portfolio-engine";

import type { PortfolioSummary } from "@/lib/portfolio-engine";

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

// Market indices/news are fetched live via getTrending + getMarketNews server
// functions (see src/lib/market-data.functions.ts). No static market
// intelligence lives here — the "never fabricate" rule applies.
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
