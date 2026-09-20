/**
 * Scheduled trigger runners (Phase 8).
 *
 * - runDailyBrief(): once daily pre-market (~08:30 IST), fires a SCHEDULED
 *   Brain run per tracked user.
 * - logSessionEvent(): 09:15 / 15:30 IST session boundary markers.
 *
 * COST NOTE (Phase 8): MARKET_OPEN/CLOSE log an event only; do not fire
 * per-user Brain runs — see Phase 8 note. A full LLM Brain run per user at
 * every session boundary would be expensive and largely duplicates the
 * pre-market Daily Brief. Logging the boundary keeps the trigger type real and
 * queryable for later phases (e.g. an anomaly summary keyed off the session).
 */
import { isTradingDay } from "@/server/calendar/market-calendar";
import { fire } from "./trigger-engine";

export interface DailyBriefResult {
  status: "skipped" | "ok";
  reason?: string;
  users?: number;
  succeeded?: number;
  failed?: number;
}

/** Hard cap so a runaway user table can never blow up one scheduled tick. */
const MAX_USERS_PER_RUN = 200;

export async function runDailyBrief(now: Date = new Date()): Promise<DailyBriefResult> {
  if (!isTradingDay(now)) {
    return { status: "skipped", reason: "not_a_trading_day" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [holdings, watchlist] = await Promise.all([
    supabaseAdmin.from("holdings").select("user_id"),
    supabaseAdmin.from("watchlist").select("user_id"),
  ]);

  const userIds = new Set<string>();
  for (const row of holdings.data ?? []) if (row.user_id) userIds.add(row.user_id);
  for (const row of watchlist.data ?? []) if (row.user_id) userIds.add(row.user_id);

  const targets = [...userIds].slice(0, MAX_USERS_PER_RUN);
  let succeeded = 0;
  let failed = 0;

  // Phase 9: the screens are cross-referenced per user, so the Brain is nudged
  // only toward names the user is NOT already holding or watching. Failure here
  // must not cost the brief — we simply fall back to the plain request text.
  const { getDiscoveryWithContext, summarizeNewIdeas } = await import(
    "@/server/discovery/discovery-engine"
  );

  for (const userId of targets) {
    try {
      let request = "Daily pre-market portfolio review";
      try {
        const ideas = await getDiscoveryWithContext(userId, supabaseAdmin);
        const summary = summarizeNewIdeas(ideas, 3);
        if (summary) request = `${request}. ${summary}`;
      } catch (err) {
        console.warn("[cron/daily-brief] discovery context unavailable:", err);
      }

      const result = await fire("SCHEDULED", {
        userId,
        supabase: supabaseAdmin,
        request,
      });
      if (result.decision) succeeded++;
      else failed++;
    } catch (err) {
      // One user's failure must never stop the batch.
      failed++;
      console.error("[cron/daily-brief] user run threw:", err);
    }
  }


  console.log(
    `[cron/daily-brief] users=${targets.length} succeeded=${succeeded} failed=${failed}`,
  );
  return { status: "ok", users: targets.length, succeeded, failed };
}

export async function logSessionEvent(
  eventType: "MARKET_OPEN" | "MARKET_CLOSE",
  now: Date = new Date(),
): Promise<{ status: "skipped" | "ok"; reason?: string }> {
  if (!isTradingDay(now)) return { status: "skipped", reason: "not_a_trading_day" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("market_events").insert({
    // Session boundaries are market-wide, not instrument-specific.
    symbol: "MARKET",
    event_type: eventType,
    payload: { occurred_at: now.toISOString() },
    source: "MARKET_CALENDAR",
    observed_at: now.toISOString(),
  });
  if (error) {
    console.error(`[cron/session] ${eventType} insert failed:`, error.message);
    return { status: "skipped", reason: "insert_failed" };
  }
  console.log(`[cron/session] logged ${eventType}`);
  return { status: "ok" };
}
