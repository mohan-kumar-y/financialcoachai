/**
 * RISK category (Phase 10) — deterministic, no LLM.
 * Compares the portfolio's equity weight and top-holding concentration with
 * the user's STATED risk tolerance. Mismatches are informational (low/medium),
 * never alarming. No stated tolerance → insufficient data, no assumed default.
 */
import type { RuleContext, RuleEvaluation } from "../types";
import { insufficientData } from "../types";

/** Equity-weight bands per tolerance (judgment call, human-reviewed). */
const BANDS = {
  CONSERVATIVE: { maxEquity: 70, minEquity: 0, maxConcentration: 20 },
  MODERATE: { maxEquity: 85, minEquity: 40, maxConcentration: 30 },
  AGGRESSIVE: { maxEquity: 100, minEquity: 30, maxConcentration: 40 },
} as const;

export function evaluate(ctx: RuleContext): RuleEvaluation[] {
  const tol = ctx.riskTolerance;
  if (!tol) {
    return [
      insufficientData(
        "RISK",
        "RISK.TOLERANCE_ALIGNMENT",
        "Risk-tolerance alignment not evaluated — you haven't set a risk tolerance in Settings yet (insufficient data).",
      ),
    ];
  }
  const p = ctx.portfolio;
  if (p.current <= 0) {
    return [insufficientData("RISK", "RISK.TOLERANCE_ALIGNMENT", "No portfolio value to compare against your risk tolerance.")];
  }

  const equityValue = p.byType
    .filter((t) => t.type === "stock" || t.type === "mutual_fund" || t.type === "etf")
    .reduce((s, t) => s + t.value, 0);
  const equityPct = (equityValue / p.current) * 100;
  const band = BANDS[tol];
  const label = tol.toLowerCase();
  const out: RuleEvaluation[] = [];

  const tooHigh = equityPct > band.maxEquity;
  const tooLow = equityPct < band.minEquity;
  out.push({
    category: "RISK",
    ruleId: "RISK.EQUITY_WEIGHT_VS_TOLERANCE",
    severity: tooHigh && tol === "CONSERVATIVE" ? "medium" : "low",
    passed: !tooHigh && !tooLow,
    text: tooHigh
      ? `Equity is ${equityPct.toFixed(0)}% of the portfolio, above the ~${band.maxEquity}% that usually suits a ${label} risk tolerance.`
      : tooLow
        ? `Equity is ${equityPct.toFixed(0)}% of the portfolio, below the ~${band.minEquity}% typical for a ${label} risk tolerance — informational only.`
        : `Equity weight ${equityPct.toFixed(0)}% is consistent with your ${label} risk tolerance.`,
  });

  const conc = p.concentrationRisk;
  out.push({
    category: "RISK",
    ruleId: "RISK.CONCENTRATION_VS_TOLERANCE",
    severity: "low",
    passed: conc <= band.maxConcentration,
    text:
      conc > band.maxConcentration
        ? `Largest holding is ${conc.toFixed(0)}% of the portfolio, above the ~${band.maxConcentration}% single-position limit for a ${label} tolerance.`
        : `Largest holding (${conc.toFixed(0)}%) is within the ~${band.maxConcentration}% limit for a ${label} tolerance.`,
  });
  return out;
}
