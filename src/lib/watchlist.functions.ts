import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WatchRow {
  id: string;
  symbol: string;
  name: string;
}

const addInput = z.object({
  symbol: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
});

export const listWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: WatchRow[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("watchlist")
      .select("id, symbol, name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as WatchRow[] };
  });

export const addWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => addInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("watchlist")
      .upsert(
        { user_id: userId, symbol: data.symbol.trim().toUpperCase(), name: data.name.trim() },
        { onConflict: "user_id,symbol" },
      );
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
