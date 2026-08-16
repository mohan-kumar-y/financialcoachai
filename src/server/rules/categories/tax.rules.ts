import type { RuleContext, RuleEvaluation } from "../types";
import { insufficientData } from "../types";

export function evaluate(_ctx: RuleContext): RuleEvaluation[] {
  // holdings has no purchase-date column (only created_at on the row, which is
  // when the user entered it, not when the lot was bought), so LTCG/STCG
  // holding-period classification cannot be computed without fabricating dates.
  return [
    insufficientData(
      "TAX",
      "TAX.LTCG_STCG_HOLDING_PERIOD",
      "LTCG/STCG rules not evaluated — holdings carry no reliable purchase date (insufficient data — see Phase 10 lot-level tracking).",
    ),
  ];
}
