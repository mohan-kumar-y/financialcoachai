/**
 * Notification Engine (Phase 10) — unified outbox. [ENGINE], no LLM.
 * Every dispatch writes one public.notifications row with an honest status.
 *   DASHBOARD → SENT immediately (the table is the dashboard feed).
 *   EMAIL     → via Resend, gated on the user's notify_email + email_address.
 *   PUSH      → always NOT_IMPLEMENTED (needs service worker + VAPID; future phase).
 * Never throws: notification failures must not break callers.
 */
import { sendEmail } from "@/server/mip/resend.adapter";

export type NotificationChannel = "DASHBOARD" | "EMAIL" | "PUSH";

export interface NotificationRelated {
  decisionId?: string | null;
  alertId?: string | null;
}

type Status = "PENDING" | "SENT" | "FAILED" | "NOT_IMPLEMENTED";

export async function dispatch(
  userId: string,
  channel: NotificationChannel,
  subject: string,
  body: string,
  related?: NotificationRelated,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let status: Status;
    let failure_reason: string | null = null;

    if (channel === "DASHBOARD") {
      status = "SENT";
    } else if (channel === "PUSH") {
      status = "NOT_IMPLEMENTED";
      failure_reason = "Web Push requires service worker + VAPID setup — not built yet.";
    } else {
      const { data: prefs } = await supabaseAdmin
        .from("user_preferences")
        .select("notify_email, email_address")
        .eq("user_id", userId)
        .maybeSingle();
      if (!prefs?.notify_email) {
        status = "NOT_IMPLEMENTED";
        failure_reason = "email notifications disabled in preferences";
      } else if (!prefs.email_address) {
        status = "NOT_IMPLEMENTED";
        failure_reason = "no email address on file";
      } else {
        const r = await sendEmail(prefs.email_address, subject, body);
        if (r.ok) status = "SENT";
        else {
          status = "FAILED";
          failure_reason = r.reason;
        }
      }
    }

    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      channel,
      subject,
      body,
      related_decision_id: related?.decisionId ?? null,
      related_alert_id: related?.alertId ?? null,
      status,
      failure_reason,
      sent_at: status === "SENT" ? new Date().toISOString() : null,
    });
    if (error) console.warn(`[notify] ${channel} insert failed:`, error.message);
  } catch (err) {
    console.warn(`[notify] ${channel} dispatch failed:`, (err as Error).message);
  }
}

/** DASHBOARD always, plus an EMAIL attempt (dispatch decides if it's enabled). */
export async function dispatchDashboardAndEmail(
  userId: string,
  subject: string,
  body: string,
  related?: NotificationRelated,
): Promise<void> {
  await dispatch(userId, "DASHBOARD", subject, body, related);
  await dispatch(userId, "EMAIL", subject, body, related);
}
