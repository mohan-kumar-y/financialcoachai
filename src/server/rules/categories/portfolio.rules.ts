import type { RuleContext, RuleEvaluation } from "../types";

export function evaluate(ctx: RuleContext): RuleEvaluation[] {
  const p = ctx.portfolio;
  const out: RuleEvaluation[] = [];

  if (p.holdings.length === 0) {
    return [
      {
        category: "PORTFOLIO",
        ruleId: "PORTFOLIO.EMPTY",
        severity: "high",
        passed: false,
        text: "No holdings recorded — portfolio analysis cannot run until holdings are added.",
      },
    ];
  }

  const breached = p.concentrationRisk > 35;
  out.push({
    category: "PORTFOLIO",
    ruleId: "PORTFOLIO.CONCENTRATION_35",
    severity: "high",
    passed: !breached,
    text: breached
      ? `${p.holdings[0].name} is ${p.concentrationRisk}% of the portfolio (limit 35%) — concentration risk.`
      : `Top holding concentration is ${p.concentrationRisk}%, within the 35% limit.`,
  });

  out.push({
    category: "PORTFOLIO",
    ruleId: "PORTFOLIO.HEALTH_SCORE",
    severity: "medium",
    passed: p.healthScore >= 60,
    text: `Portfolio health score is ${p.healthScore}/100 (target ≥ 60).`,
  });

  return out;
}
