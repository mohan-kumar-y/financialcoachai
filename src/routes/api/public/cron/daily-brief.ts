// Scheduled pre-market Daily Brief (~08:30 IST), invoked by Supabase Cron via
// pg_cron/pg_net against this stable public URL. Same auth/service-role pattern
// as /api/public/cron/poll-quotes.

import { createFileRoute } from "@tanstack/react-router";
import { runDailyBrief } from "@/server/trigger/scheduled-runs";

async function handle() {
  try {
    return Response.json(await runDailyBrief());
  } catch (err) {
    console.error("[cron/daily-brief] failed:", err);
    return Response.json({ status: "error" }, { status: 500 });
  }
}

function authorize(request: Request): Response | null {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return null;
  if (request.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export const Route = createFileRoute("/api/public/cron/daily-brief")({
  server: {
    handlers: {
      GET: async ({ request }) => authorize(request) ?? (await handle()),
      POST: async ({ request }) => authorize(request) ?? (await handle()),
    },
  },
});
