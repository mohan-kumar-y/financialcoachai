import { createFileRoute } from "@tanstack/react-router";
import { rawProvider } from "@/lib/market-data.server";

// TEMPORARY probe route to inspect the live provider response shape. Delete after use.
export const Route = createFileRoute("/api/public/probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const name = url.searchParams.get("name") ?? "TCS";
        try {
          const data = (await rawProvider(`/stock?name=${encodeURIComponent(name)}`)) as Record<string, unknown>;
          const cp = data.companyProfile as Record<string, unknown> | undefined;
          const peers = (cp?.peerCompanyList as unknown[]) ?? [];
          const fin = data.financials as unknown[] | undefined;
          const finItem = Array.isArray(fin) ? fin[0] : fin;
          return Response.json({
            topKeys: Object.keys(data),
            currentPrice: data.currentPrice,
            percentChange: data.percentChange,
            yearHigh: data.yearHigh,
            yearLow: data.yearLow,
            companyProfileKeys: cp ? Object.keys(cp) : null,
            peerSample: peers[0] ?? null,
            peerKeys: peers[0] ? Object.keys(peers[0] as object) : null,
            keyMetrics: data.keyMetrics,
            financialFirst: finItem ? JSON.stringify(finItem).slice(0, 1500) : null,
            recentNewsSample: Array.isArray(data.recentNews) ? (data.recentNews as unknown[]).slice(0, 2) : data.recentNews,
            analystView: data.analystView,
            recosBar: data.recosBar,
          });
        } catch (e) {
          return Response.json({ error: String(e) }, { status: 500 });
        }
      },
    },
  },
});
