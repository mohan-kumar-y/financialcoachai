/**
 * Portfolio Engine (LLD §11) — deterministic portfolio scoring. [ENGINE]
 *
 * Extracted verbatim from advisor.ts (wrap, don't reimplement): analyzePortfolio
 * plus its supporting types and asset-taxonomy constants. advisor.ts now
 * re-exports these for backward compatibility, so no other import path changed.
 *
 * NOTE ON LOCATION: this lives in src/lib/, not src/server/portfolio/, because
 * the build enforces client import protection on any path under src/server.
 * Portfolio scoring is pure math consumed by both server engines (Capability
 * Gateway) and client routes, so it must sit in a client-safe module path.
 */
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
