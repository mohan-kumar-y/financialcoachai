import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY diagnostic route. Delete after use.
export const Route = createFileRoute("/api/public/probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const name = url.searchParams.get("name") ?? "TCS";
        const key = process.env.INDIAN_STOCK_API_KEY ?? "";
        const base = "https://stock.indianapi.in";
        const path = `/stock?name=${encodeURIComponent(name)}`;

        const attempts: Record<string, unknown> = {
          keyPresent: key.length > 0,
          keyLength: key.length,
          keyPrefix: key.slice(0, 4),
        };

        async function tryHeaders(label: string, headers: Record<string, string>) {
          try {
            const res = await fetch(`${base}${path}`, { headers });
            attempts[label] = { status: res.status, body: (await res.text()).slice(0, 120) };
          } catch (e) {
            attempts[label] = { error: String(e) };
          }
        }

        await tryHeaders("x-api-key", { "x-api-key": key, accept: "application/json" });
        await tryHeaders("X-Api-Key", { "X-Api-Key": key, accept: "application/json" });
        await tryHeaders("bearer", { Authorization: `Bearer ${key}`, accept: "application/json" });

        return Response.json(attempts);
      },
    },
  },
});
