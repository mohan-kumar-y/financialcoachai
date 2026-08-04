/**
 * Shared contracts for the WealthOS agentic core (HLD v8.2 / LLD §3-§5, §14).
 *
 * Phase 1 scope: only the types actually exercised by the Capability Gateway,
 * Investment Brain, Decision Validator and Explanation Engine. Later phases
 * extend these unions (more capabilities, more signals) without redesign.
 */

export type CapabilityId =
  | "RESEARCH_TECHNICAL"
  | "RESEARCH_FUNDAMENTAL"
  | "RESEARCH_VALUATION"
  | "RESEARCH_LIQUIDITY"
  | "RESEARCH_DERIVATIVES"
  | "RESEARCH_INSTITUTIONAL"
  | "RESEARCH_SECTOR"
  | "RESEARCH_MACRO"
  | "EVENTS_EARNINGS"
  | "EVENTS_FILINGS"
  | "EVENTS_CORP_ACTION"
  | "EVENTS_NEWS"
  | "PORTFOLIO_SNAPSHOT"
  | "RULES_EVALUATE"
  | "STRATEGY_GET"
  | "DISCOVERY_SCREEN"
  | "WATCHLIST_QUERY";

export type TriggerType =
  | "MANUAL"
  | "SCHEDULED"
  | "MARKET_OPEN"
  | "MARKET_CLOSE"
  | "EARNINGS"
  | "IPO_OPEN"
  | "PORTFOLIO_CHANGE"
  | "WATCHLIST_CHANGE"
  | "MARKET_CRASH";

/** LLD §6 — full gate lands in Phase 3; the label is carried from day one. */
export type Freshness = "LIVE" | "FRESH" | "STALE" | "EXPIRED";

export interface Evidence {
  id: string;
  correlationId: string;
  capability: CapabilityId;
  /** Short human-readable claim the Brain can reason over. */
  summary: string;
  /** Structured payload (never sent verbatim to the user). */
  payload: unknown;
  freshness: Freshness;
  observedAt: string;
  source: string;
}

export type DecisionAction =
  | "BUY"
  | "SELL"
  | "HOLD"
  | "TOP_UP"
  | "REDUCE"
  | "REBALANCE"
  | "BOOK_PROFITS"
  | "INCREASE_SIP"
  | "PAUSE_SIP"
  | "LUMPSUM"
  | "APPLY_IPO"
  | "AVOID_IPO"
  | "WATCHLIST_ADD"
  | "WATCHLIST_REMOVE"
  | "NO_ACTION"
  | "INSUFFICIENT_DATA";

/** What the Brain proposes — never returned to a caller unvalidated (LLD §4). */
export interface DraftDecision {
  correlationId: string;
  instrument: string | null;
  strategy: string | null;
  action: DecisionAction;
  /** 0-100 */
  confidence: number;
  thesis: string;
  counterThesis: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  risks: string[];
  invalidationConditions: string[];
  missingEvidence: string[];
  timeHorizon: string | null;
  monitoringPlan: string | null;
  /** Reserved — nothing writes trade_proposals in this phase (LLD §17). */
  executionProposal: null;
  brainVersion: string;
}

export type ValidationResult = "PASSED" | "NO_ACTION" | "INSUFFICIENT_DATA";

export interface Decision extends DraftDecision {
  validationResult: ValidationResult;
}

/** HLD §26 Explainability Contract — every field required from day one. */
export interface Explanation {
  whatHappened: string;
  whyItMatters: string;
  evidence: string[];
  thesis: string;
  counterThesis: string;
  portfolioImpact: string;
  recommendation: string;
  risks: string[];
  whatWouldChangeOurView: string[];
  confidence: number;
}

export const BRAIN_VERSION = "brain-1.0.0-phase1";
export const PROMPT_VERSION = "wealthos-prompts-2026-08-01";
