// Live quote poller (LLD §1.1 / HLD §9) — runs on a ~60s Supabase Cron tick,
// market hours only, and only for symbols the users actually care about
// (portfolio holdings + watchlist), never the whole of NSE.

import { getLTP, hasAngelCredentials, persistQuote } from "./angel-one.adapter";
import { resolveSymbol } from "./angel-one.instruments";

/**
 * Minimal NSE regular-session check: Mon-Fri, 09:15-15:30 IST.
 * KNOWN SIMPLIFICATION: no holiday calendar and no special sessions yet —
 * the Market Calendar Service (Phase 4, LLD §13) replaces this.
 */
export function isMarketOpen(at: Date = new Date()): boolean {
  const ist = new Date(at.getTime() + (5 * 60 + 30) * 60 * 1000); // UTC -> IST
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

export interface PollResult {
  status: "skipped" | "ok";
  reason?: string;
  requested?: number;
  stored?: number;
  failed?: number;
}

async function trackedSymbols(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [holdings, watchlist] = await Promise.all([
    supabaseAdmin.from("holdings").select("symbol, asset_type"),
    supabaseAdmin.from("watchlist").select("symbol"),
  ]);
  const set = new Set<string>();
  for (const row of holdings.data ?? []) {
    if (row.symbol && (row.asset_type === "stock" || row.asset_type === "etf")) {
      set.add(row.symbol.trim().toUpperCase());
    }
  }
  for (const row of watchlist.data ?? []) {
    if (row.symbol) set.add(row.symbol.trim().toUpperCase());
  }
  return [...set];
}

export async function pollLiveQuotes(now: Date = new Date()): Promise<PollResult> {
  if (!hasAngelCredentials()) {
    console.log("Angel One credentials not configured — skipping live poll");
    return { status: "skipped", reason: "credentials_not_configured" };
  }
  if (!isMarketOpen(now)) {
    return { status: "skipped", reason: "market_closed" };
  }

  const symbols = await trackedSymbols();
  if (symbols.length === 0) return { status: "ok", requested: 0, stored: 0, failed: 0 };

  let stored = 0;
  let failed = 0;
  for (const symbol of symbols) {
    const resolved = await resolveSymbol(symbol);
    if (!resolved) {
      failed++;
      continue;
    }
    const quote = await getLTP({ ...resolved, exchange: "NSE" });
    if (!quote.ok) {
      failed++;
      continue;
    }
    // Store under the plain app symbol so downstream consumers stay provider-agnostic.
    await persistQuote({ ...quote.data, symbol });
    stored++;
  }
  return { status: "ok", requested: symbols.length, stored, failed };
}
