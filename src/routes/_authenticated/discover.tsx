import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppNav } from "@/components/app-nav";
import { PageHeader, RiskBadge } from "@/components/wealth/kit";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataStatus, DataUnavailable } from "@/components/wealth/data-status";
import {
  getDiscoveryScreens,
  type DiscoveryIdea,
  type DiscoveryResult,
} from "@/lib/discovery.functions";
import { DISCOVERY_SECTIONS, type DiscoveryTag } from "@/lib/market";
import { fmtCr, fmtNum } from "@/lib/market-data";
import { Telescope, TrendingUp, TrendingDown, Crown } from "lucide-react";

const discoveryQuery = queryOptions<DiscoveryResult>({
  queryKey: ["discovery-screens"],
  queryFn: () => getDiscoveryScreens(),
  staleTime: 60 * 60 * 1000, // 60 min — matches provider cache TTL
});

export const Route = createFileRoute("/_authenticated/discover")({
  loader: ({ context }) => context.queryClient.ensureQueryData(discoveryQuery),
  component: DiscoverPage,
  head: () => ({
    meta: [
      { title: "Stock Discovery — WealthOS" },
      {
        name: "description",
        content:
          "Live-screened NSE/BSE idea baskets: compounders, value, momentum, dividends and sector leaders — computed from real fundamentals, never mocked.",
      },
      { property: "og:title", content: "Stock Discovery — WealthOS" },
      {
        property: "og:description",
        content:
          "Live-screened NSE/BSE idea baskets computed from real fundamentals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DiscoverPage() {
  const { data } = useSuspenseQuery(discoveryQuery);
  const [active, setActive] = useState<DiscoveryTag>("compounder");
  const section = DISCOVERY_SECTIONS.find((s) => s.tag === active)!;
  const ideas = data.screens[active] ?? [];

  const noData = data.covered === 0 || data.meta.status === "unavailable";

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      <AppNav />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <PageHeader
          icon={Telescope}
          title="Stock Discovery Center"
          subtitle="Live-screened idea baskets across ~60 NSE names — compounders, value, momentum, dividends and sector leaders."
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataStatus meta={data.meta} />
          <p className="text-xs text-muted-foreground">
            Universe: {data.covered}/{data.universeSize} stocks with live data
          </p>
        </div>

        {noData ? (
          <DataUnavailable
            meta={data.meta}
            hint="We couldn't retrieve fundamentals for the discovery universe from the market-data provider. Screens will populate on the next successful fetch."
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {DISCOVERY_SECTIONS.map((s) => (
                <button
                  key={s.tag}
                  onClick={() => setActive(s.tag)}
                  className={
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                    (active === s.tag
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground")
                  }
                >
                  {s.title}
                  <span className="ml-1.5 text-[10px] opacity-70">
                    {data.screens[s.tag]?.length ?? 0}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <h2 className="font-display text-xl font-bold">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.blurb}</p>
            </div>

            {ideas.length === 0 ? (
              <Card className="shadow-soft">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No stocks in the current universe met this screen's criteria today.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ideas.map((idea, i) => (
                  <IdeaCard key={idea.symbol + idea.name} idea={idea} delay={i * 0.04} />
                ))}
              </div>
            )}

            <Card className="shadow-soft">
              <CardContent className="p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-gold" />
                  <h3 className="font-display text-lg font-bold">Sector Leaders & Momentum</h3>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Sector</th>
                        <th className="px-4 py-3 text-right">Avg Today</th>
                        <th className="hidden px-4 py-3 text-right sm:table-cell">Avg P/E</th>
                        <th className="px-4 py-3 text-right">Names</th>
                        <th className="px-4 py-3">Momentum</th>
                        <th className="hidden px-4 py-3 md:table-cell">Top Mover</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sectors.map((s) => (
                        <tr key={s.name} className="border-t border-border/60 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td
                            className={
                              "px-4 py-3 text-right tabular-nums " +
                              (s.changePct >= 0 ? "text-emerald-500" : "text-destructive")
                            }
                          >
                            {s.changePct >= 0 ? "+" : ""}
                            {s.changePct.toFixed(2)}%
                          </td>
                          <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                            {s.pe === null ? "—" : s.pe.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {s.count}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={
                                s.momentum === "Strong"
                                  ? "bg-emerald-500/15 text-emerald-600"
                                  : s.momentum === "Weak"
                                    ? "bg-destructive/15 text-destructive"
                                    : ""
                              }
                            >
                              {s.momentum}
                            </Badge>
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                            {s.leader}
                            <span
                              className={
                                "ml-2 text-xs tabular-nums " +
                                (s.leaderChangePct >= 0 ? "text-emerald-500" : "text-destructive")
                              }
                            >
                              {s.leaderChangePct >= 0 ? "+" : ""}
                              {s.leaderChangePct.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function IdeaCard({ idea, delay }: { idea: DiscoveryIdea; delay: number }) {
  const up = (idea.changePct ?? 0) >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay }}>
      <Card className="h-full shadow-soft transition-shadow hover:shadow-elevated">
        <CardContent className="flex h-full flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display font-bold">{idea.symbol}</p>
              <p className="text-xs text-muted-foreground">{idea.name}</p>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">
              {idea.cap}
            </Badge>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="font-display text-lg font-bold tabular-nums">
                ₹{idea.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
              {idea.changePct !== null && (
                <span
                  className={
                    "flex items-center gap-0.5 text-xs font-semibold " +
                    (up ? "text-emerald-500" : "text-destructive")
                  }
                >
                  {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {up ? "+" : ""}
                  {idea.changePct.toFixed(2)}% today
                </span>
              )}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{fmtCr(idea.marketCap)}</p>
              <p>{idea.sector}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2 text-center text-xs">
            <Metric label="P/E" value={fmtNum(idea.pe)} />
            <Metric label="RoE" value={fmtNum(idea.roe, "%")} />
            <Metric label="Div" value={fmtNum(idea.dividendYield, "%")} />
          </div>

          <p className="mt-3 flex-1 text-xs text-muted-foreground">{idea.thesis}</p>

          <div className="mt-3 flex items-center justify-between">
            <RiskBadge risk={idea.risk} />
            <span className="text-[11px] text-muted-foreground">
              D/E {idea.debtEquity === null ? "—" : idea.debtEquity.toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
