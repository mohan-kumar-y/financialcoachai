import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SiteHeader } from "@/components/site-header";
import { AuroraBackground } from "@/components/aurora-background";
import { buildBlueprint, formatINR, GALLERY } from "@/lib/blueprints";
import { fadeUp } from "@/lib/motion";
import {
  ArrowRight,
  Sparkles,
  CreditCard,
  Briefcase,
  Target,
  LayoutDashboard,
  Flame,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WealthOS — Your Financial Operating System" },
      {
        name: "description",
        content:
          "Know exactly how much to spend, how much to invest, and how fast you'll build wealth. AI financial blueprints, spending tracker, goal planner and FIRE calculator in one premium dashboard.",
      },
      { property: "og:title", content: "WealthOS — Your Financial Operating System" },
      {
        property: "og:description",
        content: "AI money blueprints, spending tracker, goal planner and FIRE calculator — all in one.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Sparkles, title: "AI Financial Blueprint", desc: "Personalized money plans that tell you exactly where every rupee should go.", color: "#22c55e" },
  { icon: CreditCard, title: "Spending Tracker", desc: "Track expenses against your blueprint with AI insights and alerts.", color: "#f59e0b" },
  { icon: Target, title: "Goal Planner", desc: "House, car, retirement, FIRE — visualized with live progress rings.", color: "#ec4899" },
  { icon: Briefcase, title: "Wealth Advisor", desc: "Portfolio health, diversification scores and AI rebalancing actions.", color: "#6366f1" },
  { icon: LayoutDashboard, title: "Wealth Dashboard", desc: "Net worth, savings rate and financial health in one command center.", color: "#0f8b8d" },
  { icon: Flame, title: "FIRE Calculator", desc: "See your financial-independence age with step-up SIP projections.", color: "#0b6b6f" },
];

function Landing() {
  const navigate = useNavigate();
  const [income, setIncome] = useState(100000);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const slices = useMemo(() => buildBlueprint(income, "moderate"), [income]);
  const chart = slices.map((s) => ({ name: s.label, value: s.pct, monthly: s.monthly, color: s.color }));

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader transparent />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero px-4 pb-20 pt-32 text-primary-foreground sm:px-6">
        <AuroraBackground />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-white/5 px-4 py-1.5 text-xs font-medium backdrop-blur"
            >
              <Sparkles className="h-3.5 w-3.5" /> AI-powered personal finance
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-6 font-display text-4xl font-extrabold leading-[1.1] sm:text-6xl"
            >
              Your <span className="text-gradient-gold">Financial Operating System</span>
            </motion.h1>
            <motion.ul
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-6 space-y-2 text-lg text-primary-foreground/85"
            >
              <li>✓ How much to spend</li>
              <li>✓ How much to invest</li>
              <li>✓ How fast you'll build wealth</li>
            </motion.ul>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Button asChild size="lg" variant="secondary" className="text-base">
                <Link to="/auth">
                  Create My Blueprint <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/blueprints">Browse Income Blueprints</Link>
              </Button>
            </motion.div>
          </div>

          {/* Interactive income slider */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="glass-strong rounded-3xl p-6 text-foreground shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Monthly income
                </p>
                <p className="font-display text-3xl font-extrabold">{formatINR(income, true)}</p>
              </div>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                Live blueprint
              </span>
            </div>
            <div className="mt-5">
              <Slider
                value={[income]}
                min={25000}
                max={500000}
                step={5000}
                onValueChange={([v]) => setIncome(v)}
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>₹25K</span>
                <span>₹5L+</span>
              </div>
            </div>
            <div className="mt-4 grid items-center gap-4 sm:grid-cols-[160px_1fr]">
              <div className="relative h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chart} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                      {chart.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, _n, item) => [
                        `${v}% · ${formatINR((item?.payload as { monthly: number }).monthly, true)}`,
                        (item?.payload as { name: string }).name,
                      ]}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5">
                {slices.map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.pct}% · {formatINR(s.monthly, true)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Blueprint gallery */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Financial Blueprints for every income</h2>
          <p className="mt-3 text-muted-foreground">
            Browse pre-built money plans — no sign-up required.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GALLERY.slice(0, 4).map((g, i) => (
            <motion.div
              key={g.id}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              whileHover={{ y: -5 }}
            >
              <Link
                to="/blueprints"
                className="group relative block overflow-hidden rounded-3xl border border-border/60 bg-gradient-card p-6 shadow-soft transition-shadow hover:shadow-elevated"
              >
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                  style={{ background: g.accent }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{g.emoji}</span>
                  <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: g.accent + "22", color: g.accent }}>
                    {g.incomeLabel}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{g.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link to="/blueprints">
              See all blueprints <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Feature sections */}
      <section className="bg-muted/40 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Everything to run your money</h2>
            <p className="mt-3 text-muted-foreground">Six tools that take you from plan to portfolio to freedom.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="rounded-3xl border border-border/60 bg-gradient-card p-6 shadow-soft"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: f.color + "22", color: f.color }}>
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 sm:px-6">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-hero px-8 py-14 text-center text-primary-foreground shadow-elevated">
          <AuroraBackground />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold">Start your Financial Operating System</h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
              Create a free account, pick your income blueprint, and get your personalised plan in seconds.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8 text-base">
              <Link to="/auth">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        <p>WealthOS · Educational guidance, not financial advice.</p>
      </footer>
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
