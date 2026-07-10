import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  RISK_COLOR,
  SEVERITY_COLOR,
  type RiskRating,
  type Severity,
} from "@/lib/market";

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-soft">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {actions}
    </div>
  );
}

export function RiskBadge({ risk }: { risk: RiskRating }) {
  const c = RISK_COLOR[risk];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: c + "22", color: c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {risk} risk
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const c = SEVERITY_COLOR[severity];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
      style={{ background: c + "22", color: c }}
    >
      {severity}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color = "var(--primary)",
  trend,
  delay = 0,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  trend?: number;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: color + "22", color }}>
              <Icon className="h-4 w-4" />
            </span>
            {typeof trend === "number" && (
              <span className={cn("text-xs font-semibold", trend >= 0 ? "text-emerald-500" : "text-destructive")}>
                {trend >= 0 ? "+" : ""}
                {trend.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-0.5 font-display text-xl font-bold tabular-nums">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export const chartTooltip = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    fontSize: 13,
  },
};

export function LiveDataNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </p>
  );
}
