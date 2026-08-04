# WealthOS Migration Roadmap
## Aligned to HLD v8.2 / LLD (source of truth)
### Status: Source of truth for=implementation order

Re-sequenced from the earlier draft because v8.2's Brain works through a Capability Gateway in a bounded reasoning loop, not a fixed rules->signals->decide pipeline — so the Gateway and Decision Validator have to exist from Phase 1, not later. Every phase ships working software.

---

## Phase 0 — Current State
Unchanged from before: market-data.server.ts, mf-data.server.ts, advisor.ts, finance.ts (FX/return-rate defects still open), watchlist.functions.ts, discovery.functions.ts, chat.ts (conflated Brain+Explanation).

---

## Phase 1 — Foundational Agent Loop (the priority build — start here)
- capability-gateway.ts with an initial allow-list of exactly two capabilities: RULES_EVALUATE (wrapping advisor.ts's existing rules) and PORTFOLIO_SNAPSHOT (wrapping advisor.ts's portfolio half).
- investment-brain.ts — implements the bounded loop (LLD §4), calling only those two capabilities to start.
- decision-validator.ts — minimal version: evidence-exists, duplicate-recommendation, and confidence-threshold checks only; the rest of its checklist fills in as later phases add the engines it references.
- explanation-engine.ts — full Explainability Contract from day one (HLD §26).
- Supabase: brain_runs, decisions, explanations tables only (LLD §2).
- chat.ts becomes a thin caller of investment-brain.ts -> decision-validator.ts -> explanation-engine.ts.

Ships: Atlas is now agentic (plans, calls capabilities, decides) instead of one LLM call, every decision is validated and audited, even though it only has two capabilities to call so far.

---

## Phase 2 — Market Intelligence: Live Path + Fundamentals
- angel-one.adapter.ts (LLD §1.1) — REST LTP/quote calls, auth/session handling.
- indianapi-fundamentals.adapter.ts (LLD §1.2) — fundamentals/financials/ratios/IPO/forecasts/news.
- Supabase: live_quotes, candles, fundamentals_cache, market_events tables.
- Supabase Cron: scheduled Edge Function polling Angel One every ~60s, gated by Market Calendar Service (Phase 4 dependency — build a minimal isMarketOpen() here if Phase 4 hasn't landed yet).

Ships: live quote data actually flowing into Supabase; nothing consumes it yet.

---

## Phase 3 — Freshness Gate + Rules Engine Formalization
- freshness-gate.ts with the concrete threshold table (LLD §6).
- Extract advisor.ts's rules into the 12-category structure (LLD §11) — RULES_EVALUATE capability now calls the real Rules Engine instead of the Phase 1 wrapper.
- Fix finance.ts's hardcoded FX/return-rate defects here.

---

## Phase 4 — Market Calendar Service + Portfolio Engine Formalization
- market-calendar.ts (LLD §13), static NSE holiday config.
- Extract advisor.ts's portfolio-scoring half into portfolio-engine.ts.
- Wire the Cron poller (Phase 2) to the real isMarketOpen().

---

## Phase 5 — Signal Layer: Technical + Fundamental
- technical.signal.ts (reads live_quotes/candles), fundamental.signal.ts (reads fundamentals_cache).
- New Capability Gateway entries: RESEARCH_TECHNICAL, RESEARCH_FUNDAMENTAL.
- Decision Validator gains evidence-freshness checks.

---

## Phase 6 — Signal Aggregation + Confidence Calibration + Probability + Regime + Anomaly Detection
- signal-aggregation.ts, confidence-calibration.ts (flat-prior cold start), market-probability.ts, market-regime.ts, anomaly-detection.ts.
- Anomaly Detection wired directly into the Cron poller's post-processing — reaches the dashboard without waiting for a Brain run.

---

## Phase 7 — Strategy Registry
- strategy-registry.ts, seed the 8 packs into the strategies table.
- Signal Aggregation and Confidence Calibration switch from placeholder weights to strategy-supplied weights.

---

## Phase 8 — Trigger Engine + Full Request/Trigger Layer
- trigger-engine.ts — formalizes Manual/Scheduled/Market Open-Close/Portfolio-Watchlist Change triggers.
- Pre-market Daily Brief trigger moves from an implicit cron call to a proper fire("SCHEDULED", ...) invocation.

---

## Phase 9 — Watchlist Alerts + Discovery Cross-Reference + Corporate Action/Sentiment Signals
- watchlist-engine.ts target-price alerts.
- discovery-engine.ts cross-reference against portfolio/watchlist, feeding the Daily Brief.
- corporate-action.signal.ts, sentiment.signal.ts (Reddit first) — confidence must reflect thin coverage honestly.

---

## Phase 10 — User Preferences + Notification Expansion
- user_preferences table + write path.
- Notification channels beyond Dashboard/Chat: Push, then Email.

---

## Phase 11 — Remaining Signal Engines (Derivatives, Institutional Flow, Liquidity, Sector, Macro)
- Gated on resolving their data sources: Angel One option-chain entitlement, FII/DII bulletins, RBI/MOSPI macro data.
- Each ships independently as its source is confirmed.

---

## Phase 12 — Evaluation & Learning
- evaluation-engine.ts, decision_outcomes table backfill job.
- Confidence Calibration switches from flat prior to real historical reliability once enough decisions have outcomes.

---

## Phase 13 — Production Readiness
- Observability: missed-poll detection, correlation-ID tracing through brain_runs.
- RLS review on all append-only tables.
- Revisit the COMPLIANCE rule category — low priority for personal single-user use, but re-check if outputs are ever shared beyond this account.

---

## Phase 14 — Trade Execution (future, out of current scope)
- broker-gateway.ts, execution-validator.ts, trade_proposals write path, Angel One order-placement adapter.
- Everything upstream already exists by this point — this phase is additive, not a redesign.

---

## Dependency Summary

0 (current) -> 1 (Agent Loop: Gateway+Brain+Validator+Explanation)
  -> 2 (Live data + Fundamentals) -> 3 (Freshness+Rules) -> 4 (Calendar+Portfolio)
  -> 5 (Signals: Technical+Fundamental) -> 6 (Aggregation+Calibration+Probability+Regime+Anomaly)
  -> 7 (Strategy Registry) -> 8 (Trigger Engine)
  -> 9 (Watchlist alerts+Discovery+CorpAction/Sentiment signals)
  -> 10 (Preferences+Notifications) -> 11 (Remaining signals, source-gated)
  -> 12 (Evaluation) -> 13 (Production readiness)
  -> 14 (Execution — future, deferred)

Phase 1 alone already fixes the architectural gap flagged at the very start (chat.ts conflating Brain+Explanation) and gives you an auditable, validated, agentic Atlas — everything after that adds evidence depth, not a new foundation.
