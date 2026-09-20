/**
 * Sentiment signal (Phase 9) — [ENGINE], deterministic keyword scoring only.
 *
 * Per the project's core architecture rule, sentiment is NOT an LLM call. It
 * counts positive/negative keyword hits across Reddit mentions and reports a
 * lean. No model is asked "how does this feel".
 *
 * THIN-SAMPLE HONESTY IS THE POINT: three enthusiastic posts are not a signal.
 * Confidence is capped hard at low mention counts, and the summary always
 * states the mention count out loud so no downstream consumer can mistake a
 * sliver of chatter for a market view.
 *
 * Capability id: EVENTS_NEWS is reused rather than minting a new one —
 * sentiment here is social/news-derived commentary, the same evidence class as
 * a news headline. A dedicated id would be warranted once there are several
 * independent sentiment sources with different reliabilities.
 */
import { searchMentions, hasRedditCredentials, REDDIT_SOURCE } from "@/server/mip/reddit.adapter";
import { clamp01, type Signal } from "@/server/signals/signal-types";
import type { Evidence } from "@/server/contracts";

const LOOKBACK_DAYS = 7;

/** Confidence ceilings by sample size — documented judgment calls. */
const THIN_SAMPLE_MIN = 5; // fewer than this = cannot be more than 0.25 confident
const THIN_SAMPLE_CEILING = 0.25;
const MODERATE_SAMPLE_MIN = 20; // below this, cap at 0.5
const MODERATE_SAMPLE_CEILING = 0.5;
const MAX_CONFIDENCE = 0.7; // social chatter never gets full confidence

const POSITIVE = [
  "buy", "bullish", "long", "undervalued", "breakout", "multibagger", "accumulate",
  "strong", "beat", "upgrade", "growth", "rally", "outperform", "moat", "profit",
];
const NEGATIVE = [
  "sell", "bearish", "short", "overvalued", "crash", "dump", "avoid", "fraud",
  "scam", "downgrade", "loss", "debt", "weak", "miss", "exit", "bagholder",
];

export interface SentimentResult {
  available: boolean;
  symbol: string;
  mentionCount: number;
  positiveHits: number;
  negativeHits: number;
  lean: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number; // 0-1
  summary: string;
  observedAt: string | null;
  source: string;
  reason?: string;
}

function countHits(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const w of words) {
    // Word-boundary match so "profitable" doesn't count twice and "loss" doesn't match "glossy".
    const re = new RegExp(`\\b${w}\\b`, "g");
    hits += (lower.match(re) ?? []).length;
  }
  return hits;
}

export async function computeSentiment(
  symbol: string,
  companyName?: string,
): Promise<SentimentResult> {
  const upper = symbol.trim().toUpperCase();
  const base: Omit<SentimentResult, "available" | "summary"> = {
    symbol: upper,
    mentionCount: 0,
    positiveHits: 0,
    negativeHits: 0,
    lean: "NEUTRAL",
    confidence: 0,
    observedAt: null,
    source: REDDIT_SOURCE,
  };

  if (!hasRedditCredentials()) {
    return {
      ...base,
      available: false,
      reason: "credentials_not_configured",
      summary: `Social sentiment for ${upper} is unavailable — Reddit access is not configured.`,
    };
  }

  const term = companyName?.trim() ? `${upper} OR "${companyName.trim()}"` : upper;
  const res = await searchMentions(term, LOOKBACK_DAYS);
  if (!res.ok) {
    return {
      ...base,
      available: false,
      reason: res.error,
      summary: `Social sentiment for ${upper} is unavailable (${res.error}).`,
    };
  }

  const mentions = res.data;
  let positiveHits = 0;
  let negativeHits = 0;
  for (const m of mentions) {
    const text = `${m.title} ${m.text}`;
    positiveHits += countHits(text, POSITIVE);
    negativeHits += countHits(text, NEGATIVE);
  }

  const total = positiveHits + negativeHits;
  const skew = total === 0 ? 0 : (positiveHits - negativeHits) / total; // -1..1
  const lean: SentimentResult["lean"] =
    skew >= 0.2 ? "BULLISH" : skew <= -0.2 ? "BEARISH" : "NEUTRAL";

  // Raw confidence from how lopsided the keyword balance is, then capped by
  // sample size. Sample size dominates — this is the honesty guard.
  let confidence = clamp01(Math.abs(skew));
  if (mentions.length < THIN_SAMPLE_MIN) confidence = Math.min(confidence, THIN_SAMPLE_CEILING);
  else if (mentions.length < MODERATE_SAMPLE_MIN) confidence = Math.min(confidence, MODERATE_SAMPLE_CEILING);
  confidence = Math.min(confidence, MAX_CONFIDENCE);
  if (mentions.length === 0) confidence = 0;

  const leanWord = lean === "BULLISH" ? "bullish" : lean === "BEARISH" ? "bearish" : "neutral";
  const summary =
    mentions.length === 0
      ? `No Reddit mentions of ${upper} found in the last ${LOOKBACK_DAYS} days — no sentiment reading.`
      : mentions.length < THIN_SAMPLE_MIN
        ? `Sentiment leans ${leanWord} but based on only ${mentions.length} Reddit mention${mentions.length === 1 ? "" : "s"} in ${LOOKBACK_DAYS} days — low-confidence signal, not a market view.`
        : `Sentiment leans ${leanWord} across ${mentions.length} Reddit mentions in ${LOOKBACK_DAYS} days (${positiveHits} positive vs ${negativeHits} negative keyword hits).`;

  return {
    ...base,
    available: true,
    mentionCount: mentions.length,
    positiveHits,
    negativeHits,
    lean,
    confidence,
    observedAt: res.fetchedAt,
    summary,
  };
}

export function toSignal(result: SentimentResult): Signal | undefined {
  if (!result.available || result.mentionCount === 0) return undefined;
  return {
    engine: "SENTIMENT",
    symbol: result.symbol,
    direction: result.lean,
    strength: clamp01(
      result.positiveHits + result.negativeHits === 0
        ? 0
        : Math.abs(result.positiveHits - result.negativeHits) /
            (result.positiveHits + result.negativeHits),
    ),
    confidence: result.confidence,
    evidence: [result.summary],
    observedAt: result.observedAt ?? new Date().toISOString(),
    source: result.source,
  };
}

export async function getSentimentSignal(
  symbol: string,
  companyName: string | undefined,
  correlationId: string,
): Promise<{ evidence: Evidence[] }> {
  const result = await computeSentiment(symbol, companyName);
  const signal = toSignal(result);
  return {
    evidence: [
      {
        id: crypto.randomUUID(),
        correlationId,
        capability: "EVENTS_NEWS",
        summary: result.summary,
        payload: result,
        // Social chatter is never treated as LIVE evidence: at best it is a
        // week-wide sample, so FRESH is the ceiling and unavailable is EXPIRED.
        freshness: result.available && result.mentionCount > 0 ? "FRESH" : "EXPIRED",
        observedAt: result.observedAt ?? new Date().toISOString(),
        source: result.source,
        ...(signal ? { signal } : {}),
      },
    ],
  };
}
