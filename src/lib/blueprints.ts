// Pure financial-blueprint modelling for the /blueprints module.
// Currency is INR (monthly income based). No DB / network — safe anywhere.

export type RiskProfile = "conservative" | "moderate" | "aggressive";

export type BlueprintCategoryKey =
  | "needs"
  | "wants"
  | "investments"
  | "emergency"
  | "learning"
  | "giving";

export interface CategoryMeta {
  key: BlueprintCategoryKey;
  label: string;
  emoji: string;
  color: string; // hex per spec
  includes: string[];
}

export const CATEGORY_META: Record<BlueprintCategoryKey, CategoryMeta> = {
  needs: {
    key: "needs",
    label: "Needs",
    emoji: "🏠",
    color: "#0b6b6f",
    includes: ["Housing", "Utilities", "Food", "Transport"],
  },
  wants: {
    key: "wants",
    label: "Wants",
    emoji: "🎉",
    color: "#0f8b8d",
    includes: ["Entertainment", "Dining", "Shopping", "Travel"],
  },
  investments: {
    key: "investments",
    label: "Investments",
    emoji: "📈",
    color: "#22c55e",
    includes: ["Equity Mutual Funds", "Index Funds", "Gold", "International ETFs"],
  },
  emergency: {
    key: "emergency",
    label: "Emergency Fund",
    emoji: "🛡️",
    color: "#f59e0b",
    includes: ["Target Amount", "Current Progress", "Completion Timeline"],
  },
  learning: {
    key: "learning",
    label: "Learning",
    emoji: "📚",
    color: "#6366f1",
    includes: ["Courses", "Certifications", "Skill Development"],
  },
  giving: {
    key: "giving",
    label: "Giving",
    emoji: "❤️",
    color: "#ec4899",
    includes: ["Charity", "Donations", "Family Support"],
  },
};

export const CATEGORY_ORDER: BlueprintCategoryKey[] = [
  "needs",
  "wants",
  "investments",
  "emergency",
  "learning",
  "giving",
];

export const INCOME_PRESETS: { label: string; value: number }[] = [
  { label: "₹25K", value: 25000 },
  { label: "₹50K", value: 50000 },
  { label: "₹75K", value: 75000 },
  { label: "₹1L", value: 100000 },
  { label: "₹1.5L", value: 150000 },
  { label: "₹2L", value: 200000 },
  { label: "₹5L", value: 500000 },
];

type Alloc = Record<BlueprintCategoryKey, number>;

// Base allocations keyed by monthly-income band.
const BASE_BANDS: { max: number; alloc: Alloc }[] = [
  { max: 25000, alloc: { needs: 60, wants: 15, investments: 12, emergency: 8, learning: 3, giving: 2 } },
  { max: 50000, alloc: { needs: 50, wants: 18, investments: 20, emergency: 6, learning: 4, giving: 2 } },
  { max: 75000, alloc: { needs: 45, wants: 20, investments: 25, emergency: 5, learning: 3, giving: 2 } },
  { max: 100000, alloc: { needs: 40, wants: 20, investments: 30, emergency: 5, learning: 3, giving: 2 } },
  { max: 150000, alloc: { needs: 38, wants: 18, investments: 33, emergency: 4, learning: 4, giving: 3 } },
  { max: 200000, alloc: { needs: 35, wants: 18, investments: 36, emergency: 3, learning: 4, giving: 4 } },
  { max: Infinity, alloc: { needs: 28, wants: 17, investments: 44, emergency: 2, learning: 4, giving: 5 } },
];

const RISK_DELTA: Record<RiskProfile, Partial<Alloc>> = {
  conservative: { investments: -6, emergency: 4, needs: 2 },
  moderate: {},
  aggressive: { investments: 7, wants: -4, emergency: -3 },
};

function normalize(alloc: Alloc): Alloc {
  const total = CATEGORY_ORDER.reduce((s, k) => s + Math.max(0, alloc[k]), 0);
  const out = {} as Alloc;
  CATEGORY_ORDER.forEach((k) => {
    out[k] = Math.round((Math.max(0, alloc[k]) / total) * 100);
  });
  // fix rounding drift onto the largest bucket
  const drift = 100 - CATEGORY_ORDER.reduce((s, k) => s + out[k], 0);
  if (drift !== 0) out.needs += drift;
  return out;
}

export function getAllocation(monthlyIncome: number, risk: RiskProfile): Alloc {
  const band = BASE_BANDS.find((b) => monthlyIncome <= b.max) ?? BASE_BANDS[BASE_BANDS.length - 1];
  const delta = RISK_DELTA[risk];
  const merged = { ...band.alloc };
  (Object.keys(delta) as BlueprintCategoryKey[]).forEach((k) => {
    merged[k] = (merged[k] ?? 0) + (delta[k] ?? 0);
  });
  return normalize(merged);
}

export interface CategorySlice extends CategoryMeta {
  pct: number;
  monthly: number;
}

export function buildBlueprint(monthlyIncome: number, risk: RiskProfile): CategorySlice[] {
  const alloc = getAllocation(monthlyIncome, risk);
  return CATEGORY_ORDER.map((key) => ({
    ...CATEGORY_META[key],
    pct: alloc[key],
    monthly: Math.round((alloc[key] / 100) * monthlyIncome),
  }));
}

export function formatINR(value: number, compact = false): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (compact) {
    const abs = Math.abs(safe);
    if (abs >= 1e7) return `₹${(safe / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `₹${(safe / 1e5).toFixed(2)} L`;
    if (abs >= 1e3) return `₹${(safe / 1e3).toFixed(1)} K`;
    return `₹${Math.round(safe)}`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(safe);
}

export interface AiInsight {
  text: string;
}

const RISK_RETURN: Record<RiskProfile, number> = {
  conservative: 0.09,
  moderate: 0.115,
  aggressive: 0.135,
};

export function buildInsights(monthlyIncome: number, risk: RiskProfile, age = 28): AiInsight[] {
  const slices = buildBlueprint(monthlyIncome, risk);
  const sip = slices.find((s) => s.key === "investments")?.monthly ?? 0;
  const needs = slices.find((s) => s.key === "needs")?.monthly ?? 0;
  const emergencyMonthly = slices.find((s) => s.key === "emergency")?.monthly ?? 1;
  const emergencyTarget = needs * 6;
  const monthsToEmergency = Math.max(1, Math.ceil(emergencyTarget / Math.max(1, emergencyMonthly)));

  const annualIncome = monthlyIncome * 12;
  const term = Math.max(annualIncome * 12, 5000000); // ~12x income, min ₹50L
  const expectedExpenses = needs * 12;
  const retirementCorpus = expectedExpenses * 25 * 1.6; // inflation-padded 25x

  // FIRE estimate: grow SIP @ return until corpus = 25x annual expenses
  const r = RISK_RETURN[risk] / 12;
  const targetFire = expectedExpenses * 25;
  let corpus = 0;
  let months = 0;
  while (corpus < targetFire && months < 720) {
    corpus = corpus * (1 + r) + sip;
    months++;
  }
  const fireAge = age + Math.round(months / 12);

  return [
    { text: `Emergency fund will be fully funded in ${monthsToEmergency} months.` },
    { text: `Recommended monthly SIP: ${formatINR(sip)}.` },
    { text: `Suggested term insurance cover: ${formatINR(term, true)}.` },
    { text: `Suggested health insurance: ₹10–25 L family floater.` },
    { text: `Retirement corpus target: ${formatINR(retirementCorpus, true)}.` },
    { text: `Estimated FIRE age: ${fireAge} (at ${(RISK_RETURN[risk] * 100).toFixed(1)}% p.a.).` },
  ];
}

export interface GalleryTemplate {
  id: string;
  incomeLabel: string;
  income: number;
  title: string;
  description: string;
  accent: string;
  emoji: string;
}

export const GALLERY: GalleryTemplate[] = [
  { id: "survival", incomeLabel: "₹25K", income: 25000, title: "Survival Mode", description: "Essential spending focused blueprint to stay afloat and start saving.", accent: "#0b6b6f", emoji: "🪙" },
  { id: "starter", incomeLabel: "₹50K", income: 50000, title: "Starter Wealth", description: "Build habits, fund emergencies, and begin disciplined investing.", accent: "#0f8b8d", emoji: "🌱" },
  { id: "growth", incomeLabel: "₹75K", income: 75000, title: "Growth Mode", description: "Scale up SIPs while keeping lifestyle inflation in check.", accent: "#22c55e", emoji: "🚀" },
  { id: "builder", incomeLabel: "₹1L", income: 100000, title: "Wealth Builder", description: "Balanced blueprint with strong investment momentum.", accent: "#6366f1", emoji: "🏗️" },
  { id: "accelerated", incomeLabel: "₹2L", income: 200000, title: "Accelerated Wealth", description: "Aggressive compounding with diversified asset classes.", accent: "#f59e0b", emoji: "⚡" },
  { id: "freedom", incomeLabel: "₹5L", income: 500000, title: "Financial Freedom", description: "Optimised for tax efficiency and rapid corpus growth.", accent: "#ec4899", emoji: "🕊️" },
  { id: "legacy", incomeLabel: "₹10L+", income: 1000000, title: "Legacy Builder", description: "Wealth preservation, philanthropy, and generational planning.", accent: "#d4af37", emoji: "👑" },
];
