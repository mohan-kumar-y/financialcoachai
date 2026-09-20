/**
 * Corporate Action signal (Phase 9) — [ENGINE], no LLM.
 *
 * Wraps the indianapi corporate-actions endpoint (built in Phase 2, unused
 * until now), normalizes whatever shape the provider returns into plain
 * language, and persists it as a CORP_ACTION market event.
 *
 * Freshness: a dedicated CORP_ACTION policy is used rather than reusing
 * FUNDAMENTAL. Announcements matter in a tighter window than balance-sheet
 * ratios — a record/ex date that is a week old has usually already passed, so
 * the stale/expired boundaries sit closer in than the fundamentals policy.
 *
 * Provider shape is defensive by design: indianapi returns different key
 * spellings across endpoints, so every field is probed across plausible names
 * and left out when absent. Nothing is invented.
 */
import { corporateActions, recordMarketEvent, FUNDAMENTALS_SOURCE } from "@/server/mip/indianapi-fundamentals.adapter";
import { classify, policyFor } from "@/server/freshness/freshness-gate";
import type { Evidence } from "@/server/contracts";

export interface CorporateActionItem {
  type: string;
  date: string | null;
  detail: string;
}

export interface CorporateActionResult {
  available: boolean;
  symbol: string;
  items: CorporateActionItem[];
  summary: string;
  observedAt: string | null;
  source: string;
  reason?: string;
}

const pick = (row: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = row[k];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s && s.toLowerCase() !== "null") return s;
  }
  return null;
};

/** Walk the payload for the first array of objects — providers nest it differently. */
function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  if (payload && typeof payload === "object") {
    for (const value of Object.values(payload as Record<string, unknown>)) {
      const rows = extractRows(value);
      if (rows.length > 0) return rows;
    }
  }
  return [];
}

function normalize(row: Record<string, unknown>): CorporateActionItem | null {
  const type =
    pick(row, ["purpose", "action", "type", "corporate_action", "subject", "event", "description"]) ??
    null;
  const date = pick(row, ["exDate", "ex_date", "date", "recordDate", "record_date", "announcementDate", "bcStartDate"]);
  const ratioOrAmount = pick(row, ["ratio", "value", "dividend", "amount", "faceValue"]);
  if (!type && !ratioOrAmount) return null;

  const label = type ?? "Corporate action";
  const parts = [label];
  if (ratioOrAmount) parts.push(ratioOrAmount);
  if (date) parts.push(`on ${date}`);
  return { type: label, date, detail: parts.join(" · ") };
}

export async function computeCorporateActions(symbol: string): Promise<CorporateActionResult> {
  const upper = symbol.trim().toUpperCase();
  try {
    const res = await corporateActions(symbol);
    if (res.status === "unavailable" || res.payload === null || res.payload === undefined) {
      return {
        available: false,
        symbol: upper,
        items: [],
        summary: `Corporate action data for ${upper} is currently unavailable.`,
        observedAt: res.fetchedAt,
        source: FUNDAMENTALS_SOURCE,
        reason: "provider_unavailable",
      };
    }

    const items = extractRows(res.payload)
      .map(normalize)
      .filter((x): x is CorporateActionItem => !!x)
      .slice(0, 12);

    if (items.length === 0) {
      return {
        available: true,
        symbol: upper,
        items: [],
        summary: `No corporate actions reported for ${upper} in the provider's current window.`,
        observedAt: res.fetchedAt,
        source: FUNDAMENTALS_SOURCE,
      };
    }

    // Append-only event log; failure here must not break the signal.
    try {
      await recordMarketEvent({
        symbol: upper,
        eventType: "CORP_ACTION",
        payload: { items },
        observedAt: res.fetchedAt ?? undefined,
      });
    } catch (err) {
      console.warn(`[corp-action] ${upper} event persist failed:`, err);
    }

    return {
      available: true,
      symbol: upper,
      items,
      summary: `${upper} corporate actions (${items.length}): ${items.map((i) => i.detail).join("; ")}.`,
      observedAt: res.fetchedAt,
      source: FUNDAMENTALS_SOURCE,
    };
  } catch (err) {
    return {
      available: false,
      symbol: upper,
      items: [],
      summary: `Corporate action data for ${upper} is currently unavailable.`,
      observedAt: null,
      source: FUNDAMENTALS_SOURCE,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getCorporateActionSignal(
  symbol: string,
  correlationId: string,
): Promise<{ evidence: Evidence[] }> {
  const result = await computeCorporateActions(symbol);
  const policy = policyFor("CORP_ACTION");
  const freshness =
    result.available && result.observedAt && policy
      ? classify(new Date(result.observedAt), policy)
      : "EXPIRED";

  return {
    evidence: [
      {
        id: crypto.randomUUID(),
        correlationId,
        capability: "EVENTS_CORP_ACTION",
        summary: result.summary,
        payload: result,
        freshness,
        observedAt: result.observedAt ?? new Date().toISOString(),
        source: result.source,
      },
    ],
  };
}
