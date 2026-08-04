/**
 * Audit store (HLD §29 / LLD §2).
 *
 * Every Brain run, decision and explanation is persisted for the audit trail.
 * Writes are best-effort: a failed audit write must never break the user
 * response, but it is always logged.
 */
import type { Decision, Evidence, Explanation } from "@/server/contracts";
import type { BrainRunResult } from "@/server/brain/investment-brain";

export async function recordBrainRun(
  result: BrainRunResult,
  input: { userId: string; requestText: string | null; triggerType: string },
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("brain_runs").insert({
      correlation_id: result.draft.correlationId,
      user_id: input.userId,
      request_text: input.requestText,
      trigger_type: input.triggerType,
      plan: result.plan as unknown as Record<string, unknown>,
      capability_calls: {
        log: result.runState.log,
        callsUsed: result.runState.callsUsed,
        evidence: result.evidence.map((e: Evidence) => ({
          id: e.id,
          capability: e.capability,
          summary: e.summary,
          freshness: e.freshness,
          source: e.source,
          observedAt: e.observedAt,
        })),
      },
      iterations: result.runState.iterationsUsed,
      model: result.model,
      prompt_version: result.promptVersion,
      latency_ms: result.latencyMs,
      token_cost: result.tokenCost,
    });
    if (error) console.error("[audit] brain_runs insert failed:", error.message);
  } catch (err) {
    console.error("[audit] brain_runs insert threw:", err);
  }
}

export async function recordDecision(
  decision: Decision,
  meta: { failures: string[]; notes: string[] },
): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("decisions")
      .insert({
        correlation_id: decision.correlationId,
        instrument: decision.instrument,
        strategy: decision.strategy,
        action: decision.action,
        confidence: decision.confidence,
        thesis: decision.thesis,
        counter_thesis: decision.counterThesis,
        supporting_evidence_ids: decision.supportingEvidenceIds,
        contradicting_evidence_ids: decision.contradictingEvidenceIds,
        risks: decision.risks,
        invalidation_conditions: decision.invalidationConditions,
        missing_evidence: [...decision.missingEvidence, ...meta.failures, ...meta.notes],
        time_horizon: decision.timeHorizon,
        monitoring_plan: decision.monitoringPlan,
        execution_proposal: null,
        brain_version: decision.brainVersion,
        validation_result: decision.validationResult,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[audit] decisions insert failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error("[audit] decisions insert threw:", err);
    return null;
  }
}

export async function recordExplanation(
  decisionId: string,
  explanation: Explanation,
  action: string,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("explanations").insert({
      decision_id: decisionId,
      what_happened: explanation.whatHappened,
      why_it_matters: explanation.whyItMatters,
      evidence: explanation.evidence,
      thesis: explanation.thesis,
      counter_thesis: explanation.counterThesis,
      portfolio_impact: explanation.portfolioImpact,
      recommendation: explanation.recommendation,
      risks: explanation.risks,
      counter_arguments: [explanation.counterThesis].filter(Boolean),
      what_would_change_view: explanation.whatWouldChangeOurView,
      action,
      confidence: explanation.confidence,
    });
    if (error) console.error("[audit] explanations insert failed:", error.message);
  } catch (err) {
    console.error("[audit] explanations insert threw:", err);
  }
}
