import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { AppNav } from "@/components/app-nav";
import { PageHeader, StatCard, SeverityBadge, LiveDataNote, chartTooltip } from "@/components/wealth/kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ProgressRing } from "@/components/progress-ring";
import { analyzePortfolio } from "@/lib/advisor";
import { listHoldings } from "@/lib/holdings.functions";
import { getMyPlan } from "@/lib/plan.functions";
import { analyzeHealth, MARKET_CAP_TARGET, formatINRc, type CapTier } from "@/lib/market";
import { Activity, ShieldCheck, Gauge, Sparkles, PieChart as PieIcon, Layers } from "lucide-react";

export const Route = createFileRoute("/_authenticated/health")({
  component: HealthPage,
});

const SECTOR_COLORS = ["#6366f1", "#22c55e", "#0f8b8d", "#f59e0b", "#ec4899", "#8b5cf6", "#0ea5e9", "#ef4444", "#14b8a6"];

function HealthPage() {
  const fetchHoldings = useServerFn(listHoldings);
  const fetchPlan = useServerFn(getMyPlan);
  const { data: planData } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });
  const { data: holdData, isLoading } = useQuery({ queryKey: ["holdings"], queryFn: () => fetchHoldings() });

  const holdings = holdData?.holdings ?? [];
  const portfolio = useMemo(() => analyzePortfolio(holdings), [holdings]);
  const health = useMemo(
    () => analyzeHealth(portfolio.holdings, portfolio.diversificationScore),
    [portfolio],
  );

  const empty = !isLoading && holdings.length === 0;

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      <AppNav displayName={planData?.displayName ?? undefined} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <PageHeader
          icon={Activity}
          title="Portfolio Health Dashboard"
          subtitle="Diversification, sector & market-cap allocation, risk and overall portfolio quality — with concentration warnings."
        />

        {empty ? (
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="h-6 w-6" />
              </span>
              <p className="font-display text-lg font-bold">No holdings yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add your holdings in the Advisor to unlock your full portfolio health report.
              </p>
              <Button asChild>
                <Link to="/advisor">Go to Advisor</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ScoreCard label="Quality Score" value={health.qualityScore} color="#0f8b8d" icon={ShieldCheck} good="high" />
              <ScoreCard label="Diversification" value={health.diversificationScore} color="#6366f1" icon={PieIcon} good="high" />
              <ScoreCard label="Risk Score" value={health.riskScore} color="#f59e0b" icon={Gauge} good="low" />
              <StatCard
                label="Portfolio Value"
                value={formatINRc(portfolio.current)}
                hint={`${portfolio.holdings.length} holdings`}
                icon={Layers}
                color="#22c55e"
                trend={portfolio.pnlPct}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieIcon className="h-5 w-5 text-primary" /> Sector Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={health.bySector} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2} stroke="none">
                          {health.bySector.map((_, i) => (
                            <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip {...chartTooltip} formatter={(v: number, n) => [formatINRc(v), n as string]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {health.bySector.map((s, i) => (
                      <div key={s.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                          {s.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers className="h-5 w-5 text-primary" /> Market-Cap Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={health.byCap.map((c) => ({ name: c.name, Actual: c.pct, Target: MARKET_CAP_TARGET[c.name as CapTier] }))}
                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} unit="%" />
                        <Tooltip {...chartTooltip} formatter={(v: number, n) => [`${v}%`, n as string]} />
                        <Bar dataKey="Actual" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="Target" fill="color-mix(in oklab, var(--muted-foreground) 30%, transparent)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Actual vs a balanced target mix (60% Large / 25% Mid / 15% Small).
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gauge className="h-5 w-5 text-primary" /> Concentration & Risk Warnings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {health.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                    <SeverityBadge severity={w.level} />
                    <span className="text-sm">{w.text}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        <LiveDataNote>
          <strong>Connect later:</strong> sector, market-cap and risk classifications are matched from sample metadata. Wire a
          securities master + fundamentals feed for exact classifications.
        </LiveDataNote>
      </main>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  color,
  icon: Icon,
  good,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  good: "high" | "low";
}) {
  const rating =
    good === "high"
      ? value >= 75 ? "Excellent" : value >= 55 ? "Good" : value >= 40 ? "Fair" : "Weak"
      : value <= 35 ? "Low" : value <= 55 ? "Moderate" : value <= 70 ? "Elevated" : "High";
  return (
    <Card className="shadow-soft">
      <CardContent className="flex items-center gap-4 p-4">
        <ProgressRing value={value} size={72} stroke={7} color={color} label={`${value}`} />
        <div>
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4" style={{ color }} />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          </div>
          <p className="mt-0.5 font-display text-lg font-bold" style={{ color }}>
            {rating}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
