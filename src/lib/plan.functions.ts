import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const planSchema = z.object({
  currency: z.enum(["INR", "USD", "EUR"]),
  annualSalary: z.number().min(0).max(1e12),
  monthlyExpenses: z.number().min(0).max(1e12),
  currentSip: z.number().min(0).max(1e12),
  emergencyMonths: z.number().int().min(0).max(36),
  annualIncrementPct: z.number().min(0).max(100),
  sipStepUpPct: z.number().min(0).max(100),
  checklist: z.record(z.string().max(64), z.boolean()).default({}),
});

export type SavePlanInput = z.infer<typeof planSchema>;

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("financial_plans")
      .select(
        "currency, annual_salary, monthly_expenses, current_sip, emergency_months, annual_increment_pct, sip_step_up_pct, checklist",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    const { getFxRatesToInr } = await import("@/lib/fx-rates.server");
    const fx = await getFxRatesToInr();
    const currency = (data?.currency ?? "INR") as "INR" | "USD" | "EUR";

    return {
      displayName: profile?.display_name ?? null,
      /** INR per one unit of the plan currency — feed into computePlan/getTier. */
      fxRate: fx.toInr[currency],
      fxSource: fx.source,
      fxFetchedAt: fx.fetchedAt,
      fxFallback: fx.fallback,
      plan: data
        ? {
            currency: data.currency as "INR" | "USD" | "EUR",
            annualSalary: Number(data.annual_salary),
            monthlyExpenses: Number(data.monthly_expenses),
            currentSip: Number(data.current_sip),
            emergencyMonths: Number(data.emergency_months),
            annualIncrementPct: Number(data.annual_increment_pct),
            sipStepUpPct: Number(data.sip_step_up_pct),
            checklist: (data.checklist ?? {}) as Record<string, boolean>,
          }
        : null,
    };
  });

export const saveMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => planSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("financial_plans").upsert(
      {
        user_id: userId,
        currency: data.currency,
        annual_salary: data.annualSalary,
        monthly_expenses: data.monthlyExpenses,
        current_sip: data.currentSip,
        emergency_months: data.emergencyMonths,
        annual_increment_pct: data.annualIncrementPct,
        sip_step_up_pct: data.sipStepUpPct,
        checklist: data.checklist,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
