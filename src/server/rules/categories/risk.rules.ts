import type { RuleContext, RuleEvaluation } from "../types";
import { insufficientData } from "../types";

export function evaluate(_ctx: RuleContext): RuleEvaluation[] {
  return [
    insufficientData(
      "RISK",
      "RISK.TOLERANCE_ALIGNMENT",
      "Risk-tolerance alignment not evaluated — no stored user risk profile yet (insufficient data — see Phase 10 user_preferences).",
    ),
  ];
}
