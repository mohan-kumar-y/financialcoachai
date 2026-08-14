// Angel One instrument-master lookup: trading symbol -> instrument token.
// The master file is public (no credentials needed) and refreshed daily.
// MIP-internal only.

const MASTER_URL =
  "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

interface Instrument {
  token: string;
  symbol: string;
  name: string;
  exch_seg: string;
  instrumenttype: string;
}

let cache: { map: Map<string, string>; loadedAt: number } | null = null;
const TTL_MS = 12 * 60 * 60 * 1000;

async function loadMaster(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.map;
  const res = await fetch(MASTER_URL);
  if (!res.ok) throw new Error(`instrument master HTTP ${res.status}`);
  const rows = (await res.json()) as Instrument[];
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.exch_seg !== "NSE") continue;
    if (row.instrumenttype && row.instrumenttype !== "") continue; // cash equity/ETF only
    map.set(row.symbol.toUpperCase(), row.token);
  }
  cache = { map, loadedAt: Date.now() };
  return map;
}

/**
 * Resolve a plain NSE symbol (e.g. "SBIN") to Angel One's trading symbol
 * ("SBIN-EQ") and instrument token. Returns null when unknown — callers skip
 * rather than guess.
 */
export async function resolveSymbol(
  symbol: string,
): Promise<{ tradingSymbol: string; symbolToken: string } | null> {
  try {
    const map = await loadMaster();
    const base = symbol.trim().toUpperCase();
    const candidates = base.endsWith("-EQ") ? [base] : [`${base}-EQ`, base];
    for (const candidate of candidates) {
      const token = map.get(candidate);
      if (token) return { tradingSymbol: candidate, symbolToken: token };
    }
    return null;
  } catch (err) {
    console.warn("[angel-one] instrument master unavailable:", err);
    return null;
  }
}
