// Market session boundary markers (09:15 and 15:30 IST), invoked by Supabase
// Cron. Same auth/service-role pattern as /api/public/cron/poll-quotes.
//
// COST NOTE (Phase 8): MARKET_OPEN/CLOSE log an event only; do not fire
// per-user Brain runs — see Phase 8 note.

import { createFileRoute } from "@tanstack/react-router";
import { logSessionEvent } from "@/server/trigger/scheduled-runs";

function eventFrom(request: Request): "MARKET_OPEN" | "MARKET_CLOSE" {
  const url = new URL(request.url);
  return url.searchParams.get("event") === "close" ? "MARKET_CLOSE" : "MARKET_OPEN";
}

async function handle(request: Request) {
  try {
    return Response.json(await logSessionEvent(eventFrom(request)));
  } catch (err) {
    console.error("[cron/market-session] failed:", err);
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

export const Route = createFileRoute("/api/public/cron/market-session")({
  server: {
    handlers: {
      GET: async ({ request }) => authorize(request) ?? (await handle(request)),
      POST: async ({ request }) => authorize(request) ?? (await handle(request)),
    },
  },
});
