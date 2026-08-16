import type { RuleContext, RuleEvaluation } from "../types";
import { insufficientData } from "../types";

export function evaluate(_ctx: RuleContext): RuleEvaluation[] {
  return [
    insufficientData(
      "CASH_MANAGEMENT",
      "CASH_MANAGEMENT.BUFFER",
      "Cash-buffer rule not evaluated — no linked bank/broker cash balance data (insufficient data — see Phase 10).",
    ),
  ];
}
