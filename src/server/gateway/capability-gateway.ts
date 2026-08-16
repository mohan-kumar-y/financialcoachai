/**
 * Capability Gateway (HLD §11, LLD §3).
 *
 * The ONLY path from investment-brain.ts to any Engine. Enforces the
 * allow-list, per-run budgets (iterations / calls / wall-clock), and dedupes
 * identical requests within a run.
 *
 * Phase 1 allow-list: RULES_EVALUATE and PORTFOLIO_SNAPSHOT — both thin
 * wrappers over the existing advisor.ts logic. advisor.ts is wrapped, never
 * reimplemented, and is unreachable from the Brain except through here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  analyzePortfolio,
  buildAdvisorActions,
  type PortfolioSummary,
} from "@/lib/advisor";
import type { HoldingRow } from "@/lib/holdings.functions";
import type { CapabilityId, Evidence } from "@/server/contracts";

export interface CapabilityRequest {
  capability: CapabilityId;
  params: Record<string, unknown>;
  correlationId: string;
}

export interface CapabilityGatewayConfig {
  approvedCapabilities: CapabilityId[];
  maxIterations: number;
  maxCapabilityCalls: number;
  timeoutMs: number;
  tokenBudget: number;
}

export interface GatewayRunState {
  iterationsUsed: number;
  callsUsed: number;
  tokensUsed: number;
  startedAt: number;
  /** capability+params fingerprints already served in this run. */
  seen: Set<string>;
  log: {
    capability: CapabilityId;
    params: Record<string, unknown>;
    ok: boolean;
    error?: string;
    ms: number;
  }[];
}

export interface GatewayContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  /** Cached within a run so RULES_EVALUATE reuses the snapshot. */
  portfolioCache?: PortfolioSummary;
}

export type GatewayError =
  | "NOT_APPROVED"
  | "BUDGET_EXCEEDED"
  | "TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "DUPLICATE";

export type GatewayResult = { evidence: Evidence[] } | { error: GatewayError; detail?: string };

/**
 * Phase 1 defaults. The LLD specifies the shape of the budget, not the
 * numbers — these are conservative and tunable in one place.
 */
export const PHASE1_GATEWAY_CONFIG: CapabilityGatewayConfig = {
  approvedCapabilities: ["RULES_EVALUATE", "PORTFOLIO_SNAPSHOT"],
  maxIterations: 3,
  maxCapabilityCalls: 6,
  timeoutMs: 25_000,
  tokenBudget: 12_000,
};

export function createRunState(): GatewayRunState {
  return {
    iterationsUsed: 0,
    callsUsed: 0,
    tokensUsed: 0,
    startedAt: Date.now(),
    seen: new Set<string>(),
    log: [],
  };
}

function fingerprint(req: CapabilityRequest): string {
  return `${req.capability}:${JSON.stringify(req.params ?? {})}`;
}

function evidenceId(): string {
  return crypto.randomUUID();
}

async function loadHoldings(ctx: GatewayContext): Promise<HoldingRow[]> {
  const { data, error } = await ctx.supabase
    .from("holdings")
    .select("id, asset_type, name, symbol, units, avg_buy_price, current_price, category")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((h) => ({
    ...h,
    units: Number(h.units),
    avg_buy_price: Number(h.avg_buy_price),
    current_price: Number(h.current_price),
  })) as HoldingRow[];
}

async function portfolioSnapshot(ctx: GatewayContext): Promise<PortfolioSummary> {
  if (ctx.portfolioCache) return ctx.portfolioCache;
  const rows = await loadHoldings(ctx);
  // advisor.ts is the Portfolio Engine in Phase 1 — wrapped, not reimplemented.
  const summary = analyzePortfolio(rows);
  ctx.portfolioCache = summary;
  return summary;
}

const INR = (n: number) =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;

async function execute(
  req: CapabilityRequest,
  ctx: GatewayContext,
): Promise<Evidence[]> {
  const now = new Date().toISOString();

  if (req.capability === "PORTFOLIO_SNAPSHOT") {
    const p = await portfolioSnapshot(ctx);
    if (p.holdings.length === 0) {
      return [
        {
          id: evidenceId(),
          correlationId: req.correlationId,
          capability: "PORTFOLIO_SNAPSHOT",
          summary: "The user has no holdings recorded in WealthOS.",
          payload: { holdings: 0 },
          // Portfolio rows are user-entered; prices may be user-maintained.
          freshness: "FRESH",
          observedAt: now,
          source: "wealthos.holdings",
        },
      ];
    }
    return [
      {
        id: evidenceId(),
        correlationId: req.correlationId,
        capability: "PORTFOLIO_SNAPSHOT",
        summary: `Portfolio: ${p.holdings.length} holdings, current value ${INR(
          p.current,
        )}, invested ${INR(p.invested)}, P&L ${INR(p.pnl)} (${p.pnlPct.toFixed(
          1,
        )}%). Health ${p.healthScore}/100, diversification ${p.diversificationScore}/100, top-holding concentration ${p.concentrationRisk}%. Mix: ${p.byType
          .map((t) => `${t.name} ${((t.value / (p.current || 1)) * 100).toFixed(0)}%`)
          .join(", ")}.`,
        payload: {
          invested: p.invested,
          current: p.current,
          pnl: p.pnl,
          pnlPct: p.pnlPct,
          healthScore: p.healthScore,
          diversificationScore: p.diversificationScore,
          concentrationRisk: p.concentrationRisk,
          byType: p.byType.map((t) => ({ type: t.type, name: t.name, value: t.value })),
          holdings: p.holdings.map((h) => ({
            name: h.name,
            symbol: h.symbol,
            assetType: h.asset_type,
            units: h.units,
            avgBuyPrice: h.avg_buy_price,
            currentPrice: h.current_price,
            weightPct: Number(h.weight.toFixed(2)),
            pnlPct: Number(h.pnlPct.toFixed(2)),
          })),
        },
        freshness: "FRESH",
        observedAt: now,
        source: "advisor.analyzePortfolio",
      },
    ];
  }

  if (req.capability === "RULES_EVALUATE") {
    const p = await portfolioSnapshot(ctx);
    // Phase 3: the formal 12-category Rules Engine replaces the direct
    // advisor.buildAdvisorActions call. Capability id is unchanged.
    const evaluations = evaluateAll({ portfolio: p });
    return evaluations.map((e) => ({
      id: evidenceId(),
      correlationId: req.correlationId,
      capability: "RULES_EVALUATE" as const,
      summary: `Rule [${e.category}/${e.ruleId}, severity ${e.severity}, ${
        e.passed ? "passed" : "breached"
      }]: ${e.text}`,
      payload: {
        category: e.category,
        ruleId: e.ruleId,
        severity: e.severity,
        passed: e.passed,
        text: e.text,
      },
      freshness: "FRESH" as const,
      observedAt: now,
      source: "rules-engine.evaluateAll",
    }));
  }

  throw new Error(`Capability ${req.capability} has no Phase 1 implementation`);
}

export async function invoke(
  request: CapabilityRequest,
  config: CapabilityGatewayConfig,
  runState: GatewayRunState,
  ctx: GatewayContext,
): Promise<GatewayResult> {
  if (!config.approvedCapabilities.includes(request.capability)) {
    return { error: "NOT_APPROVED", detail: `${request.capability} is not on the allow-list` };
  }
  if (runState.callsUsed >= config.maxCapabilityCalls) {
    return { error: "BUDGET_EXCEEDED", detail: "max capability calls reached" };
  }
  if (Date.now() - runState.startedAt > config.timeoutMs) {
    return { error: "TIMEOUT", detail: "run wall-clock budget exhausted" };
  }

  const fp = fingerprint(request);
  if (runState.seen.has(fp)) {
    return { error: "DUPLICATE", detail: "identical capability request already served this run" };
  }

  const startedAt = Date.now();
  runState.callsUsed += 1;
  runState.seen.add(fp);

  const remaining = Math.max(1_000, config.timeoutMs - (startedAt - runState.startedAt));
  try {
    const evidence = await Promise.race([
      execute(request, ctx),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("__CAPABILITY_TIMEOUT__")), remaining),
      ),
    ]);
    runState.log.push({
      capability: request.capability,
      params: request.params ?? {},
      ok: true,
      ms: Date.now() - startedAt,
    });
    return { evidence };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    runState.log.push({
      capability: request.capability,
      params: request.params ?? {},
      ok: false,
      error: message,
      ms: Date.now() - startedAt,
    });
    if (message === "__CAPABILITY_TIMEOUT__") return { error: "TIMEOUT", detail: message };
    return { error: "PROVIDER_UNAVAILABLE", detail: message };
  }
}
