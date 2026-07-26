import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { AppNav } from "@/components/app-nav";
import { PageHeader, RiskBadge, LiveDataNote } from "@/components/wealth/kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzePortfolio } from "@/lib/advisor";
import { listHoldings } from "@/lib/holdings.functions";
import { getMyPlan } from "@/lib/plan.functions";
import { buildDailyBrief } from "@/lib/market";
import { getTrending, getMarketNews } from "@/lib/market-data.functions";
import { DataStatus, DataUnavailable } from "@/components/wealth/data-status";
import {
  Newspaper,
  Sun,
  Eye,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/brief")({
  component: BriefPage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function BriefPage() {
  const fetchHoldings = useServerFn(listHoldings);
  const fetchPlan = useServerFn(getMyPlan);
  const { data: planData } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });
  const { data: holdData } = useQuery({ queryKey: ["holdings"], queryFn: () => fetchHoldings() });

  const holdings = holdData?.holdings ?? [];
  const portfolio = useMemo(() => analyzePortfolio(holdings), [holdings]);
  const brief = useMemo(() => buildDailyBrief(portfolio.holdings), [portfolio]);
  const name = planData?.displayName?.split(" ")[0];
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const impactColor = { positive: "#22c55e", negative: "#ef4444", neutral: "#94a3b8" } as const;

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      <AppNav displayName={planData?.displayName ?? undefined} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <PageHeader
          icon={Newspaper}
          title="Your Daily Brief"
          subtitle={`${greeting()}${name ? `, ${name}` : ""} 👋  ${today} — here's your personalised market rundown.`}
        />

        {/* Indices strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MARKET_INDICES.map((m, i) => (
            <motion.div key={m.symbol} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="shadow-soft">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{m.name}</p>
                  <p className={"flex items-center gap-0.5 font-display text-base font-bold " + (m.change >= 0 ? "text-emerald-500" : "text-destructive")}>
                    {m.change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {Math.abs(m.change)}%
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="overflow-hidden shadow-soft">
          <div className="bg-gradient-hero p-5 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              <p className="font-display text-lg font-bold">{brief.headline}</p>
            </div>
            <p className="mt-2 text-sm opacity-90">{brief.marketSummary}</p>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5 text-primary" /> Stocks to Watch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {brief.watch.map((s) => {
                const up = s.changePct >= 0;
                return (
                  <div key={s.symbol} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3">
                    <div>
                      <p className="font-semibold">{s.symbol}</p>
                      <p className="text-xs text-muted-foreground">{s.name} · {s.sector}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <RiskBadge risk={s.risk} />
                      <span className={"flex items-center gap-0.5 text-sm font-semibold " + (up ? "text-emerald-500" : "text-destructive")}>
                        {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {up ? "+" : ""}
                        {s.changePct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Newspaper className="h-5 w-5 text-primary" /> Portfolio-Specific News
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {brief.portfolioNews.map((n, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: impactColor[n.impact] }} />
                  <span>{n.note}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-emerald-600">
                <Lightbulb className="h-5 w-5" /> Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {brief.opportunities.map((o, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-amber-600">
                <AlertTriangle className="h-5 w-5" /> Risks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {brief.risks.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <LiveDataNote>
          <strong>Connect later:</strong> the brief blends your positions with sample market copy. Wire a news + market-data feed (and
          optionally the AI assistant) to generate a fresh, live brief each morning.
        </LiveDataNote>
      </main>
    </div>
  );
}
