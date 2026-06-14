import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const holdingInput = z.object({
  asset_type: z.string().min(1).max(30),
  name: z.string().min(1).max(80),
  symbol: z.string().max(30).nullable().optional(),
  units: z.number().min(0).max(1e9),
  avg_buy_price: z.number().min(0).max(1e9),
  current_price: z.number().min(0).max(1e9),
  category: z.string().max(40).nullable().optional(),
});

const updateInput = holdingInput.extend({ id: z.string().uuid() });

export interface HoldingRow {
  id: string;
  asset_type: string;
  name: string;
  symbol: string | null;
  units: number;
  avg_buy_price: number;
  current_price: number;
  category: string | null;
}

export const listHoldings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("holdings")
      .select("id, asset_type, name, symbol, units, avg_buy_price, current_price, category")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return {
      holdings: (data ?? []).map((h) => ({
        ...h,
        units: Number(h.units),
        avg_buy_price: Number(h.avg_buy_price),
        current_price: Number(h.current_price),
      })) as HoldingRow[],
    };
  });

export const createHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => holdingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("holdings").insert({
      user_id: userId,
      asset_type: data.asset_type,
      name: data.name,
      symbol: data.symbol ?? null,
      units: data.units,
      avg_buy_price: data.avg_buy_price,
      current_price: data.current_price,
      category: data.category ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const { error } = await supabase
      .from("holdings")
      .update({
        asset_type: rest.asset_type,
        name: rest.name,
        symbol: rest.symbol ?? null,
        units: rest.units,
        avg_buy_price: rest.avg_buy_price,
        current_price: rest.current_price,
        category: rest.category ?? null,
      })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHolding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("holdings")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedDemoHoldings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("holdings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) > 0) return { ok: true, seeded: 0 };

    const rows = [
      { asset_type: "mutual_fund", name: "Nifty 50 Index Fund", symbol: "NIFTY50", units: 1200, avg_buy_price: 180, current_price: 232, category: "Large Cap" },
      { asset_type: "mutual_fund", name: "Flexi Cap Fund", symbol: "FLEXI", units: 850, avg_buy_price: 95, current_price: 121, category: "Flexi Cap" },
      { asset_type: "mutual_fund", name: "Small Cap Fund", symbol: "SMALL", units: 400, avg_buy_price: 140, current_price: 168, category: "Small Cap" },
      { asset_type: "stock", name: "Reliance Industries", symbol: "RELIANCE", units: 30, avg_buy_price: 2400, current_price: 2920, category: "Energy" },
      { asset_type: "stock", name: "HDFC Bank", symbol: "HDFCBANK", units: 40, avg_buy_price: 1500, current_price: 1680, category: "Financials" },
      { asset_type: "stock", name: "Infosys", symbol: "INFY", units: 25, avg_buy_price: 1350, current_price: 1580, category: "IT" },
      { asset_type: "etf", name: "Nasdaq 100 ETF", symbol: "MON100", units: 60, avg_buy_price: 150, current_price: 198, category: "International" },
      { asset_type: "gold", name: "Sovereign Gold Bond", symbol: "SGB", units: 50, avg_buy_price: 5800, current_price: 7200, category: "Gold" },
    ];
    const { error } = await supabase
      .from("holdings")
      .insert(rows.map((r) => ({ user_id: userId, ...r })));
    if (error) throw new Error(error.message);
    return { ok: true, seeded: rows.length };
  });
