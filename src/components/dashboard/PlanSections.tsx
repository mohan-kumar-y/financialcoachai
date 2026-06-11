import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  type ComputedPlan,
  type PlanInputs,
  type Currency,
  TIERS,
  CHECKPOINTS,
  formatCurrency,
  projectGrowth,
  buildMilestones,
  getTier,
} from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Flag,
  PiggyBank,
  TrendingUp,
} from "lucide-react";

/* ---------------- Allocation ---------------- */

export function AllocationSection({
  plan,
  currency,
}: {
  plan: ComputedPlan;
  currency: Currency;
}) {
  const data = plan.buckets.map((b) => ({ name: b.label, value: b.pct, color: b.color }));

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          Monthly salary allocation
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Based on the <span className="font-semibold text-foreground">{plan.tier.name}</span> tier ·{" "}
          {formatCurrency(plan.monthlyIncome, currency)} / month in hand
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="relative h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, n) => [`${v}%`, n as string]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  fontSize: 13,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">Invest rate</span>
            <span className="font-display text-3xl font-bold text-primary">{plan.investRate}%</span>
            <span className="text-xs text-muted-foreground">of income</span>
          </div>
        </div>

        <ul className="space-y-3">
          {plan.buckets.map((b) => (
            <li key={b.key} className="flex items-center gap-3">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                style={{ background: b.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{b.label}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {b.pct}% · {formatCurrency(b.monthly, currency, true)}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{b.blurb}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ---------------- Roadmap tiers ---------------- */

export function RoadmapSection({
  currency,
  activeTierId,
}: {
  currency: Currency;
  activeTierId: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          The income roadmap — invest more as you earn more
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Every tier keeps lifestyle in check and pushes a bigger share into investing.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-5">
          {TIERS.map((t) => {
            const active = t.id === activeTierId;
            const investRate = t.alloc.investments + t.alloc.wealth;
            return (
              <div
                key={t.id}
                className={`rounded-xl border p-4 transition ${
                  active
                    ? "border-primary bg-accent shadow-elevated"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold">{t.name}</span>
                  {active && <Badge className="bg-primary text-primary-foreground">You</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currencyBand(t.min, t.max, currency)}
                </p>
                <div className="mt-3 flex items-end gap-1">
                  <span className="font-display text-2xl font-bold text-primary">{investRate}%</span>
                  <span className="pb-1 text-xs text-muted-foreground">invested</span>
                </div>
                <p className="mt-2 text-xs leading-snug text-muted-foreground">{t.tagline}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function currencyBand(min: number, max: number | null, currency: Currency) {
  const factor = currency === "USD" ? 1 / 84 : currency === "EUR" ? 1 / 90 : 1;
  const lo = formatCurrency(min * factor, currency, true);
  if (max === null) return `${lo}+ / yr`;
  const hi = formatCurrency(max * factor, currency, true);
  return `${lo} – ${hi} / yr`;
}

/* ---------------- SIP projection ---------------- */

export function ProjectionSection({
  inputs,
  currency,
}: {
  inputs: PlanInputs;
  currency: Currency;
}) {
  const rows = useMemo(() => projectGrowth(inputs, 10), [inputs]);
  const chartData = rows.map((r) => ({
    year: `Y${r.year}`,
    Invested: Math.round(r.cumulativeInvested),
    Corpus: Math.round(r.projectedCorpus),
  }));
  const final = rows[rows.length - 1];

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUpRight className="h-5 w-5 text-primary" />
          Step-up SIP projection (10 years)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          SIP grows {inputs.sipStepUpPct}% / yr with your {inputs.annualIncrementPct}% increments ·
          assumes 12% p.a. returns.
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Year-10 SIP" value={formatCurrency(final.monthlySip, currency, true)} />
          <Stat
            label="Total invested"
            value={formatCurrency(final.cumulativeInvested, currency, true)}
          />
          <Stat
            label="Projected corpus"
            value={formatCurrency(final.projectedCorpus, currency, true)}
            highlight
          />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="corpus" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--investments)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--investments)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="invested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--needs)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--needs)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <YAxis
                tickFormatter={(v) => formatCurrency(v, currency, true)}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                width={64}
              />
              <Tooltip
                formatter={(v: number, n) => [formatCurrency(v, currency, true), n as string]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  fontSize: 13,
                }}
              />
              <Area
                type="monotone"
                dataKey="Corpus"
                stroke="var(--investments)"
                strokeWidth={2}
                fill="url(#corpus)"
              />
              <Area
                type="monotone"
                dataKey="Invested"
                stroke="var(--needs)"
                strokeWidth={2}
                fill="url(#invested)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Year</th>
                <th className="py-2 pr-3 font-medium">Salary</th>
                <th className="py-2 pr-3 font-medium">Tier</th>
                <th className="py-2 pr-3 font-medium">Monthly SIP</th>
                <th className="py-2 pr-3 text-right font-medium">Corpus</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year} className="border-b last:border-0">
                  <td className="py-2 pr-3 tabular-nums">{r.year}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatCurrency(r.annualSalary, currency, true)}
                  </td>
                  <td className="py-2 pr-3">{r.tierName}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatCurrency(r.monthlySip, currency, true)}
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                    {formatCurrency(r.projectedCorpus, currency, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? "border-primary/40 bg-accent" : "border-border bg-muted/40"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

/* ---------------- Milestones ---------------- */

export function MilestonesSection({
  inputs,
  currency,
}: {
  inputs: PlanInputs;
  currency: Currency;
}) {
  const milestones = useMemo(() => buildMilestones(inputs), [inputs]);
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-primary" />
          Key financial milestones
        </CardTitle>
        <p className="text-sm text-muted-foreground">Net-worth checkpoints on the road to independence.</p>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-5 border-l border-border pl-6">
          {milestones.map((m) => (
            <li key={m.id} className="relative">
              <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-gradient-gold text-[10px] font-bold text-gold-foreground">
                ★
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{m.title}</span>
                <span className="font-display font-bold text-primary tabular-nums">
                  {formatCurrency(m.target, currency, true)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{m.detail}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ---------------- Emergency & lump-sum guidance ---------------- */

export function ActionsSection({
  plan,
  inputs,
  currency,
}: {
  plan: ComputedPlan;
  inputs: PlanInputs;
  currency: Currency;
}) {
  const sipBehind = plan.sipGap > 0;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Emergency fund</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-display text-2xl font-bold text-primary">
            {formatCurrency(plan.emergencyTarget, currency, true)}
          </p>
          <p className="text-sm text-muted-foreground">
            Target = {inputs.emergencyMonths} months of expenses. Build it with{" "}
            {formatCurrency(plan.emergencyMonthlyContribution, currency, true)}/mo before scaling
            investments.
          </p>
          <Progress value={Math.min(100, (inputs.emergencyMonths / 12) * 100)} className="h-2" />
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your SIP target</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-display text-2xl font-bold text-primary">
            {formatCurrency(plan.recommendedSip, currency, true)}/mo
          </p>
          <p className="text-sm text-muted-foreground">
            {sipBehind ? (
              <>
                Increase your SIP by{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(plan.sipGap, currency, true)}
                </span>{" "}
                to hit your tier target.
              </>
            ) : (
              <>You're at or above target — step up {inputs.sipStepUpPct}% at your next appraisal.</>
            )}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lump-sum playbook</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Bonuses / windfalls → invest, don't park.</li>
            <li>• Deploy via STP over 3–6 months to average in.</li>
            <li>• Top up when markets drop &gt;10%.</li>
            <li>• Keep 1 month buffer before deploying.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Checkpoints ---------------- */

const CADENCE_ICON = {
  Monthly: CalendarDays,
  Quarterly: CalendarClock,
  Yearly: CalendarCheck,
} as const;

export function CheckpointsSection({
  checklist,
  onToggle,
}: {
  checklist: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => void;
}) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Monitoring checkpoints
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tick these off — your progress is saved to your account.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-3">
        {CHECKPOINTS.map((cp) => {
          const Icon = CADENCE_ICON[cp.cadence];
          return (
            <div key={cp.cadence} className="rounded-xl border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-display font-bold">{cp.cadence}</span>
              </div>
              <ul className="space-y-2.5">
                {cp.items.map((item, i) => {
                  const key = `${cp.cadence}-${i}`;
                  const checked = !!checklist[key];
                  return (
                    <li key={key}>
                      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => onToggle(key, e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--primary)]"
                        />
                        <span className={checked ? "text-muted-foreground line-through" : ""}>
                          {item}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export { getTier };
