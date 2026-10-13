/**
 * Resend email adapter (Phase 10). Placeholder RESEND_API_KEY — degrades
 * honestly when missing. Not verified against the live API in this sandbox.
 */
export type EmailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: string };

const FROM = "WealthOS <notifications@resend.dev>";

export function hasResendKey(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, text: string): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "RESEND_API_KEY not configured." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, reason: `Resend HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: json.id ?? null };
  } catch (err) {
    return { ok: false, reason: `Resend request failed: ${(err as Error).message}` };
  }
}
