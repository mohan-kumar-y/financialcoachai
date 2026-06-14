import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { AppNav } from "@/components/app-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProgressRing } from "@/components/progress-ring";
import { AddExpenseDialog, type ExpenseFormValues } from "@/components/spending/AddExpenseDialog";
import { ExpenseTable } from "@/components/spending/ExpenseTable";
import { getMyPlan } from "@/lib/plan.functions";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  seedDemoExpenses,
  type ExpenseRow,
} from "@/lib/expenses.functions";
import { formatINR } from "@/lib/blueprints";
import {
  summarize,
  compareToBlueprint,
  adherenceScore,
  scoreLabel,
  buildSpendingInsights,
  buildRecommendations,
  monthlyTrend,
  byCategory,
  byPaymentMethod,
  bySubcategory,
  inMonth,
  inRange,
  currentMonthKey,
  shiftMonth,
  monthLabel,
  CATEGORY_META,
  EXPENSE_CATEGORIES,
} from "@/lib/spending";
import type { RiskProfile } from "@/lib/blueprints";
import {
  Plus,
  Wallet,
  TrendingDown,
  PiggyBank,
  TrendingUp,
  Target,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/spending")({
  component: SpendingPage,
});

const RISKS: { id: RiskProfile; label: string }[] = [
  { id: "conservative", label: "Conservative" },
  { id: "moderate", label: "Moderate" },
  { id: "aggressive", label: "Aggressive" },
];

function SpendingPage() {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getMyPlan);
  const fetchExpenses = useServerFn(listExpenses);
  const addFn = useServerFn(createExpense);
  const editFn = useServerFn(updateExpense);
  const delFn = useServerFn(deleteExpense);
  const seedFn = useServerFn(seedDemoExpenses);

  const { data: planData } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });
  const { data: expData, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => fetchExpenses(),
  });

  const expenses = expData?.expenses ?? [];
  const monthlyIncome = planData?.plan ? Number(planData.plan.annualSalary) / 12 : 100000;

  const [risk, setRisk] = useState<RiskProfile>("moderate");
  const [periodMode, setPeriodMode] = useState<"month" | "range">("month");
  const [month, setMonth] = useState(currentMonthKey());
  const [range, setRange] = useState({ from: "", to: "" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseFormValues | null>(null);
  const [saving, setSaving] = useState(false);

  const periodExpenses = useMemo(() => {
    if (periodMode === "range" && range.from && range.to) return inRange(expenses, range.from, range.to);
    return inMonth(expenses, month);
  }, [expenses, periodMode, range, month]);

  const prevExpenses = useMemo(() => inMonth(expenses, shiftMonth(month, -1)), [expenses, month]);

  const summary = useMemo(() => summarize(periodExpenses, monthlyIncome), [periodExpenses, monthlyIncome]);
  const compareRows = useMemo(
    () => compareToBlueprint(periodExpenses, monthlyIncome, risk),
    [periodExpenses, monthlyIncome, risk],
  );
  const score = useMemo(() => adherenceScore(compareRows), [compareRows]);
  const scoreInfo = scoreLabel(score);
  const insights = useMemo(
    () => buildSpendingInsights(periodExpenses, prevExpenses, monthlyIncome, risk),
    [periodExpenses, prevExpenses, monthlyIncome, risk],
  );
  const recs = useMemo(() => buildRecommendations(compareRows), [compareRows]);
  const trend = useMemo(() => monthlyTrend(expenses, monthlyIncome, 6), [expenses, monthlyIncome]);
  const catData = useMemo(() => {
    const c = byCategory(periodExpenses);
    return EXPENSE_CATEGORIES.map((k) => ({
      name: CATEGORY_META[k].label,
      value: c[k],
      color: CATEGORY_META[k].color,
    })).filter((d) => d.value > 0);
  }, [periodExpenses]);
  const payData = useMemo(() => byPaymentMethod(periodExpenses), [periodExpenses]);
  const subData = useMemo(() => bySubcategory(periodExpenses).slice(0, 8), [periodExpenses]);

  const alerts = useMemo(() => {
    const out: string[] = [];
    compareRows.forEach((r) => {
      if (r.status === "bad") {
        if (r.key === "investments" || r.key === "emergency") {
          if (r.variance < 0) out.push(`${r.label} contribution is behind blueprint target.`);
        } else if (r.variance > 0) {
          out.push(`${r.label} budget exceeded by ${formatINR(r.actualAmount - r.targetAmount, true)}.`);
        }
      }
    });
    if (summary.savingsRate < 15) out.push("Savings rate dropped below 15% this period.");
    return out;
  }, [compareRows, summary]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["expenses"] });

  const handleSubmit = async (v: ExpenseFormValues) => {
    setSaving(true);
    try {
      const payload = {
        amount: v.amount,
        category: v.category,
        subcategory: v.subcategory || null,
        expense_date: v.expense_date,
        payment_method: v.payment_method,
        notes: v.notes || null,
      };
      if (v.id) await editFn({ data: { id: v.id, ...payload } });
      else await addFn({ data: payload });
      toast.success(v.id ? "Expense updated" : "Expense added");
      setDialogOpen(false);
      setEditing(null);
      refresh();
    } catch {
      toast.error("Could not save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: ExpenseRow) => {
    try {
      await delFn({ data: { id: e.id } });
      toast.success("Expense deleted");
      refresh();
    } catch {
      toast.error("Could not delete.");
    }
  };

  const handleSeed = async () => {
    try {
      await seedFn();
      toast.success("Sample transactions added");
      refresh();
    } catch {
      toast.error("Could not add samples.");
    }
  };

  const openEdit = (e: ExpenseRow) => {
    setEditing({
      id: e.id,
      amount: e.amount,
      category: e.category as ExpenseFormValues["category"],
      subcategory: e.subcategory ?? "",
      expense_date: e.expense_date,
      payment_method: e.payment_method,
      notes: e.notes ?? "",
    });
    setDialogOpen(true);
  };

  const periodLabel =
    periodMode === "range" && range.from && range.to
      ? `${range.from} → ${range.to}`
      : monthLabel(month);

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <AppNav displayName={planData?.displayName ?? undefined} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Spending Tracker</h1>
            <p className="mt-1 text-muted-foreground">
              Track every rupee against your Financial Blueprint · {periodLabel}
            </p>
          </div>
          {expenses.length === 0 && !isLoading && (
            <Button variant="outline" onClick={handleSeed}>
              <Sparkles className="h-4 w-4" /> Load sample data
            </Button>
          )}
        </div>

        {/* Period selector */}
        <Card className="shadow-soft">
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={periodMode === "month" && month === currentMonthKey() ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPeriodMode("month");
                  setMonth(currentMonthKey());
                }}
              >
                This month
              </Button>
              <Button
                variant={periodMode === "month" && month === shiftMonth(currentMonthKey(), -1) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPeriodMode("month");
                  setMonth(shiftMonth(currentMonthKey(), -1));
                }}
              >
                Last month
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={range.from}
                  onChange={(e) => {
                    setRange({ ...range, from: e.target.value });
                    setPeriodMode("range");
                  }}
                  className="h-9 w-[150px]"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={range.to}
                  onChange={(e) => {
                    setRange({ ...range, to: e.target.value });
                    setPeriodMode("range");
                  }}
                  className="h-9 w-[150px]"
                />
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-muted p-1">
              {RISKS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRisk(r.id)}
                  className={
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                    (risk === r.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Monthly Income" value={formatINR(monthlyIncome, true)} icon={Wallet} color="#0f8b8d" />
          <SummaryCard label="Total Expenses" value={formatINR(summary.total, true)} icon={TrendingDown} color="#ef4444" />
          <SummaryCard label="Total Savings" value={formatINR(summary.savings, true)} icon={PiggyBank} color="#22c55e" />
          <SummaryCard label="Investments" value={formatINR(summary.investments, true)} icon={TrendingUp} color="#6366f1" />
          <SummaryCard label="Remaining Budget" value={formatINR(summary.remaining, true)} icon={Wallet} color={summary.remaining >= 0 ? "#0b6b6f" : "#ef4444"} />
          <SummaryCard label="Adherence" value={`${score}/100`} icon={Target} color={scoreInfo.color} />
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5 shadow-soft">
            <CardContent className="flex flex-wrap gap-x-6 gap-y-2 p-4">
              {alerts.map((a) => (
                <span key={a} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {a}
                </span>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Blueprint comparison + adherence */}
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" /> Blueprint comparison engine
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Your actual spending vs your {risk} blueprint for this period.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {compareRows.map((r) => (
                <div key={r.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {r.emoji} {r.label}
                    </span>
                    <span className="flex items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground">
                        {formatINR(r.actualAmount, true)} / {formatINR(r.targetAmount, true)}
                      </span>
                      <VarianceBadge variance={r.variance} status={r.status} />
                    </span>
                  </div>
                  <div className="relative">
                    <Progress value={Math.min(100, (r.actualPct / Math.max(r.targetPct, 1)) * 100)} className="h-2" />
                    <span
                      className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground/50"
                      style={{ left: "100%" }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Target {r.targetPct}%</span>
                    <span>Actual {r.actualPct}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Adherence Score</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <ProgressRing value={score} size={150} color={scoreInfo.color} sublabel={scoreInfo.label} />
              <p className="text-center text-sm text-muted-foreground">
                {score >= 75
                  ? "You're closely tracking your blueprint."
                  : "Adjust spending to improve adherence."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* AI coach */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-primary" /> AI Financial Coach
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm"
                >
                  {ins.type === "warning" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                  <span>{ins.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-5 w-5 text-primary" /> AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {recs.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-gradient-card p-3 text-sm"
                >
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span>{r.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Analytics */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Visual analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="category">
              <TabsList className="mb-4 flex flex-wrap">
                <TabsTrigger value="category">Category</TabsTrigger>
                <TabsTrigger value="trend">Trend</TabsTrigger>
                <TabsTrigger value="compare">Income vs Expense</TabsTrigger>
                <TabsTrigger value="cashflow">Cash flow</TabsTrigger>
                <TabsTrigger value="payment">Payment</TabsTrigger>
              </TabsList>

              <TabsContent value="category">
                <div className="grid items-center gap-6 lg:grid-cols-2">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={catData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={2} stroke="none">
                          {catData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip {...tooltipProps} formatter={(v: number, n) => [formatINR(v), n as string]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {subData.map((s) => (
                      <div key={s.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <span>{s.name}</span>
                        <span className="font-semibold tabular-nums">{formatINR(s.value)}</span>
                      </div>
                    ))}
                    {subData.length === 0 && <p className="text-sm text-muted-foreground">No data for this period.</p>}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="trend">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={axisTick} />
                      <YAxis tickFormatter={(v) => formatINR(v, true)} tick={axisTick} width={64} />
                      <Tooltip {...tooltipProps} formatter={(v: number, n) => [formatINR(v), n as string]} />
                      <Legend />
                      <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="savings" name="Savings" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="investments" name="Investments" stroke="#6366f1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="compare">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={axisTick} />
                      <YAxis tickFormatter={(v) => formatINR(v, true)} tick={axisTick} width={64} />
                      <Tooltip {...tooltipProps} formatter={(v: number, n) => [formatINR(v), n as string]} />
                      <Legend />
                      <Bar dataKey="income" name="Income" fill="#0f8b8d" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="savings" name="Savings" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="cashflow">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="in" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="out" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={axisTick} />
                      <YAxis tickFormatter={(v) => formatINR(v, true)} tick={axisTick} width={64} />
                      <Tooltip {...tooltipProps} formatter={(v: number, n) => [formatINR(v), n as string]} />
                      <Legend />
                      <Area type="monotone" dataKey="inflow" name="Inflow" stroke="#22c55e" strokeWidth={2} fill="url(#in)" />
                      <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#ef4444" strokeWidth={2} fill="url(#out)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="payment">
                <div className="grid items-center gap-6 lg:grid-cols-2">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={payData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={105} paddingAngle={2} stroke="none">
                          {payData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip {...tooltipProps} formatter={(v: number, n) => [formatINR(v), n as string]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {payData.map((p) => (
                      <div key={p.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ background: p.color }} /> {p.name}
                        </span>
                        <span className="font-semibold tabular-nums">{formatINR(p.value)}</span>
                      </div>
                    ))}
                    {payData.length === 0 && <p className="text-sm text-muted-foreground">No data for this period.</p>}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Transaction history</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseTable expenses={periodExpenses} onEdit={openEdit} onDelete={handleDelete} />
          </CardContent>
        </Card>
      </main>

      {/* Floating add button */}
      <motion.div className="fixed bottom-6 right-6 z-40" initial={{ scale: 0 }} animate={{ scale: 1 }}>
        <Button
          size="lg"
          className="h-14 rounded-full px-6 shadow-elevated"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-5 w-5" /> Add expense
        </Button>
      </motion.div>

      <AddExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        saving={saving}
        initial={editing}
      />
    </div>
  );
}

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
const tooltipProps = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    fontSize: 13,
  },
};

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  color: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <span
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{ background: color + "22", color }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-display text-lg font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function VarianceBadge({ variance, status }: { variance: number; status: "good" | "warn" | "bad" }) {
  const color =
    status === "good" ? "#22c55e" : status === "warn" ? "#f59e0b" : "#ef4444";
  return (
    <Badge variant="secondary" style={{ background: color + "22", color }} className="tabular-nums">
      {variance > 0 ? "+" : ""}
      {variance}%
    </Badge>
  );
}
