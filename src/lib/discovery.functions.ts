// Stock Discovery Center — thin server-function wrapper.
//
// Phase 9: the screening logic itself now lives in
// src/server/discovery/discovery-engine.ts (extract, don't duplicate), so the
// Capability Gateway and the scheduled Daily Brief can reuse it. This file
// keeps the shared types (client-safe) and the authenticated entry point.
// The engine is imported INSIDE the handler — src/server/* is blocked from
// client bundles, and this module is imported by the Discovery page.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DataMeta } from "@/lib/market-data";
import type { CapTier, RiskRating, DiscoveryTag } from "@/lib/market";

export interface DiscoveryIdea {
  symbol: string;
  name: string;
  sector: string;
  cap: CapTier;
  price: number;
  changePct: number | null;
  marketCap: number | null;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  debtEquity: number | null;
  dividendYield: number | null;
  netProfitMargin: number | null;
  risk: RiskRating;
  thesis: string;
}

export interface DiscoverySectorRow {
  name: string;
  changePct: number; // avg across sector
  pe: number | null; // avg where available
  count: number;
  leader: string;
  leaderChangePct: number;
  momentum: "Strong" | "Neutral" | "Weak";
}

export interface DiscoveryResult {
  screens: Record<DiscoveryTag, DiscoveryIdea[]>;
  sectors: DiscoverySectorRow[];
  meta: DataMeta;
  universeSize: number;
  covered: number;
}

export interface DiscoveryContextResult {
  newIdeas: Record<DiscoveryTag, DiscoveryIdea[]>;
  alreadyTracking: DiscoveryIdea[];
  meta: DataMeta;
}

export const getDiscoveryScreens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<DiscoveryResult> => {
    const { computeScreens } = await import("@/server/discovery/discovery-engine");
    return computeScreens();
  });

/**
 * Same screens, partitioned against what the signed-in user already holds or
 * watches — so "new ideas" means new.
 */
export const getDiscoveryForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiscoveryContextResult> => {
    const { getDiscoveryWithContext } = await import("@/server/discovery/discovery-engine");
    return getDiscoveryWithContext(context.userId, context.supabase);
  });

