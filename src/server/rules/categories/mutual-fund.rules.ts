import type { RuleContext, RuleEvaluation } from "../types";

export function evaluate(ctx: RuleContext): RuleEvaluation[] {
  const p = ctx.portfolio;
  const mf = p.holdings.filter((h) => h.asset_type === "mutual_fund");
  const out: RuleEvaluation[] = [];

  const mfValue = mf.reduce((s, h) => s + h.current, 0);
  const mfPct = p.current > 0 ? (mfValue / p.current) * 100 : 0;

  out.push({
    category: "MUTUAL_FUND",
    ruleId: "MUTUAL_FUND.PRESENT",
    severity: "low",
    passed: mf.length > 0,
    text:
      mf.length > 0
        ? `${mf.length} mutual fund holding(s), ${mfPct.toFixed(0)}% of the portfolio.`
        : "No mutual fund holdings — a core index/flexi-cap fund is the usual base layer.",
  });

  out.push({
    category: "MUTUAL_FUND",
    ruleId: "MUTUAL_FUND.SCHEME_COUNT",
    severity: "low",
    passed: mf.length <= 8,
    text:
      mf.length > 8
        ? `${mf.length} schemes held — overlap and duplication risk rises beyond ~8 schemes.`
        : "Scheme count is within a manageable range.",
  });

  out.push({
    category: "MUTUAL_FUND",
    ruleId: "MUTUAL_FUND.OVERLAP",
    severity: "low",
    passed: true,
    text: "Portfolio-overlap rule not evaluated — scheme holdings data is not yet in the MIP (see Phase 5).",
  });

  return out;
}
