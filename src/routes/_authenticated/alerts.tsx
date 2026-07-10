import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { AppNav } from "@/components/app-nav";
import { PageHeader, SeverityBadge, StatCard, LiveDataNote } from "@/components/wealth/kit";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { analyzePortfolio } from "@/lib/advisor";
import { listHoldings } from "@/lib/holdings.functions";
import { getMyPlan } from "@/lib/plan.functions";
import { buildAlerts, SEVERITY_COLOR, type Severity, type AlertKind } from "@/lib/market";
import {
  Siren,
  FileWarning,
  Landmark,
  Lock,
  ScrollText,
  TrendingUp,
  Newspaper,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: AlertsPage,
});

const KIND_ICON: Record<AlertKind, React.ComponentType<{ className?: string }>> = {
  Earnings: FileWarning,
  Debt: Landmark,
  "Promoter Pledge": Lock,
  Governance: ScrollText,
  "Price Move": TrendingUp,
  News: Newspaper,
};

function AlertsPage() {
  const fetchHoldings = useServerFn(listHoldings);
  const fetchPlan = useServerFn(getMyPlan);
  const { data: planData } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });
  const { data: holdData, isLoading } = useQuery({ queryKey: ["holdings"], queryFn: () => fetchHoldings() });

  const holdings = holdData?.holdings ?? [];
  const portfolio = useMemo(() => analyzePortfolio(holdings), [holdings]);
  const alerts = useMemo(() => buildAlerts(portfolio.holdings), [portfolio]);

  const [filter, setFilter] = useState<Severity | "All">("All");
  const shown = filter === "All" ? alerts : alerts.filter((a) => a.severity === filter);
  const counts = {
    Critical: alerts.filter((a) => a.severity === "Critical").length,
    Warning: alerts.filter((a) => a.severity === "Warning").length,
    Info: alerts.filter((a) => a.severity === "Info").length,
  };

  const empty = !isLoading && holdings.length === 0;

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      <AppNav displayName={planData?.displayName ?? undefined} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <PageHeader
          icon={Siren}
          title="Red Alert Center"
          subtitle="Real-time watch on your holdings — earnings misses, rising debt, promoter pledges, governance flags, big moves and major news."
        />

        {empty ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Critical" value={`${counts.Critical}`} icon={ShieldAlert} color={SEVERITY_COLOR.Critical} hint="Needs attention now" />
              <StatCard label="Warning" value={`${counts.Warning}`} icon={FileWarning} color={SEVERITY_COLOR.Warning} hint="Monitor closely" delay={0.05} />
              <StatCard label="Info" value={`${counts.Info}`} icon={Newspaper} color={SEVERITY_COLOR.Info} hint="Good to know" delay={0.1} />
            </div>

            <div className="flex flex-wrap gap-2">
              {(["All", "Critical", "Warning", "Info"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                    (filter === f ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground hover:text-foreground")
                  }
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {shown.map((a, i) => {
                const Icon = KIND_ICON[a.kind];
                const c = SEVERITY_COLOR[a.severity];
                return (
                  <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card className="shadow-soft" style={{ borderLeft: `3px solid ${c}` }}>
                      <CardContent className="flex items-start gap-3 p-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: c + "22", color: c }}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <SeverityBadge severity={a.severity} />
                            <span className="text-xs font-medium text-muted-foreground">{a.kind}</span>
                            <span className="text-xs text-muted-foreground">· {a.symbol}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{a.time}</span>
                          </div>
                          <p className="mt-1.5 font-semibold">{a.title}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{a.detail}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
              {shown.length === 0 && (
                <Card className="shadow-soft">
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">No {filter.toLowerCase()} alerts. 🎉</CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        <LiveDataNote>
          <strong>Connect later:</strong> alerts are derived from your positions plus sample event templates. Wire a corporate-actions,
          filings and news feed for real earnings, debt, pledge and governance events.
        </LiveDataNote>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="shadow-soft">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-6 w-6" />
        </span>
        <p className="font-display text-lg font-bold">No holdings to monitor</p>
        <p className="max-w-sm text-sm text-muted-foreground">Add holdings in the Advisor and we'll start watching them for red flags.</p>
        <Button asChild>
          <Link to="/advisor">Go to Advisor</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
