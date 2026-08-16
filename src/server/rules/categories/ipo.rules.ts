import type { RuleContext, RuleEvaluation } from "../types";
import { insufficientData } from "../types";

export function evaluate(_ctx: RuleContext): RuleEvaluation[] {
  return [
    insufficientData(
      "IPO",
      "IPO.ELIGIBILITY",
      "IPO rules not evaluated — no active IPO application/allocation data in context (insufficient data — see Phase 5 IPO feed).",
    ),
  ];
}
