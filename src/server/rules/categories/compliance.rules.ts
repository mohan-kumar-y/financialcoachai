import type { RuleContext, RuleEvaluation } from "../types";
import { insufficientData } from "../types";

export function evaluate(_ctx: RuleContext): RuleEvaluation[] {
  return [
    insufficientData(
      "COMPLIANCE",
      "COMPLIANCE.ADVISORY_SCOPE",
      "Compliance rules not evaluated — deliberately deferred (low priority per docs/04-Addendum-DataSourceTiers-Compliance.md).",
    ),
  ];
}
