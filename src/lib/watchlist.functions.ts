import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WatchRow {
  id: string;
  symbol: string;
  name: string;
  target_price: number | null;
  target_direction: "ABOVE" | "BELOW" | null;
}

export interface WatchAlertRow {
  id: string;
  symbol: string;
  target_price: number;
  direction: "ABOVE" | "BELOW";
  ltp_at_trigger: number;
  triggered_at: string;
}

const targetSchema = {
  target_price: z.number().positive().max(10_000_000).nullable().optional(),
  target_direction: z.enum(["ABOVE", "BELOW"]).nullable().optional(),
};

const addInput = z.object({
  symbol: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  ...targetSchema,
});

export const listWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: WatchRow[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("watchlist")
      .select("id, symbol, name, target_price, target_direction")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as WatchRow[] };
  });

/** Target-price alerts triggered by the background market poller. */
export const listWatchlistAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ alerts: WatchAlertRow[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("watchlist_alerts")
      .select("id, symbol, target_price, direction, ltp_at_trigger, triggered_at")
      .eq("user_id", userId)
      .order("triggered_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { alerts: (data ?? []) as WatchAlertRow[] };
  });

export const addWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => addInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const symbol = data.symbol.trim().toUpperCase();
    const { data: existing } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", userId)
      .eq("symbol", symbol)
      .maybeSingle();
    if (existing) return { ok: true, existed: true };
    const { error } = await supabase.from("watchlist").insert({
      user_id: userId,
      symbol,
      name: data.name.trim(),
      target_price: data.target_price ?? null,
      // A target with no direction defaults to ABOVE — the common "alert me
      // when it reaches" intent. No direction without a price.
      target_direction: data.target_price ? (data.target_direction ?? "ABOVE") : null,
    });
    if (error) throw new Error(error.message);

    // Phase 8: adding a symbol expresses new intent and is worth a Brain run.
    // Removals deliberately do NOT fire — a removed symbol has no decision to
    // make, and firing on every removal is pure cost with no signal value.
    const { fire } = await import("@/server/trigger/trigger-engine");
    await fire("WATCHLIST_CHANGE", {
      userId,
      supabase,
      request: `Watchlist addition: ${symbol}. Assess whether this is worth acting on.`,
    });

    return { ok: true, existed: false };
  });

/**
 * Set or clear a price target on an existing watchlist row. Passing a null
 * price clears both fields. Does NOT fire a Brain run — editing a target is a
 * preference change, not new investment intent (Phase 8 cost rule).
 */
export const updateWatchTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ id: z.string().uuid(), ...targetSchema })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const price = data.target_price ?? null;
    const { error } = await supabase
      .from("watchlist")
      .update({
        target_price: price,
        target_direction: price ? (data.target_direction ?? "ABOVE") : null,
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const removeWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
