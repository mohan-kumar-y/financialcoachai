import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  PiggyBank,
  Shield,
  Flag,
  CalendarCheck,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WealthOS — Your Personal Financial Operating System" },
      {
        name: "description",
        content:
          "Allocate your salary across Needs, Wants, Emergency Fund, Insurance, Investments and Wealth Creation. Know when to step up SIPs, deploy lump-sum and rebalance.",
      },
      { property: "og:title", content: "WealthOS — Your Personal Financial Operating System" },
      {
        property: "og:description",
        content:
          "A login-protected dashboard for exactly where, when and how much to invest at every income level.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: PiggyBank,
    title: "Salary allocation",
    desc: "Split every paycheck across Needs, Wants, Emergency Fund, Insurance, Investments & Wealth Creation.",
  },
  {
    icon: ArrowUpRight,
    title: "Step-up investing",
    desc: "Your invest rate climbs with each appraisal — see exactly when to increase SIPs.",
  },
  {
    icon: TrendingUp,
    title: "Lump-sum playbook",
    desc: "Turn bonuses and windfalls into wealth with a disciplined STP deployment plan.",
  },
  {
    icon: Shield,
    title: "Safety first",
    desc: "Right-sized emergency fund and insurance before you chase aggressive returns.",
  },
  {
    icon: Flag,
    title: "Milestones",
    desc: "Track net-worth checkpoints from your first 1× income to FIRE.",
  },
  {
    icon: CalendarCheck,
    title: "Monitoring rhythm",
    desc: "Monthly, quarterly and yearly checklists so you review and rebalance on time.",
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
    <div className="min-h-screen">
      {/* Nav */}
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
          <span className="flex items-center gap-2 font-display text-lg font-bold text-primary-foreground">
            <TrendingUp className="h-5 w-5" /> WealthOS
          </span>
          <Button asChild variant="secondary" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero px-4 pb-24 pt-32 text-primary-foreground sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-primary-foreground/25 px-4 py-1 text-xs font-medium text-primary-foreground/90">
            Your money, on a system
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight sm:text-6xl">
            Where, when & how much to invest — decided for you
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
            WealthOS turns your salary into a clear plan: allocation across six money buckets,
            step-up SIPs that grow with your income, lump-sum deployment, and rebalancing reminders —
            all the way to financial independence.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="text-base">
              <Link to="/auth">
                Build my plan <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/auth">I already have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold">One dashboard. Total clarity.</h2>
          <p className="mt-3 text-muted-foreground">
            Everything you need to allocate, invest, monitor and rebalance — in one place.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-gradient-card p-6 shadow-soft transition hover:shadow-elevated"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-hero px-8 py-14 text-center text-primary-foreground shadow-elevated">
          <h2 className="font-display text-3xl font-bold">Start your Financial Operating System</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Create a free account, enter your salary, and get your personalised allocation in seconds.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8 text-base">
            <Link to="/auth">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>WealthOS · Educational guidance, not financial advice.</p>
      </footer>
    </div>
  );
}
