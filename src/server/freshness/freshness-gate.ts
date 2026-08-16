/**
 * Data Freshness Gate (HLD §19 / LLD §6).
 *
 * Pure classification of an observation timestamp against a policy's three
 * thresholds. No I/O, no clock injection beyond `now` for testability.
 */

export type Freshness = "LIVE" | "FRESH" | "STALE" | "EXPIRED";

export type StrategyId = "INTRADAY" | "SWING" | "LONG_TERM";

export interface FreshnessPolicy {
  dataType: "QUOTE" | "NAV" | "FUNDAMENTAL" | "NEWS" | "CORP_ACTION";
  strategy?: StrategyId;
  liveThresholdSec: number;
  freshThresholdSec: number;
  staleThresholdSec: number;
}

export const DEFAULT_POLICIES: FreshnessPolicy[] = [
  { dataType: "QUOTE", strategy: "INTRADAY", liveThresholdSec: 90, freshThresholdSec: 180, staleThresholdSec: 600 },
  { dataType: "QUOTE", strategy: "SWING", liveThresholdSec: 300, freshThresholdSec: 900, staleThresholdSec: 3600 },
  { dataType: "QUOTE", strategy: "LONG_TERM", liveThresholdSec: 3600, freshThresholdSec: 86400, staleThresholdSec: 259200 },
  { dataType: "NAV", liveThresholdSec: 86400, freshThresholdSec: 259200, staleThresholdSec: 604800 },
];

/** Look up the policy for a data type (+ strategy where applicable). */
export function policyFor(
  dataType: FreshnessPolicy["dataType"],
  strategy?: StrategyId,
): FreshnessPolicy | undefined {
  return (
    DEFAULT_POLICIES.find((p) => p.dataType === dataType && p.strategy === strategy) ??
    DEFAULT_POLICIES.find((p) => p.dataType === dataType)
  );
}

/**
 * Classify an observation. Elapsed seconds are compared against the policy's
 * thresholds in order; anything beyond staleThresholdSec is EXPIRED.
 * A timestamp in the future is treated as LIVE (clock skew), never fabricated.
 */
export function classify(observedAt: Date, policy: FreshnessPolicy, now: Date = new Date()): Freshness {
  const elapsedSec = (now.getTime() - observedAt.getTime()) / 1000;
  if (!Number.isFinite(elapsedSec)) return "EXPIRED";
  if (elapsedSec <= policy.liveThresholdSec) return "LIVE";
  if (elapsedSec <= policy.freshThresholdSec) return "FRESH";
  if (elapsedSec <= policy.staleThresholdSec) return "STALE";
  return "EXPIRED";
}
