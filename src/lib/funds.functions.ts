import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeFund,
  type FundSearchItem,
  type MutualFundData,
  type DataMeta,
} from "@/lib/market-data";
import { MF_SOURCE } from "@/lib/providers";

const searchInput = z.object({ query: z.string().min(2).max(60) });
const schemeInput = z.object({ schemeCode: z.union([z.number(), z.string()]) });

// ---- Live mutual-fund search (mfapi.in / AMFI) -----------------------------
export const searchFunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => searchInput.parse(i))
  .handler(async ({ data }): Promise<{ results: FundSearchItem[]; source: string }> => {
    const { mfProvider } = await import("@/lib/mf-data.server");
    const results = await mfProvider.search(data.query);
    return { results, source: MF_SOURCE };
  });

// ---- Latest NAV + scheme details for one fund ------------------------------
export interface FundResult {
  fund: MutualFundData;
  meta: DataMeta;
}

export const getFund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schemeInput.parse(i))
  .handler(async ({ data }): Promise<FundResult> => {
    const { mfProvider } = await import("@/lib/mf-data.server");
    const res = await mfProvider.scheme(data.schemeCode);
    return {
      fund: normalizeFund(res.payload),
      meta: { source: res.source, fetchedAt: res.fetchedAt, status: res.status },
    };
  });
