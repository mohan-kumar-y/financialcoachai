# Full Audit — Your Financial Compass (WealthOS)

Read-only audit of code, screens, engines, data sources, scheduled jobs, database and docs. Nothing was changed.

## Headline

The reasoning core (Brain → validator → audit trail) is genuinely built and honest about missing data. But the live-market foundation it was built on has never actually run: the live price, candle and fundamentals tables are all empty, and the broker credentials that fill them are not configured. Several screens that look live are static, two money-facing screens are fabricated outright, and the scheduled job endpoints are currently open to the public internet.

Verified table counts: holdings 31, market_cache 101, strategies 8, plans 1 — but live_quotes 0, candles 0, fundamentals_cache 0, market_events 0, anomaly_flags 0, brain_runs 0, decisions 0, explanations 0. The AI decision pipeline has produced zero records to date.

## Critical (fix before anyone else uses this)

1. **Scheduled-job endpoints are unauthenticated.** `CRON_SECRET` is not set in this environment, and all three routes treat it as optional (`src/routes/api/public/cron/daily-brief.ts:19`, `poll-quotes.ts:25`, `market-session.ts`). Anyone who guesses the URL can call `/api/public/cron/daily-brief`, which fires up to 200 full AI runs per call (`src/server/trigger/scheduled-runs.ts:26,49`), repeatedly, on your account's AI budget. Fix: require the secret (reject when unset), and set it.
2. **The chat endpoint serves anonymous callers.** `src/routes/api/chat.ts:171-197` — when the token is missing it skips the decision step but still streams an AI answer and calls the market provider. Unlimited spend from an unauthenticated URL. Fix: return 401 when there is no caller.
3. **The Red Alert Center invents corporate events.** `src/lib/market.ts:240-277` — earnings misses, rising debt, promoter pledge increases and governance concerns are generated from templates against whichever holdings you own, with fake timestamps ("2d ago"). These are false statements about named Indian companies displayed as alerts. Fix: show only the real, position-derived price-move alerts until a filings/news feed exists.
4. **BUY/SELL calls carry no enforced disclaimer and no compliance check.** The disclaimer is only a prompt instruction (`src/server/explanation/explanation-engine.ts:38`) — if the model omits it, nothing adds it. The COMPLIANCE rule category is an inert stub (`src/server/rules/categories/compliance.rules.ts:4-11`). Fix: append the disclaimer in code, and store it on the decision record.

## High

5. **Goals are entirely fake and unsaved.** `src/routes/_authenticated/goals.tsx:41-86` — a hardcoded array in memory; adding a goal does nothing, refresh wipes it. The dashboard shows a *different* hardcoded set (`dashboard.tsx:436-440`) plus a fixed "Goal Progress 62% (+3%)" and a fabricated "+4" savings-rate trend (`dashboard.tsx:150-151`).
6. **Mutual Fund Analyzer is five hardcoded funds.** `src/routes/_authenticated/funds.tsx:19,33` — overlap, AUM, manager tenure, returns all fixed, even though a real fund-data source (`src/lib/mf-data.server.ts`) already exists. The chart is labelled "CAGR %" but no CAGR is computed anywhere.
7. **The Daily Brief is sample copy.** `src/lib/market.ts:399-428` — headline, market summary, FII/DII commentary, opportunities and risks are fixed strings; per-holding "news" is picked by name length. Meanwhile the scheduled AI brief writes real decisions to the database that no screen ever reads.
8. **Adding a holding or watchlist symbol blocks on a full AI run.** `src/lib/holdings.functions.ts` and `watchlist.functions.ts` await `fire()` before returning, so a simple save waits on a multi-step model call. Should be fire-and-forget or queued.
9. **The scheduled brief runs with full database privileges per user.** `src/server/trigger/scheduled-runs.ts:51` passes the admin client into the per-user run, so row-level security is bypassed and correctness depends entirely on every downstream query filtering by user id.
10. **The action itself is unchecked.** The validator can downgrade confidence but never cross-checks the model's BUY against a bearish deterministic score (`src/server/brain/investment-brain.ts:141-159`).

## Medium

11. Six of twelve rule categories are stubs (risk, cash management, compliance, trading, IPO, tax) and stubs report `passed: true` (`src/server/rules/types.ts:44`), so gaps look like passes. SIP's headline rule is a fixed always-fail string.
12. Financial-model gaps: no inflation adjustment on 10-year projections or FIRE targets, no tax drag, static FX table (USD 84, EUR 90 — `src/lib/finance.ts:104`), and two conflicting "ideal SIP" definitions (30% flat in `advisor.ts:100` vs 10–28% by tier in `finance.ts`). `simulateSip` takes a fraction return while its neighbour takes a percent — an unused function today, a bug waiting for its first caller.
13. All money math (net worth, health score, projections, allocation) runs in the browser from server-supplied raw rows; nothing is recomputed server-side before a decision is stored.
14. News is cached 30 minutes on one path and 3 hours on another; the documented freshness table isn't what the cache calls actually use.
15. IPO and corporate-action fetchers are built but called from nowhere. Angel One credentials are absent so the whole live-quote pillar is a no-op.
16. Observability is console logging only — no metrics, no missed-poll detection, no correlation-ID tracing.
17. SEO metadata missing on every signed-in page; the site-wide tags duplicate and contradict each other (two different descriptions and a stale preview image in `src/routes/__root.tsx:88-106`).
18. Public sample screens show a fixed "35% funded" ring regardless of input (`src/routes/blueprints.tsx:317-321`).

## Docs vs reality

- The roadmap marks phases 1–8 shipped; structurally true, but phases 2, 5 and 6 have produced zero rows, so they are unexercised rather than working.
- The design docs assume a single private user; the app is published with public endpoints, which invalidates that security assumption.
- Docs correctly state that fund flows, options, block deals, sentiment and macro data are unavailable, and no code pretends otherwise — that principle is being honoured in the provider layer.

## Suggested order of work

**Round 1 — stop the bleeding:** items 1–4.
**Round 2 — remove fiction:** items 5–7, replacing fabricated alerts, goals, funds and brief with real data or honest empty states.
**Round 3 — make the foundation real:** add broker credentials so quotes and candles actually populate, then verify signals, probability and anomaly detection against real rows.
**Round 4 — correctness and polish:** items 8–18.

Tell me which round to start on and I'll implement it.
