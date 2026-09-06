/**
 * Shared Signal contract (LLD §7).
 *
 * Every signal engine emits this exact shape so aggregation, calibration and
 * probability can consume them uniformly. Engines that have no data source yet
 * simply never emit — nothing here fabricates a direction.
 */

export type SignalEngine =
  | "TECHNICAL"
  | "FUNDAMENTAL"
  | "VALUATION"
  | "SENTIMENT"
  | "CORPORATE_ACTION"
  | "DERIVATIVES"
  | "INSTITUTIONAL_FLOW"
  | "LIQUIDITY"
  | "SECTOR"
  | "MACRO";

export interface Signal {
  engine: SignalEngine;
  symbol: string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  /** 0-1: how emphatic the reading is. */
  strength: number;
  /** 0-1: how much the engine trusts its own reading given data coverage. */
  confidence: number;
  /** Plain-language, traceable statements. Never marketing copy. */
  evidence: string[];
  observedAt: string;
  source: string;
}

/** Clamp helper shared by the engines. */
export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
