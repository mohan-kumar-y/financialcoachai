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
          return Response.json({
            topKeys: Object.keys(data),
            companyName: data.companyName,
            tickerId: data.tickerId,
            industry: data.industry,
            currentPrice: data.currentPrice,
            percentChange: data.percentChange,
            yearHigh: data.yearHigh,
            yearLow: data.yearLow,
            companyProfileKeys: cp ? Object.keys(cp) : null,
            peerSample: peers[0] ?? null,
            keyMetricsKeys: data.keyMetrics ? Object.keys(data.keyMetrics as object) : null,
            keyMetrics: JSON.stringify(data.keyMetrics ?? null).slice(0, 1800),
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
