// Pure analytics for the Spending Tracker / PFM module. No DB / network here.
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  getAllocation,
  type BlueprintCategoryKey,
  type RiskProfile,
} from "@/lib/blueprints";
import type { ExpenseRow } from "@/lib/expenses.functions";

export type CategoryKey = BlueprintCategoryKey;

export const EXPENSE_CATEGORIES = CATEGORY_ORDER;
export { CATEGORY_META };

export const SUBCATEGORIES: Record<CategoryKey, string[]> = {
  needs: ["Rent", "Utilities", "Food", "Transport", "Insurance"],
  wants: ["Dining", "Shopping", "Entertainment", "Travel", "Subscriptions"],
  investments: ["Mutual Funds", "Stocks", "ETFs", "Gold", "PPF", "NPS"],
  emergency: ["Emergency Savings"],
  learning: ["Courses", "Books", "Certifications"],
  giving: ["Donations", "Family Support"],
};

export const PAYMENT_METHODS = [
  "UPI",
  "Credit Card",
  "Debit Card",
  "Cash",
  "Bank Transfer",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_COLORS: Record<string, string> = {
  UPI: "#22c55e",
  "Credit Card": "#6366f1",
  "Debit Card": "#0f8b8d",
  Cash: "#f59e0b",
  "Bank Transfer": "#ec4899",
};

// "consumption" = money spent living; investments + emergency = wealth/savings.
const CONSUMPTION: CategoryKey[] = ["needs", "wants", "learning", "giving"];

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return currentMonthKey(d);
}

export function inMonth(expenses: ExpenseRow[], key: string): ExpenseRow[] {
  return expenses.filter((e) => monthKey(e.expense_date) === key);
}

export function inRange(expenses: ExpenseRow[], from: string, to: string): ExpenseRow[] {
  return expenses.filter((e) => e.expense_date >= from && e.expense_date <= to);
}

export function byCategory(expenses: ExpenseRow[]): Record<CategoryKey, number> {
  const out = {} as Record<CategoryKey, number>;
  EXPENSE_CATEGORIES.forEach((k) => (out[k] = 0));
  expenses.forEach((e) => {
    if (e.category in out) out[e.category as CategoryKey] += e.amount;
  });
  return out;
}

export function bySubcategory(expenses: ExpenseRow[]): { name: string; value: number }[] {
  const m = new Map<string, number>();
  expenses.forEach((e) => {
    const name = e.subcategory || "Other";
    m.set(name, (m.get(name) ?? 0) + e.amount);
  });
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function byPaymentMethod(expenses: ExpenseRow[]): { name: string; value: number; color: string }[] {
  const m = new Map<string, number>();
  expenses.forEach((e) => m.set(e.payment_method, (m.get(e.payment_method) ?? 0) + e.amount));
  return [...m.entries()]
    .map(([name, value]) => ({ name, value, color: PAYMENT_COLORS[name] ?? "#94a3b8" }))
    .sort((a, b) => b.value - a.value);
}

export interface PeriodSummary {
  total: number; // everything logged
  consumption: number; // needs+wants+learning+giving
  investments: number;
  emergency: number;
  savings: number; // income - consumption
  savingsRate: number; // %
  remaining: number; // income - total
}

export function summarize(expenses: ExpenseRow[], monthlyIncome: number): PeriodSummary {
  const cat = byCategory(expenses);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const consumption = CONSUMPTION.reduce((s, k) => s + cat[k], 0);
  const savings = monthlyIncome - consumption;
  return {
    total,
    consumption,
    investments: cat.investments,
    emergency: cat.emergency,
    savings,
    savingsRate: monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0,
    remaining: monthlyIncome - total,
  };
}

export interface MonthlyTrendRow {
  key: string;
  label: string;
  income: number;
  expenses: number; // consumption
  savings: number;
  investments: number;
  inflow: number;
  outflow: number;
}

export function monthlyTrend(
  expenses: ExpenseRow[],
  monthlyIncome: number,
  months = 6,
): MonthlyTrendRow[] {
  const base = currentMonthKey();
  const rows: MonthlyTrendRow[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonth(base, -i);
    const cat = byCategory(inMonth(expenses, key));
    const consumption = CONSUMPTION.reduce((s, k) => s + cat[k], 0);
    const investments = cat.investments + cat.emergency;
    rows.push({
      key,
      label: monthLabel(key),
      income: monthlyIncome,
      expenses: consumption,
      savings: monthlyIncome - consumption,
      investments,
      inflow: monthlyIncome,
      outflow: consumption + investments,
    });
  }
  return rows;
}

export type AdherenceStatus = "good" | "warn" | "bad";

export interface BlueprintCompareRow {
  key: CategoryKey;
  label: string;
  emoji: string;
  color: string;
  targetPct: number;
  actualPct: number;
  targetAmount: number;
  actualAmount: number;
  variance: number; // actualPct - targetPct
  status: AdherenceStatus;
}

export function compareToBlueprint(
  expenses: ExpenseRow[],
  monthlyIncome: number,
  risk: RiskProfile,
): BlueprintCompareRow[] {
  const alloc = getAllocation(monthlyIncome, risk);
  const cat = byCategory(expenses);
  return EXPENSE_CATEGORIES.map((key) => {
    const targetPct = alloc[key];
    const actualAmount = cat[key];
    const actualPct = monthlyIncome > 0 ? (actualAmount / monthlyIncome) * 100 : 0;
    const variance = Math.round((actualPct - targetPct) * 10) / 10;
    // For consumption categories, overspending (positive variance) is bad.
    // For investment/emergency, underspending (negative variance) is bad.
    const isInvest = key === "investments" || key === "emergency";
    const bad = isInvest ? -variance : variance; // higher = worse
    let status: AdherenceStatus = "good";
    if (bad > 7) status = "bad";
    else if (bad > 3) status = "warn";
    return {
      key,
      label: CATEGORY_META[key].label,
      emoji: CATEGORY_META[key].emoji,
      color: CATEGORY_META[key].color,
      targetPct,
      actualPct: Math.round(actualPct * 10) / 10,
      targetAmount: Math.round((targetPct / 100) * monthlyIncome),
      actualAmount,
      variance,
      status,
    };
  });
}

export function adherenceScore(rows: BlueprintCompareRow[]): number {
  if (!rows.length) return 0;
  const totalAbs = rows.reduce((s, r) => s + Math.abs(r.variance), 0);
  return Math.max(0, Math.min(100, Math.round(100 - totalAbs * 1.4)));
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Excellent", color: "#22c55e" };
  if (score >= 75) return { label: "Good", color: "#0f8b8d" };
  if (score >= 55) return { label: "Average", color: "#f59e0b" };
  return { label: "Needs Work", color: "#ef4444" };
}

export interface Insight {
  type: "warning" | "success" | "info";
  text: string;
}

export function buildSpendingInsights(
  current: ExpenseRow[],
  previous: ExpenseRow[],
  monthlyIncome: number,
  risk: RiskProfile,
): Insight[] {
  const insights: Insight[] = [];
  const compare = compareToBlueprint(current, monthlyIncome, risk);
  const sumC = summarize(current, monthlyIncome);
  const sumP = summarize(previous, monthlyIncome);

  compare.forEach((r) => {
    if (r.status === "bad") {
      const isInvest = r.key === "investments" || r.key === "emergency";
      if (isInvest && r.variance < 0) {
        insights.push({
          type: "warning",
          text: `${r.label} is ${Math.abs(r.variance).toFixed(0)}% below your blueprint target — increase contributions.`,
        });
      } else if (!isInvest && r.variance > 0) {
        const over = r.actualAmount - r.targetAmount;
        insights.push({
          type: "warning",
          text: `${r.label} exceeded budget by ${formatShort(over)} (${r.variance.toFixed(0)}% over target).`,
        });
      }
    }
  });

  // sub-category spikes
  const curSub = bySubcategory(current);
  const prevSub = new Map(bySubcategory(previous).map((s) => [s.name, s.value]));
  curSub.slice(0, 6).forEach((s) => {
    const prev = prevSub.get(s.name) ?? 0;
    if (prev > 0 && s.value > prev * 1.25) {
      const pct = Math.round(((s.value - prev) / prev) * 100);
      insights.push({ type: "warning", text: `${s.name} increased ${pct}% vs last month.` });
    }
  });

  if (sumC.savingsRate > sumP.savingsRate + 1) {
    insights.push({
      type: "success",
      text: `Savings rate improved to ${sumC.savingsRate.toFixed(0)}% (+${(sumC.savingsRate - sumP.savingsRate).toFixed(0)}%).`,
    });
  }
  if (sumC.investments >= sumP.investments && sumC.investments > 0) {
    insights.push({ type: "success", text: `You invested ${formatShort(sumC.investments)} this month.` });
  }
  if (insights.filter((i) => i.type === "warning").length === 0) {
    insights.push({ type: "success", text: "Spending discipline is on track with your blueprint." });
  }
  return insights.slice(0, 6);
}

export function buildRecommendations(
  rows: BlueprintCompareRow[],
): { text: string }[] {
  const recs: { text: string }[] = [];
  rows.forEach((r) => {
    const diff = r.actualAmount - r.targetAmount;
    if (r.key === "investments" && r.variance < -3) {
      recs.push({ text: `Increase SIP by ${formatShort(Math.abs(diff))} to match your ${r.targetPct}% investment target.` });
    } else if (r.key === "emergency" && r.variance < -2) {
      recs.push({ text: `Add ${formatShort(Math.abs(diff))} to your emergency fund this month.` });
    } else if ((r.key === "wants" || r.key === "needs") && r.variance > 4) {
      recs.push({ text: `Reduce ${r.label.toLowerCase()} by ${formatShort(diff)} to stay within blueprint.` });
    }
  });
  if (!recs.length) recs.push({ text: "Maintain your current allocation — you're tracking your blueprint well." });
  return recs.slice(0, 5);
}

function formatShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
}

// Overall financial health score blending several factors.
export interface HealthFactor {
  label: string;
  score: number; // 0-100
  weight: number;
}

export function financialHealth(
  current: ExpenseRow[],
  monthlyIncome: number,
  risk: RiskProfile,
  goalProgressPct: number,
  emergencyProgressPct: number,
): { score: number; factors: HealthFactor[] } {
  const compare = compareToBlueprint(current, monthlyIncome, risk);
  const adherence = adherenceScore(compare);
  const sum = summarize(current, monthlyIncome);
  const savingsScore = Math.max(0, Math.min(100, sum.savingsRate * 2.2));
  const investRow = compare.find((c) => c.key === "investments");
  const investScore = investRow
    ? Math.max(0, Math.min(100, 100 + investRow.variance * 6))
    : 50;

  const factors: HealthFactor[] = [
    { label: "Spending discipline", score: adherence, weight: 0.25 },
    { label: "Savings rate", score: Math.round(savingsScore), weight: 0.2 },
    { label: "Investment consistency", score: Math.round(investScore), weight: 0.2 },
    { label: "Goal progress", score: Math.round(goalProgressPct), weight: 0.15 },
    { label: "Emergency fund", score: Math.round(emergencyProgressPct), weight: 0.1 },
    { label: "Blueprint adherence", score: adherence, weight: 0.1 },
  ];
  const score = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));
  return { score: Math.max(0, Math.min(100, score)), factors };
}
