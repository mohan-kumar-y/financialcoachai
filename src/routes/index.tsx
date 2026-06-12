import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { AuroraBackground } from "@/components/aurora-background";
import { AnimatedCounter } from "@/components/animated-counter";
import { formatINR } from "@/lib/blueprints";
import {
  ArrowRight,
  TrendingUp,
  PiggyBank,
  Wallet,
  Target,
  Sparkles,
  Map,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WealthOS — Build Wealth with AI-Powered Financial Blueprints" },
      {
        name: "description",
        content:
          "Get personalized AI money plans, track investments & net worth, manage spending and achieve your financial goals — all in one premium fintech dashboard.",
      },
      { property: "og:title", content: "WealthOS — AI-Powered Financial Blueprints" },
      {
        property: "og:description",
        content:
          "Personalized money plans, investment tracking, spending insights and goal planning powered by AI.",
      },
    ],
  }),
  component: Landing,
});

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const KPIS = [
  { label: "Net Worth", value: 4850000, icon: Wallet, trend: "+12.4%", up: true, color: "#22c55e" },
  { label: "Monthly Savings", value: 62000, icon: PiggyBank, trend: "+8.1%", up: true, color: "#0f8b8d" },
  { label: "Investments", value: 2940000, icon: TrendingUp, trend: "+18.6%", up: true, color: "#6366f1" },
  { label: "Goals Progress", value: 68, icon: Target, trend: "-2.3%", up: false, color: "#f59e0b", suffix: "%" },
];

const ACTIONS = [
  {
    featured: true,
    badge: "Most Popular",
    emoji: "🗺️",
    icon: Map,
    title: "Browse Financial Blueprints",
    desc: "Explore AI-generated money plans for your income level and lifestyle.",
    cta: "View Blueprints",
    to: "/blueprints" as const,
    gradient: "linear-gradient(135deg, #0b6b6f, #22c55e)",
  },
  {
    emoji: "✨",
    icon: Sparkles,
    title: "Build My Personal Finance Plan",
    desc: "Get a personalized AI blueprint based on your income, goals and lifestyle.",
    cta: "Create My Plan",
    to: "/blueprints" as const,
    gradient: "linear-gradient(135deg, #6366f1, #0f8b8d)",
  },
  {
    emoji: "📈",
    icon: TrendingUp,
    title: "Track Investments & Net Worth",
    desc: "See all your investments, gains and total net worth in one place.",
    cta: "Track Wealth",
    to: "/dashboard" as const,
    gradient: "linear-gradient(135deg, #0f8b8d, #22c55e)",
  },
  {
    emoji: "💳",
    icon: CreditCard,
    title: "Understand My Spending",
    desc: "Auto-track expenses from Gmail, SMS and UPI in one clean view.",
    cta: "Connect & Track",
    to: "/spending" as const,
    gradient: "linear-gradient(135deg, #f59e0b, #ec4899)",
  },
  {
    emoji: "🎯",
    icon: Target,
    title: "Plan My Financial Goals",
    desc: "House, Car, Retirement, FIRE and more — visualized with progress rings.",
    cta: "Set Goals",
    to: "/goals" as const,
    gradient: "linear-gradient(135deg, #ec4899, #6366f1)",
  },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader transparent />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero px-4 pb-28 pt-32 text-primary-foreground sm:px-6">
        <AuroraBackground />
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-white/5 px-4 py-1.5 text-xs font-medium backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5" /> AI-powered financial operating system
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-6 font-display text-4xl font-extrabold leading-[1.1] sm:text-6xl"
          >
            Build Wealth with{" "}
            <span className="text-gradient-gold">AI-Powered Financial Blueprints</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80"
          >
            Get personalized money plans, track investments, manage spending, and achieve your
            financial goals — all in one beautifully simple dashboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg" variant="secondary" className="text-base">
              <Link to="/auth">
                Create My Plan <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/blueprints">Browse Blueprints</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Quick financial snapshot */}
      <section className="mx-auto -mt-16 max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPIS.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="glass-strong rounded-2xl p-5 shadow-elevated"
            >
              <div className="flex items-center justify-between">
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: kpi.color + "22", color: kpi.color }}
                >
                  <kpi.icon className="h-5 w-5" />
                </span>
                <span
                  className={
                    "flex items-center gap-0.5 text-xs font-semibold " +
                    (kpi.up ? "text-emerald-500" : "text-destructive")
                  }
                >
                  {kpi.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {kpi.trend}
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </p>
              <p className="mt-1 font-display text-xl font-bold sm:text-2xl">
                <AnimatedCounter
                  value={kpi.value}
                  format={(v) =>
                    kpi.suffix
                      ? `${Math.round(v)}${kpi.suffix}`
                      : formatINR(v, true)
                  }
                />
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Main action center */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Your money, one command center</h2>
          <p className="mt-3 text-muted-foreground">
            Five focused tools that take you from plan to portfolio to financial freedom.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {ACTIONS.map((a, i) => (
            <motion.div
              key={a.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className={
                "group relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-card p-7 shadow-soft transition-shadow hover:shadow-elevated " +
                (a.featured ? "md:col-span-2" : "")
              }
            >
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ background: a.gradient }}
              />
              {a.badge && (
                <span className="absolute right-5 top-5 rounded-full bg-gradient-gold px-3 py-1 text-xs font-semibold text-gold-foreground shadow-soft">
                  {a.badge}
                </span>
              )}
              <div
                className="grid h-14 w-14 place-items-center rounded-2xl text-3xl shadow-soft"
                style={{ background: a.gradient }}
              >
                <span>{a.emoji}</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold">{a.title}</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{a.desc}</p>
              <Button asChild variant="ghost" className="mt-4 px-0 text-primary hover:bg-transparent">
                <Link to={a.to}>
                  {a.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
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
