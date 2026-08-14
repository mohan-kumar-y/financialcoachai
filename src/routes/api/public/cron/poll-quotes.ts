// Scheduled live-quote poll (~every 60s during market hours), invoked by
// Supabase Cron via pg_cron/pg_net against this stable public URL.
// Per the frozen stack constraints there is no separate deployment target and
// no persistent WebSocket worker — this route IS the scheduled job.
//
// Security: when CRON_SECRET is configured, the caller must send it as
// `x-cron-secret`. The endpoint only writes market data (no user data in, no
// PII out) and exits cleanly when credentials are missing.

import { createFileRoute } from "@tanstack/react-router";
import { pollLiveQuotes } from "@/server/mip/live-quote-poller";

async function handle() {
  try {
    const result = await pollLiveQuotes();
    return Response.json(result);
  } catch (err) {
    console.error("[cron/poll-quotes] failed:", err);
    return Response.json({ status: "error" }, { status: 500 });
  }
}

function authorize(request: Request): Response | null {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return null; // not configured yet — endpoint is write-only market data
  if (request.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export const Route = createFileRoute("/api/public/cron/poll-quotes")({
  server: {
    handlers: {
      GET: async ({ request }) => authorize(request) ?? (await handle()),
      POST: async ({ request }) => authorize(request) ?? (await handle()),
    },
  },
});
