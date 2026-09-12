/**
 * Strategy Registry (LLD §11) — deterministic [ENGINE], no LLM.
 *
 * Loads strategy packs from public.strategies. A missing pack is a config gap,
 * not a transient data issue, so it throws loudly instead of silently falling
 * back to DEFAULT_STRATEGY. Callers that choose to degrade must do so
 * explicitly and log it.
 *
 * Seeded weights only cover TECHNICAL and FUNDAMENTAL — the only signal
 * engines that exist today. Revisit once Phase 9/11 add more engines.
 */
import type { SignalEngine } from "@/server/signals/signal-types";
import type { StrategyPack } from "@/server/aggregation/signal-aggregation";

export type { StrategyPack };

export const STRATEGY_IDS = [
  "LONG_TERM",
  "SWING",
  "INTRADAY",
  "ETF",
  "MUTUAL_FUND",
  "SIP",
  "IPO",
  "PORTFOLIO_REVIEW",
] as const;

export type StrategyId = (typeof STRATEGY_IDS)[number];

export class StrategyNotFoundError extends Error {
  constructor(
    readonly strategyId: string,
    readonly cause?: string,
  ) {
    super(
      `Strategy pack "${strategyId}" could not be loaded from public.strategies${cause ? `: ${cause}` : " (no row)"}`,
    );
    this.name = "StrategyNotFoundError";
  }
}

export const isStrategyId = (id: string): id is StrategyId =>
  (STRATEGY_IDS as readonly string[]).includes(id);

const VALID_ENGINES = new Set<string>([
  "TECHNICAL",
  "FUNDAMENTAL",
  "VALUATION",
  "SENTIMENT",
  "CORPORATE_ACTION",
  "DERIVATIVES",
  "INSTITUTIONAL_FLOW",
  "LIQUIDITY",
  "SECTOR",
  "MACRO",
]);

function parseWeights(raw: unknown): Partial<Record<SignalEngine, number>> {
  const out: Partial<Record<SignalEngine, number>> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (VALID_ENGINES.has(k) && typeof v === "number" && Number.isFinite(v)) {
        out[k as SignalEngine] = v;
      }
    }
  }
  return out;
}

function parseThresholds(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
  }
  return out;
}

/** Short-lived in-process cache — packs are config and change rarely. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<StrategyId, { pack: StrategyPack; at: number }>();

export async function getStrategy(id: StrategyId): Promise<StrategyPack> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.pack;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("strategies")
    .select("id, signal_weights, thresholds, horizon, risk_profile")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new StrategyNotFoundError(id, error.message);
  if (!data) throw new StrategyNotFoundError(id);

  const pack: StrategyPack = {
    id: data.id,
    signalWeights: parseWeights(data.signal_weights),
    thresholds: parseThresholds(data.thresholds),
    horizon: data.horizon,
    riskProfile: data.risk_profile,
  };

  if (Object.keys(pack.signalWeights).length === 0) {
    throw new StrategyNotFoundError(id, "pack has no usable signal weights");
  }

  cache.set(id, { pack, at: Date.now() });
  return pack;
}

/**
 * Explicit degradation helper: use a real pack when available, otherwise fall
 * back to equal weights and log why. Never silent.
 */
export async function getStrategyOrFallback(id: StrategyId): Promise<StrategyPack> {
  const { DEFAULT_STRATEGY } = await import("@/server/aggregation/signal-aggregation");
  try {
    return await getStrategy(id);
  } catch (err) {
    console.warn(
      `[strategy-registry] falling back to DEFAULT_STRATEGY for "${id}": ${(err as Error).message}`,
    );
    return DEFAULT_STRATEGY;
  }
}
