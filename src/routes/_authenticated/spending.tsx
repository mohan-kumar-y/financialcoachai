import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
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
  Legend,
} from "recharts";
import { AppNav } from "@/components/app-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyPlan } from "@/lib/plan.functions";
import { formatINR } from "@/lib/blueprints";
import { fadeUp } from "@/lib/motion";
import { ArrowDownRight, ArrowUpRight, CreditCard, Banknote, Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/spending")({
  component: SpendingPage,
});

const CATEGORIES = [
  { name: "Housing & Rent", value: 32000, color: "#0b6b6f" },
  { name: "Food & Dining", value: 14500, color: "#0f8b8d" },
  { name: "Transport", value: 8200, color: "#22c55e" },
  { name: "Shopping", value: 11800, color: "#6366f1" },
  { name: "Entertainment", value: 6400, color: "#ec4899" },
  { name: "Bills & Utilities", value: 9100, color: "#f59e0b" },
];

const TREND = [
  { month: "Jan", income: 120000, expense: 78000 },
  { month: "Feb", income: 120000, expense: 82000 },
  { month: "Mar", income: 125000, expense: 76000 },
  { month: "Apr", income: 125000, expense: 88000 },
  { month: "May", income: 130000, expense: 81000 },
  { month: "Jun", income: 130000, expense: 82000 },
];

const SOURCES = [
  { name: "UPI", value: 41200, icon: Smartphone, color: "#22c55e" },
  { name: "Credit Card", value: 28600, icon: CreditCard, color: "#6366f1" },
  { name: "Cash", value: 12200, icon: Banknote, color: "#f59e0b" },
];

function SpendingPage() {
  const fetchPlan = useServerFn(getMyPlan);
  const { data } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });

  const totalSpend = useMemo(() => CATEGORIES.reduce((s, c) => s + c.value, 0), []);
  const income = 130000;
  const savingsRate = Math.round(((income - totalSpend) / income) * 100);

  return (
    <div className="min-h-screen bg-muted/30">
      <AppNav displayName={data?.displayName ?? undefined} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Spending Tracker</h1>
          <p className="mt-1 text-muted-foreground">
            Auto-tracked from UPI, cards and cash — categorised and trended.
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Spend", value: formatINR(totalSpend), trend: "+4.2%", up: false },
            { label: "Monthly Income", value: formatINR(income), trend: "+3.8%", up: true },
            { label: "Net Saved", value: formatINR(income - totalSpend), trend: "+6.1%", up: true },
            { label: "Savings Rate", value: `${savingsRate}%`, trend: "+1.4%", up: true },
          ].map((k, i) => (
            <motion.div
              key={k.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-soft"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {k.label}
              </p>
              <p className="mt-1 font-display text-xl font-bold sm:text-2xl">{k.value}</p>
              <span
                className={
                  "mt-1 flex items-center gap-0.5 text-xs font-semibold " +
                  (k.up ? "text-emerald-500" : "text-destructive")
                }
              >
                {k.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {k.trend} vs last month
              </span>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Category pie */}
          <Card className="border-border/60 bg-gradient-card shadow-soft">
            <CardHeader>
              <CardTitle>Category breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={CATEGORIES}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {CATEGORIES.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number, n) => [formatINR(v), n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                    <span className="font-semibold">{formatINR(c.value, true)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Income vs expense */}
          <Card className="border-border/60 bg-gradient-card shadow-soft">
            <CardHeader>
              <CardTitle>Income vs Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={TREND}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickFormatter={(v) => formatINR(v, true)}
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [formatINR(v), n]} />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment sources */}
        <div className="grid gap-4 sm:grid-cols-3">
          {SOURCES.map((s, i) => (
            <motion.div
              key={s.name}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="flex items-center gap-4 rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-soft"
            >
              <span
                className="grid h-12 w-12 place-items-center rounded-2xl"
                style={{ background: s.color + "22", color: s.color }}
              >
                <s.icon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">{s.name} spends</p>
                <p className="font-display text-xl font-bold">{formatINR(s.value)}</p>
              </div>
            </motion.div>
          ))}
        </div>
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
} as const;
