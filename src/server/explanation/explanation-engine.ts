/**
 * Explanation Engine (HLD §26 / LLD §4.4).
 *
 * [LLM-1SHOT] — turns an ALREADY VALIDATED decision plus its evidence into
 * user-facing prose. It never decides, never re-scores, never overrides the
 * validator, and never calls the Brain, the Gateway or the Rules Engine.
 * Every output carries the full Explainability Contract.
 */
import { convertToModelMessages, streamText, stepCountIs, type ToolSet, type UIMessage } from "ai";
import { createLovableAiGatewayProvider, WEALTH_MODEL } from "@/lib/ai-gateway.server";
import type { Decision, Evidence, Explanation } from "@/server/contracts";

export const CONTRACT_SECTIONS = [
  "What Happened",
  "Why It Matters",
  "Evidence",
  "Thesis",
  "Counter-Thesis",
  "Portfolio Impact",
  "Recommendation",
  "Risks",
  "What Would Change Our View",
] as const;

const BASE_SYSTEM = `You are the Explanation Engine of WealthOS, writing for an Indian retail investor (₹ INR, NSE/BSE).

You do NOT decide anything. The Investment Brain decided and the Decision Validator approved or downgraded that decision. Your only job is to explain it clearly and honestly.

Absolute rules:
- Never contradict, upgrade or soften the validated action. If the action is INSUFFICIENT_DATA, say plainly that WealthOS is not making a call and why.
- Never introduce a number, price, valuation or fact that is not in the evidence or tool results given to you.
- Never present a probability or score as a guarantee.
- Write in clean markdown, short paragraphs, no filler.`;

const CONTRACT_INSTRUCTION = `Structure the answer with exactly these level-2 headings, in this order:
${CONTRACT_SECTIONS.map((s) => `## ${s}`).join("\n")}

"Evidence", "Risks" and "What Would Change Our View" are bullet lists. End with the confidence figure and, in italics, the line: *Educational research only — not investment advice. Verify with live data before acting.*`;

export function renderDecisionContext(decision: Decision, evidence: Evidence[]): string {
  const ev = evidence.length
    ? evidence.map((e) => `- [${e.capability} · ${e.freshness}] ${e.summary}`).join("\n")
    : "(no evidence was available)";
  return `VALIDATED DECISION (do not change it)
Action: ${decision.action}
Validation: ${decision.validationResult}
Instrument: ${decision.instrument ?? "n/a"}
Confidence: ${decision.confidence}/100
Thesis: ${decision.thesis}
Counter-thesis: ${decision.counterThesis}
Risks: ${decision.risks.join("; ") || "none recorded"}
Invalidation conditions: ${decision.invalidationConditions.join("; ") || "none recorded"}
Missing evidence: ${decision.missingEvidence.join("; ") || "none"}
Time horizon: ${decision.timeHorizon ?? "not specified"}
Monitoring plan: ${decision.monitoringPlan ?? "not specified"}

EVIDENCE THE DECISION RESTS ON
${ev}`;
}

export interface StreamExplanationInput {
  decision: Decision | null;
  evidence: Evidence[];
  messages: UIMessage[];
  /**
   * Optional read-only research tools supplied by the caller. Phase 1
   * carry-over so the research chat keeps live market lookups; these become
   * gateway capabilities (RESEARCH_FUNDAMENTAL et al.) in Phase 2.
   */
  tools?: ToolSet;
  /** Extra caller-specific prose guidance (never decision logic). */
  extraSystem?: string;
}

export async function streamExplanation({
  decision,
  evidence,
  messages,
  tools,
  extraSystem,
}: StreamExplanationInput) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);

  const system = [
    BASE_SYSTEM,
    extraSystem ?? "",
    decision
      ? `${CONTRACT_INSTRUCTION}\n\n${renderDecisionContext(decision, evidence)}`
      : "No portfolio decision applies to this request. Answer the user's question directly and never fabricate live figures.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return streamText({
    model: gateway(WEALTH_MODEL),
    system,
    messages: await convertToModelMessages(messages),
    ...(tools ? { tools, stopWhen: stepCountIs(4) } : {}),
  });
}

function section(markdown: string, heading: string): string {
  const re = new RegExp(`^#{1,4}\\s*${heading}\\s*$([\\s\\S]*?)(?=^#{1,4}\\s|\\Z)`, "im");
  return (markdown.match(re)?.[1] ?? "").trim();
}

function bullets(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

/** Parses the streamed prose back into the stored Explainability Contract. */
export function parseExplanation(markdown: string, decision: Decision): Explanation {
  return {
    whatHappened: section(markdown, "What Happened") || markdown.slice(0, 500),
    whyItMatters: section(markdown, "Why It Matters"),
    evidence: bullets(section(markdown, "Evidence")),
    thesis: section(markdown, "Thesis") || decision.thesis,
    counterThesis: section(markdown, "Counter-Thesis") || decision.counterThesis,
    portfolioImpact: section(markdown, "Portfolio Impact"),
    recommendation: section(markdown, "Recommendation") || decision.action,
    risks: bullets(section(markdown, "Risks")).length
      ? bullets(section(markdown, "Risks"))
      : decision.risks,
    whatWouldChangeOurView: bullets(section(markdown, "What Would Change Our View")).length
      ? bullets(section(markdown, "What Would Change Our View"))
      : decision.invalidationConditions,
    confidence: decision.confidence,
  };
}
