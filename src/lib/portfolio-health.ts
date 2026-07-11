// Live portfolio-health engine. All classification (sector, market-cap tier)
// comes from live provider fundamentals — never from a hardcoded universe.
// Holdings without a live match are counted as "Unclassified" and reduce the
// coverage score, so the UI can be honest about data completeness.

import type { HoldingComputed } from "@/lib/advisor";
import type { StockFundamentals } from "@/lib/market-data";

export type CapTier = "Large Cap" | "Mid Cap" | "Small Cap" | "Unclassified";

export const MARKET_CAP_TARGET: Record<Exclude<CapTier, "Unclassified">, number> = {
  "Large Cap": 60,
  "Mid Cap": 25,
  "Small Cap": 15,
};

export type Severity = "Critical" | "Warning" | "Info";

export interface LiveHealthReport {
  diversificationScore: number;
  riskScore: number;
  qualityScore: number;
  coveragePct: number; // % of value with live classification
  bySector: { name: string; value: number; pct: number }[];
  byCap: { name: CapTier; value: number; pct: number }[];
  concentration: { name: string; pct: number }[];
  warnings: { level: Severity; text: string }[];
  weaknesses: string[];
  improvements: string[];
}

// SEBI-style approximate thresholds in ₹ Cr.
function capTier(marketCapCr: number | null): CapTier {
  if (marketCapCr === null) return "Unclassified";
  if (marketCapCr >= 20000) return "Large Cap";
  if (marketCapCr >= 5000) return "Mid Cap";
  return "Small Cap";
}

const NON_EQUITY_SECTOR: Record<string, string> = {
  mutual_fund: "Mutual Funds",
  etf: "ETFs / Index",
  gold: "Gold / Commodity",
  bond: "Debt / Bonds",
  ppf: "Debt / PPF",
  nps: "Retirement / NPS",
};

const CAP_RISK: Record<CapTier, number> = {
  "Large Cap": 25,
  "Mid Cap": 55,
  "Small Cap": 85,
  Unclassified: 50,
};

export function analyzeHealthLive(
  holdings: HoldingComputed[],
  diversificationScore: number,
  quotes: Record<string, StockFundamentals | undefined>,
): LiveHealthReport {
  const total = holdings.reduce((s, h) => s + h.current, 0);
  const sectorMap = new Map<string, number>();
  const capMap = new Map<CapTier, number>();
  let riskAcc = 0;
  let classifiedValue = 0;

  holdings.forEach((h) => {
    const symKey = (h.symbol ?? h.name).trim();
    const f = quotes[symKey] ?? quotes[h.name];
    let sector: string;
    let cap: CapTier;

    if (h.asset_type === "stock") {
      if (f && f.found) {
        sector = f.sector ?? "Unclassified";
        cap = capTier(f.marketCap);
        if (cap !== "Unclassified") classifiedValue += h.current;
      } else {
        sector = "Unclassified";
        cap = "Unclassified";
      }
    } else {
      sector = NON_EQUITY_SECTOR[h.asset_type] ?? "Other";
      cap = h.asset_type === "mutual_fund" || h.asset_type === "etf" ? "Large Cap" : "Unclassified";
      classifiedValue += h.current;
    }

    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.current);
    capMap.set(cap, (capMap.get(cap) ?? 0) + h.current);
    riskAcc += CAP_RISK[cap] * (total > 0 ? h.current / total : 0);
  });

  const bySector = [...sectorMap.entries()]
    .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  const byCap = (["Large Cap", "Mid Cap", "Small Cap", "Unclassified"] as CapTier[])
    .map((name) => ({ name, value: capMap.get(name) ?? 0, pct: total > 0 ? Math.round(((capMap.get(name) ?? 0) / total) * 100) : 0 }))
    .filter((c) => c.value > 0);

  const concentration = [...holdings]
    .sort((a, b) => b.current - a.current)
    .slice(0, 5)
    .map((h) => ({ name: h.name, pct: total > 0 ? Math.round((h.current / total) * 100) : 0 }));

  const riskScore = Math.round(riskAcc);
  const coveragePct = total > 0 ? Math.round((classifiedValue / total) * 100) : 0;
  const qualityScore = Math.round(
    diversificationScore * 0.4 + (100 - riskScore) * 0.3 + Math.min(100, bySector.length * 14) * 0.2 + coveragePct * 0.1,
  );

  const warnings: { level: Severity; text: string }[] = [];
  const weaknesses: string[] = [];
  const improvements: string[] = [];

  bySector.forEach((s) => {
    if (s.name === "Unclassified") return;
    if (s.pct >= 40) {
      warnings.push({ level: "Critical", text: `${s.name} is ${s.pct}% of your portfolio — heavy sector concentration.` });
      weaknesses.push(`Over-concentrated in ${s.name} (${s.pct}%).`);
      improvements.push(`Trim ${s.name} exposure toward ≤30% and redeploy into under-represented sectors.`);
    } else if (s.pct >= 30) {
      warnings.push({ level: "Warning", text: `${s.name} allocation at ${s.pct}% — watch sector concentration.` });
    }
  });

  const top = concentration[0];
  if (top && top.pct >= 25) {
    warnings.push({ level: top.pct >= 40 ? "Critical" : "Warning", text: `${top.name} is ${top.pct}% of holdings — single-stock concentration risk.` });
    weaknesses.push(`${top.name} single-stock weight is ${top.pct}%.`);
    improvements.push(`Reduce ${top.name} to below 20% to cut idiosyncratic risk.`);
  }

  const small = byCap.find((c) => c.name === "Small Cap");
  if (small && small.pct >= 35) {
    warnings.push({ level: "Warning", text: `Small caps are ${small.pct}% — expect higher volatility.` });
    weaknesses.push(`Small-cap tilt (${small.pct}%) raises volatility.`);
  }

  const large = byCap.find((c) => c.name === "Large Cap");
  if ((large?.pct ?? 0) < 40 && holdings.length > 2) {
    improvements.push("Large-cap allocation is below 40% — add stability with large-cap or index exposure.");
  }

  if (diversificationScore < 60) {
    weaknesses.push(`Diversification score is low (${diversificationScore}/100).`);
    improvements.push("Spread capital across more holdings and asset classes to lift diversification.");
  }

  if (riskScore >= 70) {
    warnings.push({ level: "Critical", text: `Portfolio risk score is high (${riskScore}/100) — consider adding stable assets.` });
  }

  if (coveragePct < 100) {
    warnings.push({
      level: "Info",
      text: `${100 - coveragePct}% of value could not be classified from live data — those holdings are shown as "Unclassified".`,
    });
  }

  if (warnings.length === 0) warnings.push({ level: "Info", text: "No major concentration or risk warnings detected. Well balanced." });
  if (improvements.length === 0) improvements.push("Portfolio looks balanced — keep contributing via SIPs and review quarterly.");

  return {
    diversificationScore,
    riskScore,
    qualityScore: Math.max(0, Math.min(100, qualityScore)),
    coveragePct,
    bySector,
    byCap,
    concentration,
    warnings,
    weaknesses,
    improvements,
  };
}
