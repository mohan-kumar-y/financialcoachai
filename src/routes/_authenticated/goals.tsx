import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { AppNav } from "@/components/app-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProgressRing } from "@/components/progress-ring";
import { getMyPlan } from "@/lib/plan.functions";
import { formatINR } from "@/lib/blueprints";
import { fadeUp } from "@/lib/motion";
import { Plus, CalendarDays, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/goals")({
  component: GoalsPage,
});

interface Goal {
  id: string;
  emoji: string;
  title: string;
  type: string;
  target: number;
  saved: number;
  monthly: number;
  targetDate: string;
  color: string;
}

const INITIAL_GOALS: Goal[] = [
  { id: "1", emoji: "🏠", title: "Dream Home", type: "House", target: 8000000, saved: 2600000, monthly: 60000, targetDate: "2031", color: "#0b6b6f" },
  { id: "2", emoji: "🚗", title: "New Car", type: "Car", target: 1500000, saved: 920000, monthly: 25000, targetDate: "2027", color: "#0f8b8d" },
  { id: "3", emoji: "🏖️", title: "Europe Trip", type: "Vacation", target: 600000, saved: 410000, monthly: 20000, targetDate: "2026", color: "#ec4899" },
  { id: "4", emoji: "🛡️", title: "Emergency Fund", type: "Emergency Fund", target: 720000, saved: 540000, monthly: 15000, targetDate: "2026", color: "#f59e0b" },
  { id: "5", emoji: "🌴", title: "Retirement Corpus", type: "Retirement", target: 80000000, saved: 12500000, monthly: 45000, targetDate: "2048", color: "#6366f1" },
  { id: "6", emoji: "🔥", title: "FIRE Number", type: "FIRE", target: 50000000, saved: 9800000, monthly: 70000, targetDate: "2043", color: "#22c55e" },
];

const GOAL_TYPES = ["House", "Car", "Vacation", "Emergency Fund", "Retirement", "FIRE"];

function GoalsPage() {
  const fetchPlan = useServerFn(getMyPlan);
  const { data } = useQuery({ queryKey: ["my-plan"], queryFn: () => fetchPlan() });

  const [goals, setGoals] = useState<Goal[]>(INITIAL_GOALS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "House", target: 0, saved: 0, monthly: 0, targetDate: "" });

  const totals = useMemo(() => {
    const target = goals.reduce((s, g) => s + g.target, 0);
    const saved = goals.reduce((s, g) => s + g.saved, 0);
    const monthly = goals.reduce((s, g) => s + g.monthly, 0);
    return { target, saved, monthly, pct: target ? Math.round((saved / target) * 100) : 0 };
  }, [goals]);

  const addGoal = () => {
    if (!form.title || form.target <= 0) return;
    const palette = ["#0b6b6f", "#22c55e", "#6366f1", "#ec4899", "#f59e0b", "#0f8b8d"];
    setGoals((g) => [
      ...g,
      {
        id: crypto.randomUUID(),
        emoji: "🎯",
        title: form.title,
        type: form.type,
        target: form.target,
        saved: form.saved,
        monthly: form.monthly,
        targetDate: form.targetDate || "—",
        color: palette[g.length % palette.length],
      },
    ]);
    setForm({ title: "", type: "House", target: 0, saved: 0, monthly: 0, targetDate: "" });
    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <AppNav displayName={data?.displayName ?? undefined} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Goal Planner</h1>
            <p className="mt-1 text-muted-foreground">
              Track every milestone with live progress rings.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> New goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a financial goal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Down payment"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, type: t })}
                        className={
                          "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                          (form.type === t
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-accent")
                        }
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Target amount (₹)</Label>
                    <Input
                      type="number"
                      value={form.target || ""}
                      onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current savings (₹)</Label>
                    <Input
                      type="number"
                      value={form.saved || ""}
                      onChange={(e) => setForm({ ...form, saved: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly (₹)</Label>
                    <Input
                      type="number"
                      value={form.monthly || ""}
                      onChange={(e) => setForm({ ...form, monthly: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Target year</Label>
                    <Input
                      value={form.targetDate}
                      onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                      placeholder="2030"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addGoal}>Add goal</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-border/60 bg-gradient-card p-6 shadow-soft sm:flex-row sm:justify-between">
          <div className="flex items-center gap-6">
            <ProgressRing value={totals.pct} size={130} color="var(--primary)" sublabel="overall" />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total saved across goals</p>
              <p className="font-display text-2xl font-bold">{formatINR(totals.saved, true)}</p>
              <p className="text-sm text-muted-foreground">
                of {formatINR(totals.target, true)} target
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-muted/50 px-5 py-4 text-center">
            <p className="text-sm text-muted-foreground">Monthly contribution</p>
            <p className="font-display text-2xl font-bold">{formatINR(totals.monthly)}</p>
          </div>
        </div>

        {/* Goal cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g, i) => {
            const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
            return (
              <motion.div
                key={g.id}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
              >
                <Card className="h-full border-border/60 bg-gradient-card shadow-soft">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="grid h-11 w-11 place-items-center rounded-2xl text-2xl"
                          style={{ background: g.color + "22" }}
                        >
                          {g.emoji}
                        </span>
                        <div>
                          <h3 className="font-display text-base font-bold leading-tight">{g.title}</h3>
                          <p className="text-xs text-muted-foreground">{g.type}</p>
                        </div>
                      </div>
                      <ProgressRing value={pct} size={68} stroke={7} color={g.color} />
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Saved</span>
                        <span className="font-semibold">{formatINR(g.saved, true)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Target</span>
                        <span className="font-semibold">{formatINR(g.target, true)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border/60 pt-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Wallet className="h-3.5 w-3.5" /> {formatINR(g.monthly, true)}/mo
                        </span>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" /> {g.targetDate}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
