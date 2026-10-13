import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RiskTolerance = "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";

export interface Preferences {
  risk_tolerance: RiskTolerance | null;
  preferred_sectors: string[];
  notify_email: boolean;
  notify_push: boolean;
  email_address: string | null;
}

const EMPTY: Preferences = {
  risk_tolerance: null,
  preferred_sectors: [],
  notify_email: false,
  notify_push: false,
  email_address: null,
};

export const getPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ preferences: Preferences; exists: boolean }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_preferences")
      .select("risk_tolerance, preferred_sectors, notify_email, notify_push, email_address")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { preferences: EMPTY, exists: false };
    return {
      exists: true,
      preferences: {
        risk_tolerance: (data.risk_tolerance as RiskTolerance | null) ?? null,
        preferred_sectors: data.preferred_sectors ?? [],
        notify_email: data.notify_email,
        notify_push: data.notify_push,
        email_address: data.email_address,
      },
    };
  });

const upsertInput = z.object({
  risk_tolerance: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]).nullable(),
  preferred_sectors: z.array(z.string().min(1).max(40)).max(30),
  notify_email: z.boolean(),
  notify_push: z.boolean(),
  email_address: z.string().trim().email().max(255).nullable(),
});

export const upsertPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
