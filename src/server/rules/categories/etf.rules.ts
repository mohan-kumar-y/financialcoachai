import type { RuleContext, RuleEvaluation } from "../types";

export function evaluate(ctx: RuleContext): RuleEvaluation[] {
  const p = ctx.portfolio;
  const etf = p.holdings.filter((h) => h.asset_type === "etf");
  const etfValue = etf.reduce((s, h) => s + h.current, 0);
  const etfPct = p.current > 0 ? (etfValue / p.current) * 100 : 0;

  return [
    {
      category: "ETF",
      ruleId: "ETF.CORE_EXPOSURE",
      severity: "low",
      passed: etf.length > 0,
      text:
        etf.length > 0
          ? `${etf.length} ETF holding(s), ${etfPct.toFixed(0)}% of the portfolio.`
          : "No ETF holdings — index ETFs are the cheapest way to hold broad-market beta.",
    },
    {
      category: "ETF",
      ruleId: "ETF.LIQUIDITY_TRACKING_ERROR",
      severity: "low",
      passed: true,
      text: "ETF liquidity / tracking-error rule not evaluated — iNAV and volume feeds are not wired yet (see Phase 5).",
    },
  ];
}
