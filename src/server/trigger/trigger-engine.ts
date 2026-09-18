/**
 * Trigger Engine (Phase 8, LLD §12).
 *
 * THE single entry point into the Brain pipeline. Nothing else in the codebase
 * should call runBrain / validate / recordBrainRun / recordDecision directly —
 * every trigger type (manual chat, scheduled pre-market review, portfolio and
 * watchlist changes) funnels through fire() so the audit trail, validation and
 * ordering are identical regardless of what started the run.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Decision, Evidence, TriggerType } from "@/server/contracts";
import { run as runBrain } from "@/server/brain/investment-brain";
import { validate } from "@/server/validator/decision-validator";
import { recordBrainRun, recordDecision } from "@/server/audit/audit-store";

export interface TriggerContext {
  userId: string;
  supabase: SupabaseClient<Database>;
  request?: string;
  correlationId?: string;
}

export interface TriggerResult {
  decision: Decision | null;
  evidence: Evidence[];
  decisionId: string | null;
}

export async function fire(
  triggerType: TriggerType,
  context: TriggerContext,
): Promise<TriggerResult> {
  const { userId, supabase } = context;
  const correlationId = context.correlationId ?? crypto.randomUUID();
  const requestText = context.request?.trim() || null;

  try {
    const brain = await runBrain(
      {
        correlationId,
        ...(requestText ? { userRequest: requestText } : {}),
        triggerType,
        userId,
      },
      { supabase, userId },
    );

    const outcome = await validate(brain.draft, { supabase, userId, evidence: brain.evidence });

    await recordBrainRun(brain, { userId, requestText, triggerType });
    const decisionId = await recordDecision(outcome.decision, {
      failures: outcome.failures,
      notes: outcome.notes,
    });

    return { decision: outcome.decision, evidence: brain.evidence, decisionId };
  } catch (err) {
    console.error(`[trigger:${triggerType}] pipeline failed:`, err);
    return { decision: null, evidence: [], decisionId: null };
  }
}
