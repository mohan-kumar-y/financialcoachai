/**
 * Watchlist Engine (Phase 9) — deterministic target-price alerting.
 *
 * [ENGINE] No LLM anywhere in this file. A target is crossed or it isn't.
 *
 * checkTargetAlerts() is called from the live-quote poller once per persisted
 * tick. It scans every user's watchlist rows for that symbol that carry a
 * target, and records a watchlist_alerts row on a genuine crossing.
 *
 * De-duplication: while a price sits past its target the poller would other-
 * wise fire an alert every ~60s. We suppress a new alert when the same
 * watchlist row already produced one inside RE_ARM_HOURS, which means a
 * crossing is reported once per session-ish window rather than per tick.
 */

const RE_ARM_HOURS = 24;

export async function checkTargetAlerts(symbol: string, ltp: number): Promise<void> {
  if (!Number.isFinite(ltp) || ltp <= 0) return;
  const upper = symbol.trim().toUpperCase();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error } = await supabaseAdmin
    .from("watchlist")
    .select("id, user_id, symbol, target_price, target_direction")
    .eq("symbol", upper)
    .not("target_price", "is", null)
    .limit(500);

  if (error) {
    console.warn(`[watchlist-engine] ${upper} target lookup failed:`, error.message);
    return;
  }
  if (!rows || rows.length === 0) return;

  const since = new Date(Date.now() - RE_ARM_HOURS * 3600_000).toISOString();

  for (const row of rows) {
    const target = Number(row.target_price);
    const direction = row.target_direction === "BELOW" ? "BELOW" : "ABOVE";
    if (!Number.isFinite(target) || target <= 0) continue;

    const crossed = direction === "ABOVE" ? ltp >= target : ltp <= target;
    if (!crossed) continue;

    const { data: recent } = await supabaseAdmin
      .from("watchlist_alerts")
      .select("id")
      .eq("watchlist_id", row.id)
      .gte("triggered_at", since)
      .limit(1)
      .maybeSingle();
    if (recent) continue;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("watchlist_alerts")
      .insert({
        user_id: row.user_id,
        watchlist_id: row.id,
        symbol: upper,
        target_price: target,
        direction,
        ltp_at_trigger: ltp,
      })
      .select("id")
      .single();
    if (insertError) {
      console.warn(`[watchlist-engine] ${upper} alert insert failed:`, insertError.message);
      continue;
    }
    // Phase 10: dashboard always; email attempt — dispatch() checks preferences.
    const { dispatchDashboardAndEmail } = await import("@/server/notification/notification-engine");
    await dispatchDashboardAndEmail(
      row.user_id,
      `${upper} crossed your ₹${target} target`,
      `${upper} is at ₹${ltp.toFixed(2)}, ${direction === "ABOVE" ? "at or above" : "at or below"} your target of ₹${target}.`,
      { alertId: inserted?.id ?? null },
    );
  }
}
