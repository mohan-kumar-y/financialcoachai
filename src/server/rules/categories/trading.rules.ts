import type { RuleContext, RuleEvaluation } from "../types";
import { insufficientData } from "../types";

export function evaluate(_ctx: RuleContext): RuleEvaluation[] {
  return [
    insufficientData(
      "TRADING",
      "TRADING.CHURN_AND_LIMITS",
      "Trading rules not evaluated — no trade log exists yet (insufficient data — see Phase 14 execution).",
    ),
  ];
}
