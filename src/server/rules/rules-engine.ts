/**
 * Rules Engine (LLD §11) — deterministic, no LLM.
 *
 * Twelve categories, one module each. `evaluate` dispatches to a category;
 * `evaluateAll` runs all twelve. Categories with no data source yet return an
 * explicit "insufficient data" evaluation rather than a fabricated verdict.
 */
import { RULE_CATEGORIES, type RuleCategory, type RuleContext, type RuleEvaluation } from "./types";
import { evaluate as portfolio } from "./categories/portfolio.rules";
import { evaluate as risk } from "./categories/risk.rules";
import { evaluate as allocation } from "./categories/allocation.rules";
import { evaluate as cashManagement } from "./categories/cash-management.rules";
import { evaluate as stock } from "./categories/stock.rules";
import { evaluate as compliance } from "./categories/compliance.rules";
import { evaluate as trading } from "./categories/trading.rules";
import { evaluate as mutualFund } from "./categories/mutual-fund.rules";
import { evaluate as etf } from "./categories/etf.rules";
import { evaluate as sip } from "./categories/sip.rules";
import { evaluate as ipo } from "./categories/ipo.rules";
import { evaluate as tax } from "./categories/tax.rules";

export { RULE_CATEGORIES };
export type { RuleCategory, RuleContext, RuleEvaluation };

const REGISTRY: Record<RuleCategory, (ctx: RuleContext) => RuleEvaluation[]> = {
  PORTFOLIO: portfolio,
  RISK: risk,
  ALLOCATION: allocation,
  CASH_MANAGEMENT: cashManagement,
  STOCK: stock,
  COMPLIANCE: compliance,
  TRADING: trading,
  MUTUAL_FUND: mutualFund,
  ETF: etf,
  SIP: sip,
  IPO: ipo,
  TAX: tax,
};

export function evaluate(category: RuleCategory, context: RuleContext): RuleEvaluation[] {
  return REGISTRY[category](context);
}

export function evaluateAll(context: RuleContext): RuleEvaluation[] {
  return RULE_CATEGORIES.flatMap((c) => evaluate(c, context));
}
