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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { AppNav } from "@/components/app-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/progress-ring";
import { HoldingDialog, type HoldingFormValues } from "@/components/advisor/HoldingDialog";
import { getMyPlan } from "@/lib/plan.functions";
import {
  listHoldings,
  createHolding,
  updateHolding,
  deleteHolding,
  seedDemoHoldings,
  type HoldingRow,
} from "@/lib/holdings.functions";
import {
  analyzePortfolio,
  buildAdvisorActions,
  simulateSip,
  wealthScore,
  MARKET_INDICES,
  MARKET_NEWS,
  ASSET_LABEL,
} from "@/lib/advisor";
import { scoreLabel } from "@/lib/spending";
import { formatINR } from "@/lib/blueprints";
import {
  Plus,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Layers,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Newspaper,
  Wand2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/advisor")({
  component: AdvisorPage,
});

function AdvisorPage() {
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getMyPlan);
  const fetchHoldings = useServerFn(listHoldings);
  const addFn = useServerFn(createHolding);
  const editFn = useServerFn(updateHolding);
  const delFn = useServerFn(deleteHolding);
  const seedFn = useServerFn(seedDemoHoldings);

  const { data: planData } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });
  const { data: holdData, isLoading } = useQuery({
    queryKey: ["holdings"],
    queryFn: () => fetchHoldings(),
  });

  const holdings = holdData?.holdings ?? [];
  const monthlyIncome = planData?.plan ? Number(planData.plan.annualSalary) / 12 : 100000;
  const monthlySip = planData?.plan ? Number(planData.plan.currentSip) || 20000 : 20000;

  const portfolio = useMemo(() => analyzePortfolio(holdings), [holdings]);
  const actions = useMemo(() => buildAdvisorActions(portfolio), [portfolio]);
  const advisorScore = useMemo(
    () => wealthScore(portfolio, monthlySip, monthlyIncome),
    [portfolio, monthlySip, monthlyIncome],
  );
  const scoreInfo = scoreLabel(advisorScore);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HoldingFormValues | null>(null);
  const [saving, setSaving] = useState(false);

  // What-if simulator
  const [sip, setSip] = useState(monthlySip);
  const [stepUp, setStepUp] = useState(10);
  const [years, setYears] = useState(20);
  const [lump, setLump] = useState(0);
  const whatIf = useMemo(() => simulateSip(sip, years, 0.12, stepUp, lump), [sip, years, stepUp, lump]);
  const projData = useMemo(() => {
    const rows = [];
    for (let y = 1; y <= years; y++) {
      rows.push({ year: `Y${y}`, corpus: simulateSip(sip, y, 0.12, stepUp, lump).corpus });
    }
    return rows;
  }, [sip, years, stepUp, lump]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["holdings"] });

  const handleSubmit = async (v: HoldingFormValues) => {
    setSaving(true);
    try {
      const payload = {
        asset_type: v.asset_type,
        name: v.name,
        symbol: v.symbol || null,
        units: v.units,
        avg_buy_price: v.avg_buy_price,
        current_price: v.current_price,
        category: v.category || null,
      };
      if (v.id) await editFn({ data: { id: v.id, ...payload } });
      else await addFn({ data: payload });
      toast.success(v.id ? "Holding updated" : "Holding added");
      setDialogOpen(false);
      setEditing(null);
      refresh();
    } catch {
      toast.error("Could not save holding.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: HoldingRow) => {
    try {
      await delFn({ data: { id: h.id } });
      toast.success("Holding removed");
      refresh();
    } catch {
      toast.error("Could not delete.");
    }
  };

  const handleSeed = async () => {
    try {
      await seedFn();
      toast.success("Sample portfolio loaded");
      refresh();
    } catch {
      toast.error("Could not load samples.");
    }
  };

  const openEdit = (h: HoldingRow) => {
    setEditing({
      id: h.id,
      asset_type: h.asset_type,
      name: h.name,
      symbol: h.symbol ?? "",
      units: h.units,
      avg_buy_price: h.avg_buy_price,
      current_price: h.current_price,
      category: h.category ?? "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <AppNav displayName={planData?.displayName ?? undefined} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Financial Advisor</h1>
            <p className="mt-1 text-muted-foreground">
              Your AI wealth coach — portfolio analysis, market intelligence & action plan.
            </p>
          </div>
          {holdings.length === 0 && !isLoading && (
            <Button variant="outline" onClick={handleSeed}>
              <Sparkles className="h-4 w-4" /> Load sample portfolio
            </Button>
          )}
        </div>

        {/* Top scores */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Portfolio value"
            value={formatINR(portfolio.current, true)}
            icon={Layers}
            color="#0f8b8d"
            trend={portfolio.pnlPct}
          />
          <KpiCard
            label="Total P&L"
            value={formatINR(portfolio.pnl, true)}
            icon={portfolio.pnl >= 0 ? TrendingUp : TrendingDown}
            color={portfolio.pnl >= 0 ? "#22c55e" : "#ef4444"}
            trend={portfolio.pnlPct}
          />
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 p-4">
              <ProgressRing value={portfolio.diversificationScore} size={70} stroke={7} color="#6366f1" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Diversification</p>
                <p className="font-display text-lg font-bold">{portfolio.diversificationScore}/100</p>
                <p className="text-xs text-muted-foreground">
                  Top holding {portfolio.concentrationRisk}%
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="flex items-center gap-4 p-4">
              <ProgressRing value={advisorScore} size={70} stroke={7} color={scoreInfo.color} />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Wealth Score</p>
                <p className="font-display text-lg font-bold">{advisorScore}/100</p>
                <p className="text-xs" style={{ color: scoreInfo.color }}>
                  {scoreInfo.label}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Allocation + holdings */}
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-primary" /> Asset allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolio.byType}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={95}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {portfolio.byType.map((d) => (
                        <Cell key={d.type} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipProps} formatter={(v: number, n) => [formatINR(v), n as string]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground">Health</span>
                  <span className="font-display text-2xl font-bold text-primary">{portfolio.healthScore}</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {portfolio.byType.map((t) => (
                  <div key={t.type} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: t.color }} /> {t.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {portfolio.current ? Math.round((t.value / portfolio.current) * 100) : 0}%
                    </span>
                  </div>
                ))}
                {portfolio.byType.length === 0 && (
                  <p className="text-sm text-muted-foreground">Add holdings to see your allocation.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Holding</th>
                      <th className="hidden px-4 py-3 sm:table-cell">Type</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-right">P&L</th>
                      <th className="hidden px-4 py-3 text-right md:table-cell">Weight</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.holdings.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          No holdings yet.
                        </td>
                      </tr>
                    )}
                    {portfolio.holdings.map((h) => (
                      <tr key={h.id} className="border-t border-border/60 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <p className="font-medium">{h.name}</p>
                          <p className="text-xs text-muted-foreground">{h.symbol ?? h.category ?? "—"}</p>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                          {ASSET_LABEL[h.asset_type] ?? h.asset_type}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatINR(h.current, true)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={h.pnl >= 0 ? "text-emerald-500" : "text-destructive"}>
                            {h.pnl >= 0 ? "+" : ""}
                            {h.pnlPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground md:table-cell">
                          {h.weight.toFixed(0)}%
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(h)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(h)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action center + market */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-primary" /> AI Action Center
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {actions.map((a, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
                  <Badge
                    className="shrink-0"
                    style={{ background: severityColor(a.severity) + "22", color: severityColor(a.severity) }}
                  >
                    {a.type}
                  </Badge>
                  <span className="text-sm">{a.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Newspaper className="h-5 w-5 text-primary" /> Market Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MARKET_INDICES.map((m) => (
                  <div key={m.symbol} className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">{m.name}</p>
                    <p
                      className={
                        "flex items-center gap-0.5 font-display text-sm font-bold " +
                        (m.change >= 0 ? "text-emerald-500" : "text-destructive")
                      }
                    >
                      {m.change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {Math.abs(m.change)}%
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {MARKET_NEWS.map((n) => (
                  <div key={n.title} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background:
                          n.impact === "positive" ? "#22c55e" : n.impact === "negative" ? "#ef4444" : "#94a3b8",
                      }}
                    />
                    <span>
                      {n.title} <span className="text-xs text-muted-foreground">· {n.source}</span>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* What-if simulator */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-5 w-5 text-primary" /> What-if simulator
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Model SIP increases, step-ups and lump-sum investments at 12% p.a.
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-5">
              <SliderRow label="Monthly SIP" value={formatINR(sip, true)}>
                <Slider value={[sip]} min={1000} max={300000} step={1000} onValueChange={([v]) => setSip(v)} />
              </SliderRow>
              <SliderRow label="Annual step-up" value={`${stepUp}%`}>
                <Slider value={[stepUp]} min={0} max={25} step={1} onValueChange={([v]) => setStepUp(v)} />
              </SliderRow>
              <SliderRow label="Lump sum today" value={formatINR(lump, true)}>
                <Slider value={[lump]} min={0} max={5000000} step={50000} onValueChange={([v]) => setLump(v)} />
              </SliderRow>
              <SliderRow label="Horizon" value={`${years} yrs`}>
                <Slider value={[years]} min={3} max={35} step={1} onValueChange={([v]) => setYears(v)} />
              </SliderRow>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <Stat label="Invested" value={formatINR(whatIf.invested, true)} />
                <Stat label="Gains" value={formatINR(whatIf.gains, true)} />
                <Stat label="Corpus" value={formatINR(whatIf.corpus, true)} highlight />
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wcorpus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tickFormatter={(v) => formatINR(v, true)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={64} />
                  <Tooltip {...tooltipProps} formatter={(v: number) => [formatINR(v, true), "Corpus"]} />
                  <Area type="monotone" dataKey="corpus" stroke="var(--primary)" strokeWidth={2} fill="url(#wcorpus)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </main>

      <motion.div className="fixed bottom-6 right-6 z-40" initial={{ scale: 0 }} animate={{ scale: 1 }}>
        <Button
          size="lg"
          className="h-14 rounded-full px-6 shadow-elevated"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-5 w-5" /> Add holding
        </Button>
      </motion.div>

      <HoldingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        saving={saving}
        initial={editing}
      />
    </div>
  );
}

const tooltipProps = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    fontSize: 13,
  },
};

function severityColor(s: "high" | "medium" | "low") {
  return s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#0f8b8d";
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  icon: typeof Layers;
  color: string;
  trend: number;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: color + "22", color }}>
            <Icon className="h-4 w-4" />
          </span>
          <span
            className={"flex items-center gap-0.5 text-xs font-semibold " + (trend >= 0 ? "text-emerald-500" : "text-destructive")}
          >
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-display text-lg font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function SliderRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={"rounded-xl border p-3 " + (highlight ? "border-primary/40 bg-accent" : "border-border bg-muted/40")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"font-display text-base font-bold tabular-nums " + (highlight ? "text-primary" : "")}>{value}</p>
    </div>
  );
}
