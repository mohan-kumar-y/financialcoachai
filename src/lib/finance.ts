// Pure, framework-free financial modelling for the "Financial Operating System".
// No DB / network here — safe to import anywhere.

export type Currency = "INR" | "USD" | "EUR";

export interface PlanInputs {
  currency: Currency;
  annualSalary: number; // in-hand annual income
  monthlyExpenses: number; // 0 = derive from Needs bucket
  currentSip: number; // current monthly SIP
  emergencyMonths: number;
  annualIncrementPct: number;
  sipStepUpPct: number;
  /** Expected annual return %, default 12. */
  returnRatePct?: number;
}

export const DEFAULT_INPUTS: PlanInputs = {
  currency: "INR",
  annualSalary: 1200000,
  monthlyExpenses: 0,
  currentSip: 0,
  emergencyMonths: 6,
  annualIncrementPct: 10,
  sipStepUpPct: 10,
  returnRatePct: 12,
};

export type BucketKey =
  | "needs"
  | "wants"
  | "emergency"
  | "insurance"
  | "investments"
  | "wealth";

export const BUCKET_META: Record<
  BucketKey,
  { label: string; color: string; blurb: string }
> = {
  needs: { label: "Needs", color: "var(--needs)", blurb: "Rent, food, EMIs, bills, transport." },
  wants: { label: "Wants", color: "var(--wants)", blurb: "Dining, travel, shopping, lifestyle." },
  emergency: { label: "Emergency Fund", color: "var(--emergency)", blurb: "Liquid buffer until fully funded." },
  insurance: { label: "Insurance", color: "var(--insurance)", blurb: "Term life + health premiums." },
  investments: { label: "Investments (SIP)", color: "var(--investments)", blurb: "Core goals via index & mutual funds." },
  wealth: { label: "Wealth Creation", color: "var(--wealth)", blurb: "Equity, lump-sum surplus, alternatives." },
};

export interface Tier {
  id: string;
  name: string;
  min: number; // annual salary lower bound (INR-normalised)
  max: number | null;
  tagline: string;
  alloc: Record<BucketKey, number>; // percentages, sum 100
}

// Tiers are defined in INR. For other currencies the same band structure is
// applied after converting to an INR-equivalent using a rough factor so the
// guidance scales sensibly.
export const TIERS: Tier[] = [
  {
    id: "foundation",
    name: "Foundation",
    min: 0,
    max: 600000,
    tagline: "Stabilise, insure, and build your first safety net.",
    alloc: { needs: 55, wants: 15, emergency: 12, insurance: 5, investments: 10, wealth: 3 },
  },
  {
    id: "builder",
    name: "Builder",
    min: 600000,
    max: 1200000,
    tagline: "Lock essentials, ramp up disciplined SIPs.",
    alloc: { needs: 50, wants: 15, emergency: 8, insurance: 5, investments: 16, wealth: 6 },
  },
  {
    id: "accelerator",
    name: "Accelerator",
    min: 1200000,
    max: 2500000,
    tagline: "Lifestyle stays flat, investing accelerates.",
    alloc: { needs: 45, wants: 15, emergency: 5, insurance: 5, investments: 22, wealth: 8 },
  },
  {
    id: "optimizer",
    name: "Optimizer",
    min: 2500000,
    max: 5000000,
    tagline: "Optimise tax, diversify, grow wealth deliberately.",
    alloc: { needs: 40, wants: 15, emergency: 3, insurance: 4, investments: 25, wealth: 13 },
  },
  {
    id: "wealth-builder",
    name: "Wealth Builder",
    min: 5000000,
    max: null,
    tagline: "Compound aggressively toward financial independence.",
    alloc: { needs: 33, wants: 13, emergency: 2, insurance: 4, investments: 28, wealth: 20 },
  },
];

export const CURRENCY_TO_INR: Record<Currency, number> = { INR: 1, USD: 84, EUR: 90 };

/**
 * `fxRate` = INR per one unit of `currency`. Supplied by callers that have a
 * live rate (see src/lib/fx-rates.server.ts); defaults to the static constant
 * so this module stays pure and backward compatible.
 */
export function getTier(annualSalary: number, currency: Currency, fxRate?: number): Tier {
  const inr = annualSalary * (fxRate ?? CURRENCY_TO_INR[currency]);
  return (
    TIERS.find((t) => inr >= t.min && (t.max === null || inr < t.max)) ?? TIERS[0]
  );
}

export function formatCurrency(value: number, currency: Currency, compact = false): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (currency === "INR") {
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
  const code = currency === "USD" ? "USD" : "EUR";
  const locale = currency === "USD" ? "en-US" : "de-DE";
  if (compact) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(safe);
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(safe);
}

export interface BucketResult {
  key: BucketKey;
  label: string;
  color: string;
  blurb: string;
  pct: number;
  monthly: number;
  annual: number;
}

export interface ComputedPlan {
  tier: Tier;
  monthlyIncome: number;
  monthlyExpenses: number;
  buckets: BucketResult[];
  emergencyTarget: number;
  emergencyMonthlyContribution: number;
  recommendedSip: number;
  sipGap: number; // recommended - current
  investRate: number; // investments + wealth %, of income
}

export function computePlan(inputs: PlanInputs): ComputedPlan {
  const tier = getTier(inputs.annualSalary, inputs.currency);
  const monthlyIncome = inputs.annualSalary / 12;
  const derivedExpenses =
    inputs.monthlyExpenses > 0
      ? inputs.monthlyExpenses
      : (tier.alloc.needs / 100) * monthlyIncome;

  const buckets: BucketResult[] = (Object.keys(tier.alloc) as BucketKey[]).map((key) => {
    const pct = tier.alloc[key];
    const monthly = (pct / 100) * monthlyIncome;
    return {
      key,
      label: BUCKET_META[key].label,
      color: BUCKET_META[key].color,
      blurb: BUCKET_META[key].blurb,
      pct,
      monthly,
      annual: monthly * 12,
    };
  });

  const recommendedSip =
    ((tier.alloc.investments + tier.alloc.wealth) / 100) * monthlyIncome;
  const emergencyTarget = derivedExpenses * inputs.emergencyMonths;
  const emergencyMonthlyContribution = (tier.alloc.emergency / 100) * monthlyIncome;

  return {
    tier,
    monthlyIncome,
    monthlyExpenses: derivedExpenses,
    buckets,
    emergencyTarget,
    emergencyMonthlyContribution,
    recommendedSip,
    sipGap: recommendedSip - inputs.currentSip,
    investRate: tier.alloc.investments + tier.alloc.wealth,
  };
}

export interface ProjectionRow {
  year: number;
  annualSalary: number;
  tierName: string;
  monthlySip: number;
  annualInvested: number;
  cumulativeInvested: number;
  projectedCorpus: number; // at 12% p.a. annual compounding on yearly contributions
}

export function projectGrowth(inputs: PlanInputs, years = 10, returnRate = 0.12): ProjectionRow[] {
  const rows: ProjectionRow[] = [];
  let salary = inputs.annualSalary;
  const first = computePlan(inputs);
  let sip = Math.max(inputs.currentSip, first.recommendedSip);
  let cumulative = 0;
  let corpus = 0;

  for (let y = 1; y <= years; y++) {
    const annualInvested = sip * 12;
    // grow existing corpus a year, then add this year's contributions
    corpus = corpus * (1 + returnRate) + annualInvested * (1 + returnRate / 2);
    cumulative += annualInvested;
    const tier = getTier(salary, inputs.currency);
    rows.push({
      year: y,
      annualSalary: salary,
      tierName: tier.name,
      monthlySip: sip,
      annualInvested,
      cumulativeInvested: cumulative,
      projectedCorpus: corpus,
    });
    // next year
    salary = salary * (1 + inputs.annualIncrementPct / 100);
    sip = sip * (1 + inputs.sipStepUpPct / 100);
  }
  return rows;
}

export interface Milestone {
  id: string;
  title: string;
  detail: string;
  target: number;
  multiple: string;
}

export function buildMilestones(inputs: PlanInputs): Milestone[] {
  const plan = computePlan(inputs);
  const salary = inputs.annualSalary;
  return [
    {
      id: "emergency",
      title: "Emergency fund funded",
      detail: `${inputs.emergencyMonths} months of expenses parked in liquid funds / sweep FD.`,
      target: plan.emergencyTarget,
      multiple: "Safety net",
    },
    {
      id: "1x",
      title: "1× annual income invested",
      detail: "First real compounding base. Keep step-up SIPs flowing.",
      target: salary * 1,
      multiple: "1×",
    },
    {
      id: "3x",
      title: "3× annual income",
      detail: "Portfolio income becomes meaningful — diversify across asset classes.",
      target: salary * 3,
      multiple: "3×",
    },
    {
      id: "5x",
      title: "5× annual income",
      detail: "Halfway to coast-FI. Rebalance yearly, avoid lifestyle creep.",
      target: salary * 5,
      multiple: "5×",
    },
    {
      id: "10x",
      title: "10× annual income",
      detail: "Coast financial independence within reach.",
      target: salary * 10,
      multiple: "10×",
    },
    {
      id: "25x",
      title: "25× annual expenses (FIRE)",
      detail: "Work becomes optional at a 4% safe withdrawal rate.",
      target: plan.monthlyExpenses * 12 * 25,
      multiple: "FIRE",
    },
  ];
}

export interface Checkpoint {
  cadence: "Monthly" | "Quarterly" | "Yearly";
  items: string[];
}

export const CHECKPOINTS: Checkpoint[] = [
  {
    cadence: "Monthly",
    items: [
      "Auto-debit SIPs executed on salary day",
      "Track actual spends vs Needs/Wants budget",
      "Sweep any surplus into the emergency fund until fully funded",
      "Log net worth in one place",
    ],
  },
  {
    cadence: "Quarterly",
    items: [
      "Review fund performance vs benchmark (exit chronic laggards)",
      "Check asset allocation drift — act if any class is off by >5%",
      "Deploy idle cash / bonuses as lump-sum via 3–6 month STP",
      "Confirm insurance cover still matches liabilities",
    ],
  },
  {
    cadence: "Yearly",
    items: [
      "Step up SIPs by your increment % after every appraisal",
      "Full portfolio rebalance back to target allocation",
      "Tax-loss harvesting & 80C / ELSS optimisation",
      "Re-evaluate goals, increase term/health cover for inflation",
    ],
  },
];
