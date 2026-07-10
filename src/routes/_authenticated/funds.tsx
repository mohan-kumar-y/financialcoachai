import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AppNav } from "@/components/app-nav";
import { PageHeader, LiveDataNote, chartTooltip } from "@/components/wealth/kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FUNDS, fundOverlap, formatINRc, type FundRow } from "@/lib/market";
import { Layers, Star, UserCog, GitCompareArrows, Activity, TrendingUp, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/funds")({
  component: FundsPage,
});

const DRIFT_STYLE: Record<string, string> = {
  None: "bg-emerald-500/15 text-emerald-600",
  Mild: "bg-amber-500/15 text-amber-600",
  Notable: "bg-destructive/15 text-destructive",
};

function FundsPage() {
  const [aName, setAName] = useState(FUNDS[0].name);
  const [bName, setBName] = useState(FUNDS[1].name);
  const fundA = FUNDS.find((f) => f.name === aName)!;
  const fundB = FUNDS.find((f) => f.name === bName)!;
  const overlap = useMemo(() => fundOverlap(fundA, fundB), [fundA, fundB]);
  const shared = useMemo(() => {
    const setB = new Set(fundB.topHoldings.map((h) => h.toLowerCase()));
    return fundA.topHoldings.filter((h) => setB.has(h.toLowerCase()));
  }, [fundA, fundB]);

  const perfData = [
    { period: "1Y", [fundA.name]: fundA.ret1y, [fundB.name]: fundB.ret1y },
    { period: "3Y", [fundA.name]: fundA.ret3y, [fundB.name]: fundB.ret3y },
    { period: "5Y", [fundA.name]: fundA.ret5y, [fundB.name]: fundB.ret5y },
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      <AppNav />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <PageHeader
          icon={Layers}
          title="Mutual Fund Analyzer"
          subtitle="Overlap analysis, style drift, fund-manager changes and performance trends across your funds."
        />

        {/* Overlap analyzer */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompareArrows className="h-5 w-5 text-primary" /> Overlap Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <FundSelect label="Fund A" value={aName} onChange={setAName} />
              <FundSelect label="Fund B" value={bName} onChange={setBName} />
            </div>

            <div className="mt-5 grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
              <div className="flex flex-col items-center justify-center rounded-2xl bg-muted/40 p-5 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Portfolio Overlap</p>
                <p
                  className="font-display text-5xl font-bold tabular-nums"
                  style={{ color: overlap >= 50 ? "#ef4444" : overlap >= 30 ? "#f59e0b" : "#22c55e" }}
                >
                  {overlap}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {overlap >= 50
                    ? "High overlap — you may be over-diversifying into the same stocks."
                    : overlap >= 30
                      ? "Moderate overlap — some duplication of exposure."
                      : "Low overlap — good complementary diversification."}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Shared top holdings</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {shared.length ? (
                    shared.map((h) => (
                      <Badge key={h} variant="secondary">
                        {h}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No shared names among top holdings.</span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <MiniStat label={`${fundA.name} expense`} value={`${fundA.expenseRatio}%`} />
                  <MiniStat label={`${fundB.name} expense`} value={`${fundB.expenseRatio}%`} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance trend */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" /> Performance Trend (CAGR %)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} unit="%" />
                  <Tooltip {...chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={fundA.name} fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey={fundB.name} fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Fund table: style drift + manager changes */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-primary" /> Style Drift & Manager Watch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FUNDS.map((f, i) => (
                <FundCard key={f.name} fund={f} delay={i * 0.04} />
              ))}
            </div>
          </CardContent>
        </Card>

        <LiveDataNote>
          <strong>Connect later:</strong> fund data (holdings, expense ratios, returns, manager tenure) is illustrative. Wire an AMFI /
          fund fact-sheet API for live overlap, style-drift detection and manager-change alerts.
        </LiveDataNote>
      </main>
    </div>
  );
}

function FundSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FUNDS.map((f) => (
            <SelectItem key={f.name} value={f.name}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display font-bold tabular-nums">{value}</p>
    </div>
  );
}

function FundCard({ fund, delay }: { fund: FundRow; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="h-full shadow-soft">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{fund.name}</p>
              <p className="text-xs text-muted-foreground">{fund.category} · {fund.amc}</p>
            </div>
            <span className="flex items-center gap-0.5 text-sm font-bold text-gold">
              <Star className="h-3.5 w-3.5 fill-gold" /> {fund.rating}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2 text-center text-xs">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">1Y</p>
              <p className="font-semibold tabular-nums">{fund.ret1y}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">3Y</p>
              <p className="font-semibold tabular-nums">{fund.ret3y}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">5Y</p>
              <p className="font-semibold tabular-nums">{fund.ret5y}%</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary" className={DRIFT_STYLE[fund.styleDrift]}>
              Style drift: {fund.styleDrift}
            </Badge>
            {fund.managerChanged ? (
              <Badge variant="secondary" className="bg-destructive/15 text-destructive">
                <AlertCircle className="mr-1 h-3 w-3" /> Manager changed
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600">
                <UserCog className="mr-1 h-3 w-3" /> Stable manager
              </Badge>
            )}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {fund.manager} · {fund.managerTenureYrs}y tenure · AUM {formatINRc(fund.aum * 1e7)}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
