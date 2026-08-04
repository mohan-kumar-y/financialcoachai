/**
 * Decision Validator (HLD §22 / LLD §4.3).
 *
 * Sits between the Investment Brain and everything user-facing. A DraftDecision
 * that has not passed through here must never be shown, stored as final, or
 * acted upon. Phase 1 implements the three minimal gates; Phase 3+ adds rule
 * conflict, freshness and compliance gates behind the same interface.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Decision, DraftDecision, Evidence, ValidationResult } from "@/server/contracts";

export interface ValidationContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  evidence: Evidence[];
}

export interface ValidationOutcome {
  decision: Decision;
  result: ValidationResult;
  failures: string[];
  notes: string[];
}

/** Actions that change money or exposure and therefore need real backing. */
const ACTIONABLE = new Set([
  "BUY", "SELL", "TOP_UP", "REDUCE", "REBALANCE", "BOOK_PROFITS",
  "INCREASE_SIP", "PAUSE_SIP", "LUMPSUM", "APPLY_IPO", "AVOID_IPO",
]);

/** Phase 1 thresholds — single place to tune. */
export const MIN_CONFIDENCE = 55;
export const MIN_SUPPORTING_EVIDENCE = 1;
export const DUPLICATE_WINDOW_HOURS = 24;

export async function validate(
  draft: DraftDecision,
  ctx: ValidationContext,
): Promise<ValidationOutcome> {
  const failures: string[] = [];
  const notes: string[] = [];
  let result: ValidationResult = "PASSED";
  let action = draft.action;
  let confidence = draft.confidence;

  const actionable = ACTIONABLE.has(draft.action);

  // --- Gate 1: evidence check -------------------------------------------
  const knownIds = new Set(ctx.evidence.map((e) => e.id));
  const supporting = draft.supportingEvidenceIds.filter((id) => knownIds.has(id));
  if (supporting.length !== draft.supportingEvidenceIds.length) {
    failures.push("Decision cited evidence ids that were never produced by the Capability Gateway.");
  }
  if (actionable && supporting.length < MIN_SUPPORTING_EVIDENCE) {
    failures.push(
      `Actionable call "${draft.action}" has no verifiable supporting evidence — downgraded to INSUFFICIENT_DATA.`,
    );
    action = "INSUFFICIENT_DATA";
    confidence = 0;
    result = "INSUFFICIENT_DATA";
  }
  if (ctx.evidence.length === 0 && draft.action !== "INSUFFICIENT_DATA") {
    failures.push("No evidence was gathered at all — the Brain cannot make a supported call.");
    action = "INSUFFICIENT_DATA";
    confidence = 0;
    result = "INSUFFICIENT_DATA";
  }

  // --- Gate 2: confidence threshold -------------------------------------
  if (result === "PASSED" && ACTIONABLE.has(action) && confidence < MIN_CONFIDENCE) {
    failures.push(
      `Confidence ${confidence} is below the ${MIN_CONFIDENCE} threshold for an actionable call — downgraded to NO_ACTION.`,
    );
    action = "NO_ACTION";
    result = "NO_ACTION";
  }

  // --- Gate 3: duplicate suppression ------------------------------------
  if (result === "PASSED" && ACTIONABLE.has(action) && draft.instrument) {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 3_600_000).toISOString();
    const { data, error } = await ctx.supabase
      .from("decisions")
      .select("id, created_at")
      .eq("instrument", draft.instrument)
      .eq("action", action)
      .eq("validation_result", "PASSED")
      .gte("created_at", since)
      .limit(1);
    if (error) {
      notes.push(`Duplicate check unavailable (${error.message}); proceeding without suppression.`);
    } else if (data && data.length > 0) {
      failures.push(
        `An identical ${action} call on ${draft.instrument} was already issued within the last ${DUPLICATE_WINDOW_HOURS}h — suppressed as a duplicate.`,
      );
      action = "NO_ACTION";
      result = "NO_ACTION";
    }
  }

  if (result === "PASSED" && (action === "NO_ACTION" || action === "INSUFFICIENT_DATA")) {
    result = action;
  }

  return {
    decision: {
      ...draft,
      action,
      confidence,
      supportingEvidenceIds: supporting,
      contradictingEvidenceIds: draft.contradictingEvidenceIds.filter((id) => knownIds.has(id)),
      validationResult: result,
    },
    result,
    failures,
    notes,
  };
}
