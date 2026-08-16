import type { RuleContext, RuleEvaluation } from "../types";

export function evaluate(ctx: RuleContext): RuleEvaluation[] {
  const out: RuleEvaluation[] = [
    {
      category: "SIP",
      ruleId: "SIP.ANNUAL_STEP_UP",
      severity: "low",
      passed: false,
      text: "Step up SIPs by ~10% at the next appraisal to keep contributions ahead of income growth.",
    },
  ];

  if (ctx.monthlyIncome && ctx.currentSip !== undefined) {
    const rate = ctx.monthlyIncome > 0 ? (ctx.currentSip / ctx.monthlyIncome) * 100 : 0;
    out.push({
      category: "SIP",
      ruleId: "SIP.RATE_MIN_20",
      severity: "medium",
      passed: rate >= 20,
      text: `Monthly SIP is ${rate.toFixed(0)}% of income (target ≥ 20%).`,
    });
  } else {
    out.push({
      category: "SIP",
      ruleId: "SIP.RATE_MIN_20",
      severity: "low",
      passed: true,
      text: "SIP-vs-income rule skipped — income/SIP not supplied in this run's context.",
    });
  }

  return out;
}
