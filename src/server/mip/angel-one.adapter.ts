// MIP provider adapter — Angel One SmartAPI (LLD §1.1).
// Live LTP + historical candles. Provider adapter ONLY: nothing outside
// src/server/mip/ or the Capability Gateway may import this.
//
// Credentials are read per-request from env (Workers bind env at request
// time). None of these are configured yet — the adapter degrades to a typed
// PROVIDER_UNAVAILABLE result instead of throwing or fabricating a quote.
//
// Required env vars (set later to activate live data):
//   ANGEL_ONE_API_KEY, ANGEL_ONE_CLIENT_CODE, ANGEL_ONE_PIN, ANGEL_ONE_TOTP_SECRET

const BASE = "https://apiconnect.angelone.in";
export const ANGEL_SOURCE = "ANGEL_ONE";

export type AngelError =
  | "CREDENTIALS_NOT_CONFIGURED"
  | "AUTH_FAILED"
  | "PROVIDER_UNAVAILABLE";

export type AngelResult<T> =
  | { ok: true; data: T; source: string; fetchedAt: string }
  | { ok: false; error: AngelError; detail?: string };

export interface AngelCredentials {
  apiKey: string;
  clientCode: string;
  pin: string;
  totpSecret: string;
}

export interface LtpQuote {
  symbol: string;
  token: string;
  exchange: string;
  ltp: number;
  observedAt: string;
}

export interface Candle {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function readCredentials(): AngelCredentials | null {
  const apiKey = process.env["ANGEL_ONE_API_KEY"];
  const clientCode = process.env["ANGEL_ONE_CLIENT_CODE"];
  const pin = process.env["ANGEL_ONE_PIN"];
  const totpSecret = process.env["ANGEL_ONE_TOTP_SECRET"];
  if (!apiKey || !clientCode || !pin || !totpSecret) {
    console.warn(
      "[angel-one] credentials not configured — set ANGEL_ONE_API_KEY, ANGEL_ONE_CLIENT_CODE, ANGEL_ONE_PIN, ANGEL_ONE_TOTP_SECRET to activate live data",
    );
    return null;
  }
  return { apiKey, clientCode, pin, totpSecret };
}

export function hasAngelCredentials(): boolean {
  return readCredentials() !== null;
}

// ---- TOTP (RFC 6238, SHA-1, 6 digits, 30s step) ----------------------------

function base32Decode(input: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export async function generateTotp(secret: string, at: number = Date.now()): Promise<string> {
  const counter = Math.floor(at / 1000 / 30);
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg as unknown as ArrayBuffer));
  const offset = sig[sig.length - 1]! & 0x0f;
  const bin =
    ((sig[offset]! & 0x7f) << 24) |
    ((sig[offset + 1]! & 0xff) << 16) |
    ((sig[offset + 2]! & 0xff) << 8) |
    (sig[offset + 3]! & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

// ---- Session management (token cached ~24h, refreshed on expiry) -----------

interface Session {
  jwtToken: string;
  refreshToken: string;
  feedToken?: string;
  expiresAt: number;
}

let cachedSession: Session | null = null;
const SESSION_TTL_MS = 23 * 60 * 60 * 1000; // login tokens are ~24h valid

function angelHeaders(apiKey: string, jwt?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": apiKey,
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
}

async function login(creds: AngelCredentials): Promise<Session> {
  const totp = await generateTotp(creds.totpSecret);
  const res = await fetch(`${BASE}/rest/auth/angelbroking/user/v1/loginByPassword`, {
    method: "POST",
    headers: angelHeaders(creds.apiKey),
    body: JSON.stringify({
      clientcode: creds.clientCode,
      password: creds.pin,
      totp,
    }),
  });
  if (!res.ok) throw new Error(`login HTTP ${res.status}`);
  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: { jwtToken?: string; refreshToken?: string; feedToken?: string };
  };
  const jwtToken = json.data?.jwtToken;
  if (!json.status || !jwtToken) throw new Error(json.message ?? "login rejected");
  return {
    jwtToken,
    refreshToken: json.data?.refreshToken ?? "",
    ...(json.data?.feedToken ? { feedToken: json.data.feedToken } : {}),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

/** Returns a valid session, reusing the cached one until it nears expiry. */
async function getSession(creds: AngelCredentials, force = false): Promise<Session> {
  if (!force && cachedSession && cachedSession.expiresAt > Date.now()) return cachedSession;
  cachedSession = await login(creds);
  return cachedSession;
}

async function authedCall<T>(
  creds: AngelCredentials,
  path: string,
  body: unknown,
): Promise<T> {
  const run = async (session: Session) => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: angelHeaders(creds.apiKey, session.jwtToken),
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) throw new Error("UNAUTHORIZED");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { status?: boolean; message?: string; data?: T };
    if (!json.status || json.data == null) throw new Error(json.message ?? "empty response");
    return json.data;
  };

  try {
    return await run(await getSession(creds));
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      // Token expired early — force one re-login, then give up.
      return run(await getSession(creds, true));
    }
    throw err;
  }
}

function unavailable(err: unknown): { ok: false; error: AngelError; detail: string } {
  const detail = err instanceof Error ? err.message : String(err);
  console.warn("[angel-one] provider unavailable:", detail);
  return { ok: false, error: "PROVIDER_UNAVAILABLE", detail };
}

// ---- Public adapter surface ------------------------------------------------

export interface LtpRequest {
  /** Trading symbol as registered with Angel One, e.g. "SBIN-EQ". */
  tradingSymbol: string;
  /** Angel One instrument token. */
  symbolToken: string;
  exchange?: "NSE" | "BSE" | "NFO";
}

/** LLD §1.1 — POST /rest/secure/angelbroking/order/v1/getLTP */
export async function getLTP(req: LtpRequest): Promise<AngelResult<LtpQuote>> {
  const creds = readCredentials();
  if (!creds) return { ok: false, error: "CREDENTIALS_NOT_CONFIGURED" };
  const exchange = req.exchange ?? "NSE";
  try {
    const data = await authedCall<{ ltp?: number | string }>(
      creds,
      "/rest/secure/angelbroking/order/v1/getLTP",
      { exchange, tradingsymbol: req.tradingSymbol, symboltoken: req.symbolToken },
    );
    const ltp = Number(data.ltp);
    if (!Number.isFinite(ltp)) {
      // Never fabricate: no usable price means unavailable.
      return { ok: false, error: "PROVIDER_UNAVAILABLE", detail: "no ltp in response" };
    }
    return {
      ok: true,
      source: ANGEL_SOURCE,
      fetchedAt: new Date().toISOString(),
      data: {
        symbol: req.tradingSymbol,
        token: req.symbolToken,
        exchange,
        ltp,
        observedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return unavailable(err);
  }
}

/** Batch helper — sequential to respect SmartAPI rate limits. */
export async function getLTPBatch(reqs: LtpRequest[]): Promise<AngelResult<LtpQuote>[]> {
  const out: AngelResult<LtpQuote>[] = [];
  for (const r of reqs) out.push(await getLTP(r));
  return out;
}

export interface CandleRequest {
  symbolToken: string;
  exchange?: "NSE" | "BSE" | "NFO";
  /** SmartAPI interval, e.g. ONE_DAY, ONE_HOUR, FIFTEEN_MINUTE. */
  interval: string;
  /** "yyyy-MM-dd HH:mm" in IST, per SmartAPI. */
  fromDate: string;
  toDate: string;
}

/** LLD §1.1 — POST /rest/secure/angelbroking/historical/v1/getCandleData */
export async function getCandleData(req: CandleRequest): Promise<AngelResult<Candle[]>> {
  const creds = readCredentials();
  if (!creds) return { ok: false, error: "CREDENTIALS_NOT_CONFIGURED" };
  try {
    const rows = await authedCall<unknown[]>(
      creds,
      "/rest/secure/angelbroking/historical/v1/getCandleData",
      {
        exchange: req.exchange ?? "NSE",
        symboltoken: req.symbolToken,
        interval: req.interval,
        fromdate: req.fromDate,
        todate: req.toDate,
      },
    );
    const candles: Candle[] = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 6) continue;
      const [ts, open, high, low, close, volume] = row as [
        string,
        number,
        number,
        number,
        number,
        number,
      ];
      candles.push({
        ts: new Date(ts).toISOString(),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
      });
    }
    return { ok: true, data: candles, source: ANGEL_SOURCE, fetchedAt: new Date().toISOString() };
  } catch (err) {
    return unavailable(err);
  }
}

/** Persist an LTP into public.live_quotes (service-role only). */
export async function persistQuote(quote: LtpQuote): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("live_quotes").upsert(
    {
      symbol: quote.symbol,
      ltp: quote.ltp,
      observed_at: quote.observedAt,
      fetched_at: new Date().toISOString(),
      source: ANGEL_SOURCE,
      quality: "ok",
    },
    { onConflict: "symbol" },
  );
}

/** Persist candles into public.candles (service-role only). */
export async function persistCandles(
  symbol: string,
  interval: string,
  candles: Candle[],
): Promise<void> {
  if (candles.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("candles").upsert(
    candles.map((c) => ({
      symbol,
      interval,
      ts: c.ts,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    })),
    { onConflict: "symbol,interval,ts" },
  );
}
