import { AlertTriangle, CheckCircle2, CircleSlash, RefreshCw } from "lucide-react";
import type { DataMeta } from "@/lib/market-data";
import { timeAgo } from "@/lib/market-data";
import { cn } from "@/lib/utils";

const CONFIDENCE: Record<DataMeta["status"], { label: string; conf: string }> = {
  ok: { label: "Live", conf: "High" },
  stale: { label: "Cached", conf: "Medium" },
  unavailable: { label: "Unavailable", conf: "—" },
};

/**
 * Data-quality badge — shows source, last-updated timestamp and confidence
 * for any market-data screen. Never implies data is fresh when it is not.
 */
export function DataStatus({ meta, className }: { meta: DataMeta; className?: string }) {
  const s = CONFIDENCE[meta.status];
  const color =
    meta.status === "ok" ? "#16a34a" : meta.status === "stale" ? "#d97706" : "#dc2626";
  const Icon =
    meta.status === "ok" ? CheckCircle2 : meta.status === "stale" ? RefreshCw : CircleSlash;
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[11px]",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 font-semibold" style={{ color }}>
        <Icon className="h-3 w-3" /> {s.label}
      </span>
      <span className="text-muted-foreground">
        Source: <span className="font-medium text-foreground">{meta.source}</span>
      </span>
      <span className="text-muted-foreground">
        Updated: <span className="font-medium text-foreground">{timeAgo(meta.fetchedAt)}</span>
      </span>
      {meta.status !== "unavailable" && (
        <span className="text-muted-foreground">
          Confidence: <span className="font-medium text-foreground">{s.conf}</span>
        </span>
      )}
    </div>
  );
}

/** Full-width panel for when live data cannot be shown. */
export function DataUnavailable({
  meta,
  title = "Live market data unavailable",
  hint,
}: {
  meta?: DataMeta;
  title?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 p-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-base font-bold text-foreground">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {hint ??
            "We could not reach the market-data provider, so no values are shown. We never display fabricated numbers."}
        </p>
      </div>
      {meta && (
        <p className="text-xs text-muted-foreground">
          Source: <span className="font-medium">{meta.source}</span> · Last successful update:{" "}
          <span className="font-medium">{timeAgo(meta.fetchedAt)}</span>
        </p>
      )}
    </div>
  );
}
