/** Shared types for the 12-category Rules Engine (LLD §11). */
import type { PortfolioSummary } from "@/lib/advisor";

export const RULE_CATEGORIES = [
  "PORTFOLIO",
  "RISK",
  "ALLOCATION",
  "CASH_MANAGEMENT",
  "STOCK",
  "COMPLIANCE",
  "TRADING",
  "MUTUAL_FUND",
  "ETF",
  "SIP",
  "IPO",
  "TAX",
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export interface RuleContext {
  /** Deterministic portfolio snapshot from advisor.analyzePortfolio. */
  portfolio: PortfolioSummary;
  /** Optional plan context when the caller has it; never fabricated. */
  monthlyIncome?: number;
  currentSip?: number;
  now?: Date;
  /** Phase 10: owner of the portfolio being evaluated. */
  userId?: string;
  /**
   * Phase 10: the user's stated risk tolerance from user_preferences, loaded
   * by the caller (rules stay synchronous/pure). null/undefined = never set —
   * RISK rules then report insufficient data rather than assume a default.
   */
  riskTolerance?: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | null;
}

export interface RuleEvaluation {
  category: RuleCategory;
  ruleId: string;
  severity: "high" | "medium" | "low";
  passed: boolean;
  text: string;
}

/** Helper for categories with no data source yet — explicit, never fabricated. */
export function insufficientData(
  category: RuleCategory,
  ruleId: string,
  text: string,
): RuleEvaluation {
  return { category, ruleId, severity: "low", passed: true, text };
}
