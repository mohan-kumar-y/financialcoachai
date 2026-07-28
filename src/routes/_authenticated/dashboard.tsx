import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { AppNav } from "@/components/app-nav";
import { PlanForm } from "@/components/dashboard/PlanForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProgressRing } from "@/components/progress-ring";
import { AnimatedCounter } from "@/components/animated-counter";
import { getMyPlan, saveMyPlan } from "@/lib/plan.functions";
import { listExpenses } from "@/lib/expenses.functions";
import { listHoldings } from "@/lib/holdings.functions";
import { analyzePortfolio } from "@/lib/advisor";
import { useLiveHoldings } from "@/lib/use-live-holdings";
import { computePlan, getTier, DEFAULT_INPUTS, type PlanInputs } from "@/lib/finance";
import {
  inMonth,
  currentMonthKey,
  shiftMonth,
  summarize,
  compareToBlueprint,
  buildSpendingInsights,
  byCategory,
  financialHealth,
  CATEGORY_META,
} from "@/lib/spending";
import { formatINR } from "@/lib/blueprints";
import { fadeUp } from "@/lib/motion";
import { WealthModules } from "@/components/wealth/modules";
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Settings2,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getMyPlan);
  const savePlan = useServerFn(saveMyPlan);
  const fetchExpenses = useServerFn(listExpenses);
  const fetchHoldings = useServerFn(listHoldings);

  const { data, isLoading } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });
  const { data: expData } = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses() });
  const { data: holdData } = useQuery({ queryKey: ["holdings"], queryFn: () => fetchHoldings() });

  const [inputs, setInputs] = useState<PlanInputs>(DEFAULT_INPUTS);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (data && !hydrated.current) {
      hydrated.current = true;
      if (data.plan) {
        const { checklist: cl, ...rest } = data.plan;
        setInputs(rest);
        setChecklist(cl ?? {});
      }
    }
  }, [data]);

  const expenses = expData?.expenses ?? [];
  const holdings = holdData?.holdings ?? [];
  const portfolio = useMemo(() => analyzePortfolio(holdings), [holdings]);
  const plan = useMemo(() => computePlan(inputs), [inputs]);
  const tier = getTier(inputs.annualSalary, inputs.currency);
  const monthlyIncome = inputs.annualSalary / 12;

  const month = currentMonthKey();
  const thisMonth = useMemo(() => inMonth(expenses, month), [expenses, month]);
  const lastMonth = useMemo(() => inMonth(expenses, shiftMonth(month, -1)), [expenses, month]);
  const summary = useMemo(() => summarize(thisMonth, monthlyIncome), [thisMonth, monthlyIncome]);
  const compareRows = useMemo(
    () => compareToBlueprint(thisMonth, monthlyIncome, "moderate"),
    [thisMonth, monthlyIncome],
  );
  const insights = useMemo(
    () => buildSpendingInsights(thisMonth, lastMonth, monthlyIncome, "moderate"),
    [thisMonth, lastMonth, monthlyIncome],
  );

  const lifetimeContrib = useMemo(() => {
    const c = byCategory(expenses);
    return c.investments + c.emergency;
  }, [expenses]);
  const netWorth = portfolio.current + lifetimeContrib + summary.savings;
  const monthChange = summary.investments + summary.emergency;

  const emergencyProgress = Math.min(
    100,
    plan.emergencyTarget > 0 ? (lifetimeContrib / plan.emergencyTarget) * 100 : 0,
  );
  const health = useMemo(
    () => financialHealth(thisMonth, monthlyIncome, "moderate", 62, emergencyProgress),
    [thisMonth, monthlyIncome, emergencyProgress],
  );

  const heroRows = compareRows.filter((r) => ["needs", "wants", "investments"].includes(r.key));
  const recent = expenses.slice(0, 5);
  const allocData = plan.buckets.map((b) => ({ name: b.label, value: b.pct, color: b.color }));

  const kpis: {
    label: string;
    value: number;
    icon: typeof Wallet;
    color: string;
    trend: number;
    trendUp: boolean;
    pct?: boolean;
    isPct?: boolean;
  }[] = [
    { label: "Net Worth", value: netWorth, icon: Wallet, color: "#0f8b8d", trend: monthChange, trendUp: true },
    { label: "Investments", value: portfolio.current + byCategory(expenses).investments, icon: TrendingUp, color: "#6366f1", trend: portfolio.pnlPct, trendUp: portfolio.pnlPct >= 0, pct: true },
    { label: "Savings Rate", value: summary.savingsRate, isPct: true, icon: PiggyBank, color: "#22c55e", trend: 4, trendUp: true },
    { label: "Goal Progress", value: 62, isPct: true, icon: Target, color: "#f59e0b", trend: 3, trendUp: true },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePlan({ data: { ...inputs, checklist } });
      toast.success("Numbers saved");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["my-plan"] });
    } catch {
      toast.error("Could not save.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppNav displayName={data?.displayName ?? undefined} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        {/* Section 1 — Welcome header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-elevated sm:p-8">
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm text-primary-foreground/80">
                {greeting()}, {data?.displayName?.split(" ")[0] ?? "there"} 👋
              </p>
              <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
                {formatINR(netWorth, true)}
              </h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-primary-foreground/90">
                <ArrowUpRight className="h-4 w-4" /> +{formatINR(monthChange, true)} this month
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-primary-foreground/70">Health Score</p>
                <p className="font-display text-2xl font-bold">{health.score}/100</p>
              </div>
              <ProgressRing
                value={health.score}
                size={84}
                stroke={8}
                color="var(--gold)"
                trackColor="rgba(255,255,255,0.2)"
              />
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <motion.div key={k.label} custom={i} variants={fadeUp} initial="hidden" animate="show">
              <Card className="shadow-soft">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: k.color + "22", color: k.color }}>
                      <k.icon className="h-5 w-5" />
                    </span>
                    <span className={"flex items-center gap-0.5 text-xs font-semibold " + (k.trendUp ? "text-emerald-500" : "text-destructive")}>
                      {k.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {k.pct ? `${Math.abs(k.trend).toFixed(1)}%` : k.isPct ? `${k.trend}%` : formatINR(k.trend, true)}
                    </span>
                  </div>
                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <p className="mt-1 font-display text-xl font-bold sm:text-2xl">
                    <AnimatedCounter
                      value={k.value}
                      format={(v) => (k.isPct ? `${Math.round(v)}%` : formatINR(v, true))}
                    />
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Section 2 — Today's insights */}
        <div>
          <h2 className="mb-3 font-display text-lg font-bold">Today's insights</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {insights.slice(0, 4).map((ins, i) => (
              <Card key={i} className="shadow-soft">
                <CardContent className="flex items-start gap-3 p-4">
                  {ins.type === "warning" ? (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  )}
                  <p className="text-sm font-medium">{ins.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Section 3 — Blueprint snapshot */}
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Current Blueprint</CardTitle>
              <Badge className="bg-primary/15 text-primary">{tier.name}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                      {allocData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, n) => [`${v}%`, n as string]} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">Invest rate</span>
                  <span className="font-display text-2xl font-bold text-primary">{plan.investRate}%</span>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual income</span>
                  <span className="font-semibold">{formatINR(inputs.annualSalary, true)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly SIP target</span>
                  <span className="font-semibold">{formatINR(plan.recommendedSip, true)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/blueprints">
                    Full blueprint <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Your numbers</DialogTitle>
                    </DialogHeader>
                    <PlanForm
                      inputs={inputs}
                      onChange={(p) => setInputs((prev) => ({ ...prev, ...p }))}
                      onSave={handleSave}
                      saving={saving}
                      dirty
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Section 4 — Spending vs Blueprint */}
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Spending vs Blueprint</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/spending">
                  Open tracker <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              {heroRows.map((r) => (
                <div key={r.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {r.emoji} {r.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        Target {r.targetPct}% · Actual {r.actualPct}%
                      </span>
                      {r.status !== "good" && (
                        <Badge
                          variant="secondary"
                          style={{
                            background: (r.status === "warn" ? "#f59e0b" : "#ef4444") + "22",
                            color: r.status === "warn" ? "#f59e0b" : "#ef4444",
                          }}
                        >
                          {r.key === "investments" ? "Behind" : "Over budget"}
                        </Badge>
                      )}
                    </span>
                  </div>
                  <Progress value={Math.min(100, (r.actualPct / Math.max(r.targetPct, 1)) * 100)} className="h-2" />
                </div>
              ))}
              {thisMonth.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No spending logged this month yet. <Link to="/spending" className="text-primary underline">Add expenses</Link> to compare against your blueprint.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section 5 — Goals + Section 6 — Recent transactions */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Goals</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/goals">
                  All goals <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              {GOALS.map((g) => (
                <div key={g.title} className="flex flex-col items-center gap-2 rounded-xl bg-muted/40 p-3 text-center">
                  <ProgressRing value={g.pct} size={66} stroke={7} color={g.color} />
                  <p className="text-xs font-medium leading-tight">{g.title}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Recent transactions</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/spending">
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {recent.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
              )}
              {recent.map((e) => {
                const meta = CATEGORY_META[e.category as keyof typeof CATEGORY_META];
                return (
                  <div key={e.id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/40">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl text-lg" style={{ background: (meta?.color ?? "#94a3b8") + "22" }}>
                        {meta?.emoji ?? "💸"}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{e.subcategory ?? meta?.label ?? e.category}</p>
                        <p className="text-xs text-muted-foreground">{e.notes ?? e.payment_method}</p>
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums">{formatINR(e.amount)}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <WealthModules />
      </main>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 13,
};

const GOALS = [
  { title: "Retirement", pct: 62, color: "#6366f1" },
  { title: "House Fund", pct: 24, color: "#0b6b6f" },
  { title: "Emergency", pct: 65, color: "#f59e0b" },
];
