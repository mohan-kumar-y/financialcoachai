import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { SiteHeader } from "@/components/site-header";
import { AuroraBackground } from "@/components/aurora-background";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";
import {
  INCOME_PRESETS,
  buildBlueprint,
  buildInsights,
  formatINR,
  GALLERY,
  type RiskProfile,
  type CategorySlice,
} from "@/lib/blueprints";
import { CheckCircle2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/blueprints")({
  head: () => ({
    meta: [
      { title: "Financial Blueprints — AI Money Plans by Income | WealthOS" },
      {
        name: "description",
        content:
          "Explore AI-generated monthly money blueprints for every income level — see exactly how to split needs, wants, investments, emergency fund, learning and giving.",
      },
      { property: "og:title", content: "Financial Blueprints — WealthOS" },
      {
        property: "og:description",
        content: "Interactive AI money plans by income level and risk profile.",
      },
    ],
  }),
  component: BlueprintsPage,
});

const RISKS: { id: RiskProfile; label: string }[] = [
  { id: "conservative", label: "Conservative" },
  { id: "moderate", label: "Moderate" },
  { id: "aggressive", label: "Aggressive" },
];

function BlueprintsPage() {
  const [income, setIncome] = useState(100000);
  const [custom, setCustom] = useState(false);
  const [risk, setRisk] = useState<RiskProfile>("moderate");

  const slices = useMemo(() => buildBlueprint(income, risk), [income, risk]);
  const insights = useMemo(() => buildInsights(income, risk), [income, risk]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-hero px-4 py-14 text-primary-foreground sm:px-6">
        <AuroraBackground />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-white/5 px-4 py-1.5 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Flagship feature
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold sm:text-5xl">
            Financial Blueprints
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
            Pick your monthly income and risk appetite. Watch your personalised money plan rebuild
            in real time.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
        {/* Filters */}
        <div className="glass-strong rounded-3xl p-5 shadow-soft sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Monthly income
              </p>
              <div className="flex flex-wrap gap-2">
                {INCOME_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setIncome(p.value);
                      setCustom(false);
                    }}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                      !custom && income === p.value
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setCustom(true)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                    custom
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  Custom
                </button>
              </div>
              {custom && (
                <div className="mt-3 max-w-xs">
                  <Input
                    type="number"
                    min={1000}
                    step={1000}
                    value={income}
                    onChange={(e) => setIncome(Math.max(0, Number(e.target.value)))}
                    placeholder="Enter monthly income (₹)"
                  />
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Risk profile
              </p>
              <div className="inline-flex rounded-full bg-muted p-1">
                {RISKS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRisk(r.id)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                      risk === r.id
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chart + legend */}
        <BlueprintChart income={income} slices={slices} />

        {/* Breakdown cards */}
        <div>
          <h2 className="mb-4 font-display text-2xl font-bold">Blueprint breakdown</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {slices.map((s, i) => (
              <BreakdownCard key={s.key} slice={s} index={i} income={income} />
            ))}
          </div>
        </div>

        {/* AI insights */}
        <div>
          <h2 className="mb-4 font-display text-2xl font-bold">AI insights</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((ins, i) => (
              <motion.div
                key={ins.text}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="flex items-start gap-3 rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-soft"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <p className="text-sm font-medium">{ins.text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Gallery */}
        <div>
          <h2 className="mb-1 font-display text-2xl font-bold">Blueprint gallery</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Pre-built templates for every income range. Click to load.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {GALLERY.map((g, i) => (
              <motion.button
                key={g.id}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                whileHover={{ y: -5 }}
                onClick={() => {
                  setCustom(false);
                  setIncome(g.income);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="group relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-card p-6 text-left shadow-soft transition-shadow hover:shadow-elevated"
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                  style={{ background: g.accent }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{g.emoji}</span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ background: g.accent + "22", color: g.accent }}
                  >
                    {g.incomeLabel}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{g.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Donut chart ---------- */

function BlueprintChart({ income, slices }: { income: number; slices: CategorySlice[] }) {
  const data = slices.map((s) => ({ name: s.label, value: s.pct, monthly: s.monthly, color: s.color }));

  return (
    <div className="grid items-center gap-6 rounded-3xl border border-border/60 bg-gradient-card p-6 shadow-soft lg:grid-cols-[1.1fr_1fr]">
      <div className="relative h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={88}
              outerRadius={130}
              paddingAngle={2}
              stroke="none"
              animationDuration={700}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                fontSize: 13,
              }}
              formatter={(value: number, _n, item) => [
                `${value}% · ${formatINR((item?.payload as { monthly: number }).monthly)}`,
                (item?.payload as { name: string }).name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total monthly income
          </span>
          <span className="font-display text-2xl font-extrabold sm:text-3xl">
            {formatINR(income)}
          </span>
          <span className="text-xs text-muted-foreground">Monthly blueprint</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {slices.map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
              {s.emoji} {s.label}
            </span>
            <span className="text-sm font-semibold">
              {s.pct}% · {formatINR(s.monthly, true)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Breakdown card ---------- */

function BreakdownCard({
  slice,
  index,
  income,
}: {
  slice: CategorySlice;
  index: number;
  income: number;
}) {
  const isEmergency = slice.key === "emergency";
  const needsMonthly = income * 0.4; // rough needs proxy for emergency target
  const target = needsMonthly * 6;
  const monthsToFund = Math.max(1, Math.ceil(target / Math.max(1, slice.monthly)));
  const progress = 35; // illustrative current funding level

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
    >
      <Card className="h-full overflow-hidden border-border/60 bg-gradient-card shadow-soft">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span
              className="grid h-11 w-11 place-items-center rounded-2xl text-2xl"
              style={{ background: slice.color + "22" }}
            >
              {slice.emoji}
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ background: slice.color + "22", color: slice.color }}
            >
              {slice.pct}%
            </span>
          </div>
          <h3 className="mt-4 font-display text-lg font-bold">{slice.label}</h3>
          <p className="mt-0.5 text-2xl font-extrabold" style={{ color: slice.color }}>
            {formatINR(slice.monthly)}
            <span className="text-sm font-medium text-muted-foreground"> /mo</span>
          </p>

          {isEmergency ? (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Target: {formatINR(target, true)}</span>
                <span>{progress}% in 6 mo</span>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                ~6 months of contributions reaches your buffer.
              </p>
            </div>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {slice.includes.map((inc) => (
                <li
                  key={inc}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {inc}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
