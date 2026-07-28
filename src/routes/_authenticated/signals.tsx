import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { AppNav } from "@/components/app-nav";
import { PageHeader, StatCard } from "@/components/wealth/kit";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataStatus } from "@/components/wealth/data-status";
import { analyzePortfolio } from "@/lib/advisor";
import { listHoldings } from "@/lib/holdings.functions";
import { getMyPlan } from "@/lib/plan.functions";
import { useLiveHoldings } from "@/lib/use-live-holdings";
import type { StockFundamentals } from "@/lib/market-data";
import { buildSellSignals, type SellReason } from "@/lib/market";
import { TrendingDown, Activity, DollarSign, Target, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/signals")({
  component: SignalsPage,
});

const REASON_META: Record<SellReason, { icon: React.ComponentType<{ className?: string }>; color: string; blurb: string }> = {
  "Fundamental deterioration": { icon: Activity, color: "#ef4444", blurb: "Business metrics or sector trend are weakening." },
  "Valuation excess": { icon: DollarSign, color: "#f59e0b", blurb: "Price has run ahead of fundamentals." },
  "Goal achievement": { icon: Target, color: "#22c55e", blurb: "Position has hit strong gains — book profits." },
  "Risk increase": { icon: ShieldAlert, color: "#f97316", blurb: "Concentration or risk profile has risen." },
};

const STRENGTH_STYLE: Record<string, string> = {
  Strong: "bg-destructive/15 text-destructive",
  Moderate: "bg-amber-500/15 text-amber-600",
  Watch: "bg-sky-500/15 text-sky-600",
};

function SignalsPage() {
  const fetchHoldings = useServerFn(listHoldings);
  const fetchPlan = useServerFn(getMyPlan);
  const { data: planData } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });
  const { data: holdData, isLoading } = useQuery({ queryKey: ["holdings"], queryFn: () => fetchHoldings() });

  const holdings = holdData?.holdings ?? [];
  const { liveHoldings, quoteMap, meta, hasEligible } = useLiveHoldings(holdings);
  const portfolio = useMemo(() => analyzePortfolio(liveHoldings), [liveHoldings]);

  const anyFundAvailable = useMemo(
    () => Object.values(quoteMap).some((f) => f?.found),
    [quoteMap],
  );

  const typedQuoteMap: Record<string, StockFundamentals | undefined> = quoteMap;

  const signals = useMemo(
    () => buildSellSignals(portfolio.holdings, typedQuoteMap),
    [portfolio, typedQuoteMap],
  );

  const byReason = (Object.keys(REASON_META) as SellReason[]).map((r) => ({
    reason: r,
    items: signals.filter((s) => s.reason === r),
  }));

  const empty = !isLoading && holdings.length === 0;
  const fundamentalsUnavailable =
    symbols.length > 0 && quotesData != null && !anyFundAvailable;

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      <AppNav displayName={planData?.displayName ?? undefined} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <PageHeader
          icon={TrendingDown}
          title="Sell Signal Engine"
          subtitle="When to trim or exit — signals for fundamental deterioration, valuation excess, goal achievement and rising risk, each with the reasoning."
          actions={meta ? <DataStatus meta={meta} /> : undefined}
        />


        {empty ? (
          <EmptyState />
        ) : signals.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <p className="font-display text-lg font-bold">No sell signals right now</p>
              <p className="max-w-sm text-sm text-muted-foreground">None of your holdings trigger a trim/exit signal today. Keep compounding.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {byReason.map(({ reason, items }, i) => {
                const m = REASON_META[reason];
                return (
                  <StatCard
                    key={reason}
                    label={reason}
                    value={`${items.length}`}
                    hint={m.blurb}
                    icon={m.icon}
                    color={m.color}
                    delay={i * 0.05}
                  />
                );
              })}
            </div>

            <div className="space-y-3">
              {signals.map((s, i) => {
                const m = REASON_META[s.reason];
                const Icon = m.icon;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Card className="shadow-soft" style={{ borderLeft: `3px solid ${m.color}` }}>
                      <CardContent className="flex items-start gap-3 p-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: m.color + "22", color: m.color }}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{s.holding}</span>
                            <span className="text-xs text-muted-foreground">{s.symbol}</span>
                            <Badge variant="secondary" className={"ml-auto " + (STRENGTH_STYLE[s.strength] ?? "")}>
                              {s.strength}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs font-medium uppercase tracking-wide" style={{ color: m.color }}>
                            {s.reason}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{s.explanation}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {fundamentalsUnavailable && !empty && (
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-muted-foreground">
              Live fundamentals are currently unavailable for your equity holdings, so fundamental- and valuation-based signals are hidden.
              Goal-achievement and concentration signals are still shown because they use your real P&amp;L and portfolio weights.
            </p>
          </div>
        )}
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
        <p className="font-display text-lg font-bold">No holdings yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">Add holdings in the Advisor to get personalised sell signals.</p>
        <Button asChild>
          <Link to="/advisor">Go to Advisor</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
