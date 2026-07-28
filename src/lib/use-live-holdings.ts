// Shared hook: takes stored holdings and returns them with `current_price`
// overridden by live market data where available. Only "stock" and "etf"
// holdings are looked up live (via getQuotes). Other asset types keep their
// stored price. Falls back to stored prices silently if the live fetch fails —
// never blocks rendering.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { HoldingRow } from "@/lib/holdings.functions";
import { getQuotes } from "@/lib/market-data.functions";
import type { DataMeta, StockFundamentals } from "@/lib/market-data";

export interface LiveHoldingsResult {
  liveHoldings: HoldingRow[];
  quoteMap: Record<string, StockFundamentals | undefined>;
  meta: DataMeta | null;
  eligibleCount: number;
  livePricedCount: number;
  hasEligible: boolean;
}

export function useLiveHoldings(holdings: HoldingRow[]): LiveHoldingsResult {
  const fetchQuotes = useServerFn(getQuotes);

  const symbols = useMemo(
    () =>
      Array.from(
        new Set(
          holdings
            .filter((h) => h.asset_type === "stock" || h.asset_type === "etf")
            .map((h) => (h.symbol ?? h.name).trim())
            .filter(Boolean),
        ),
      ),
    [holdings],
  );

  const { data: quotesData } = useQuery({
    queryKey: ["live-quotes", symbols],
    queryFn: () => fetchQuotes({ data: { symbols } }),
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const quoteMap: Record<string, StockFundamentals | undefined> = {};
    let meta: DataMeta | null = null;
    if (quotesData) {
      const metas = Object.values(quotesData).map((q) => q.meta);
      const anyOk = metas.find((m) => m.status === "ok");
      const anyStale = metas.find((m) => m.status === "stale");
      const latest = metas.map((m) => m.fetchedAt).filter(Boolean).sort().pop() ?? null;
      meta = {
        source: metas[0]?.source ?? "indianapi.in",
        fetchedAt: latest,
        status: anyOk ? "ok" : anyStale ? "stale" : "unavailable",
      };
      for (const [sym, res] of Object.entries(quotesData)) {
        quoteMap[sym] = res.fundamentals;
        quoteMap[sym.toUpperCase()] = res.fundamentals;
      }
    }

    let livePricedCount = 0;
    const liveHoldings = holdings.map((h) => {
      if (h.asset_type !== "stock" && h.asset_type !== "etf") return h;
      const key = (h.symbol ?? h.name).trim();
      const f = quoteMap[key];
      if (f && f.found && f.cmp !== null) {
        livePricedCount += 1;
        return { ...h, current_price: f.cmp };
      }
      return h;
    });

    return {
      liveHoldings,
      quoteMap,
      meta,
      eligibleCount: symbols.length,
      livePricedCount,
      hasEligible: symbols.length > 0,
    };
  }, [holdings, quotesData, symbols]);
}
