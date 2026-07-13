// Provider registry + adapter contract for the WealthOS market-data layer.
// Client-safe: types + metadata only (no secrets, no fetch). Screens read this
// to show which source powers a value; server adapters implement the contract.

import type {
  DataMeta,
  StockResearchData,
  StockFundamentals,
  NewsItem,
  MutualFundData,
  FundSearchItem,
  CachedPayload,
} from "@/lib/market-data";

export type ProviderId = "indianapi" | "mfapi";

export type Capability =
  | "equity"
  | "etf"
  | "fundamentals"
  | "news"
  | "trending"
  | "mutual_fund";

export interface ProviderMeta {
  id: ProviderId;
  /** Human label shown in the UI / reports. */
  label: string;
  /** The exact `source` string stamped on cached rows + DataMeta. */
  source: string;
  capabilities: Capability[];
  requiresKey: boolean;
  docs: string;
}

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderMeta> = {
  indianapi: {
    id: "indianapi",
    label: "Indian Stock Market Feed",
    source: "indianapi.in",
    capabilities: ["equity", "etf", "fundamentals", "news", "trending"],
    requiresKey: true,
    docs: "https://indianapi.in/indian-stock-market",
  },
  mfapi: {
    id: "mfapi",
    label: "Mutual Fund NAV Feed (AMFI)",
    source: "mfapi.in (AMFI)",
    capabilities: ["mutual_fund"],
    requiresKey: false,
    docs: "https://www.mfapi.in",
  },
};

export const EQUITY_SOURCE = PROVIDER_REGISTRY.indianapi.source;
export const MF_SOURCE = PROVIDER_REGISTRY.mfapi.source;

// ---- Adapter contracts (implemented server-side) ---------------------------
// Every adapter returns a CachedPayload so the cache status + source + freshness
// flow through unchanged to the transparency UI.

export interface EquityAdapter {
  id: ProviderId;
  source: string;
  /** Raw /stock bundle for one company (price + fundamentals + peers + news). */
  stock(name: string): Promise<CachedPayload<Record<string, unknown>>>;
  trending(): Promise<CachedPayload<Record<string, unknown>>>;
  news(): Promise<CachedPayload<unknown>>;
}

export interface FundAdapter {
  id: ProviderId;
  source: string;
  search(query: string): Promise<FundSearchItem[]>;
  scheme(schemeCode: number | string): Promise<CachedPayload<Record<string, unknown>>>;
}

// Normalized, app-facing shapes the whole app consumes (re-exported for callers).
export type {
  DataMeta,
  StockResearchData,
  StockFundamentals,
  NewsItem,
  MutualFundData,
  FundSearchItem,
};
