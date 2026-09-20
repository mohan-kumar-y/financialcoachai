/**
 * MIP provider adapter — Reddit (Phase 9, social sentiment source).
 *
 * Provider adapter ONLY: nothing outside src/server/mip/ or the signal layer
 * may import this. Built against placeholder credentials and NOT yet verified
 * against the live API — same honest posture as the Angel One adapter. With no
 * credentials it returns a typed CREDENTIALS_NOT_CONFIGURED result; it never
 * fabricates mentions.
 *
 * Required env (set later to activate):
 *   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT
 *
 * Auth: OAuth2 client_credentials (app-only, read-only) — no user account,
 * no password grant.
 */

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE = "https://oauth.reddit.com";
export const REDDIT_SOURCE = "REDDIT";

/** India-focused equity discussion subreddits. */
export const SUBREDDITS = ["IndianStreetBets", "IndiaInvestments"] as const;

export type RedditError =
  | "CREDENTIALS_NOT_CONFIGURED"
  | "AUTH_FAILED"
  | "PROVIDER_UNAVAILABLE";

export type RedditResult<T> =
  | { ok: true; data: T; source: string; fetchedAt: string }
  | { ok: false; error: RedditError; detail?: string };

export interface RedditMention {
  id: string;
  subreddit: string;
  title: string;
  text: string;
  score: number;
  createdAt: string;
  permalink: string;
}

interface Credentials {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

function readCredentials(): Credentials | null {
  const clientId = process.env["REDDIT_CLIENT_ID"];
  const clientSecret = process.env["REDDIT_CLIENT_SECRET"];
  const userAgent = process.env["REDDIT_USER_AGENT"];
  if (!clientId || !clientSecret || !userAgent) return null;
  return { clientId, clientSecret, userAgent };
}

export function hasRedditCredentials(): boolean {
  return readCredentials() !== null;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(creds: Credentials): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const basic = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": creds.userAgent,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

interface ListingChild {
  data?: {
    id?: string;
    subreddit?: string;
    title?: string;
    selftext?: string;
    score?: number;
    created_utc?: number;
    permalink?: string;
  };
}

/**
 * Search the India equity subreddits for recent posts mentioning a term.
 * `windowDays` maps onto Reddit's coarse `t` buckets (day/week/month).
 */
export async function searchMentions(
  term: string,
  windowDays = 7,
  limit = 50,
): Promise<RedditResult<RedditMention[]>> {
  const creds = readCredentials();
  if (!creds) {
    return { ok: false, error: "CREDENTIALS_NOT_CONFIGURED" };
  }

  try {
    const token = await getToken(creds);
    if (!token) return { ok: false, error: "AUTH_FAILED" };

    const t = windowDays <= 1 ? "day" : windowDays <= 7 ? "week" : "month";
    const url =
      `${API_BASE}/r/${SUBREDDITS.join("+")}/search` +
      `?q=${encodeURIComponent(term)}&restrict_sr=1&sort=new&t=${t}&limit=${limit}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": creds.userAgent },
    });
    if (!res.ok) {
      return { ok: false, error: "PROVIDER_UNAVAILABLE", detail: `HTTP ${res.status}` };
    }

    const json = (await res.json()) as { data?: { children?: ListingChild[] } };
    const cutoffSec = Date.now() / 1000 - windowDays * 86400;
    const mentions: RedditMention[] = [];
    for (const child of json.data?.children ?? []) {
      const d = child.data;
      if (!d?.id) continue;
      const createdUtc = d.created_utc ?? 0;
      if (createdUtc && createdUtc < cutoffSec) continue;
      mentions.push({
        id: d.id,
        subreddit: d.subreddit ?? "",
        title: d.title ?? "",
        text: d.selftext ?? "",
        score: Number(d.score ?? 0),
        createdAt: new Date((createdUtc || Date.now() / 1000) * 1000).toISOString(),
        permalink: d.permalink ? `https://reddit.com${d.permalink}` : "",
      });
    }

    return {
      ok: true,
      data: mentions,
      source: REDDIT_SOURCE,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      error: "PROVIDER_UNAVAILABLE",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export const redditAdapter = {
  id: "reddit" as const,
  source: REDDIT_SOURCE,
  hasCredentials: hasRedditCredentials,
  searchMentions,
};
