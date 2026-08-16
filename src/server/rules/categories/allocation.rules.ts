import type { RuleContext, RuleEvaluation } from "../types";

export function evaluate(ctx: RuleContext): RuleEvaluation[] {
  const p = ctx.portfolio;
  if (p.holdings.length === 0) return [];
  const out: RuleEvaluation[] = [];

  out.push({
    category: "ALLOCATION",
    ruleId: "ALLOCATION.DIVERSIFICATION_60",
    severity: "medium",
    passed: p.diversificationScore >= 60,
    text:
      p.diversificationScore >= 60
        ? `Diversification score ${p.diversificationScore}/100 is acceptable.`
        : `Diversification score is ${p.diversificationScore}/100 (target ≥ 60) — spread across more asset classes.`,
  });

  const hasEtf = p.byType.some((t) => t.type === "etf");
  out.push({
    category: "ALLOCATION",
    ruleId: "ALLOCATION.INTERNATIONAL_EXPOSURE",
    severity: "medium",
    passed: hasEtf,
    text: hasEtf
      ? "ETF exposure present — geographic/index diversification available."
      : "No ETF exposure detected — a global / index ETF would add geographic diversification.",
  });

  const equityValue = p.byType
    .filter((t) => t.type === "stock" || t.type === "mutual_fund" || t.type === "etf")
    .reduce((s, t) => s + t.value, 0);
  const equityPct = p.current > 0 ? (equityValue / p.current) * 100 : 0;
  out.push({
    category: "ALLOCATION",
    ruleId: "ALLOCATION.EQUITY_MIN_50",
    severity: "medium",
    passed: equityPct >= 50,
    text: `Equity allocation is ${equityPct.toFixed(0)}% of the portfolio (floor 50%).`,
  });

  return out;
}
