import type { RuleContext, RuleEvaluation } from "../types";

export function evaluate(ctx: RuleContext): RuleEvaluation[] {
  const p = ctx.portfolio;
  const stocks = p.holdings.filter((h) => h.asset_type === "stock");
  if (stocks.length === 0) {
    return [
      {
        category: "STOCK",
        ruleId: "STOCK.NO_DIRECT_EQUITY",
        severity: "low",
        passed: true,
        text: "No direct equity holdings — stock-level rules do not apply.",
      },
    ];
  }

  const losers = p.holdings.filter((h) => h.pnlPct < -8);
  if (losers.length === 0) {
    return [
      {
        category: "STOCK",
        ruleId: "STOCK.DRAWDOWN_8",
        severity: "low",
        passed: true,
        text: "No holding is down more than 8% from cost.",
      },
    ];
  }

  return losers.map((h) => ({
    category: "STOCK" as const,
    ruleId: `STOCK.DRAWDOWN_8:${h.symbol ?? h.name}`,
    severity: "low" as const,
    passed: false,
    text: `${h.name} is down ${Math.abs(h.pnlPct).toFixed(1)}% from cost — review fundamentals before averaging down.`,
  }));
}
