# WealthOS — Final High-Level Design
## v8.2 — Production Architecture Baseline
### Status: FROZEN FOR LLD & IMPLEMENTATION
Platform: **Lovable + TypeScript + Supabase/PostgreSQL** (no additional deployment targets)
Architecture: Single Agentic Investment Brain + Deterministic Investment Intelligence Platform
Scope: Personal Investment Operating System (single user)
Market: India-first
Trading: **Recommendations only in v1 — no broker execution.** Execution is a defined but deferred later phase.

---

## 0. Provenance Note

This document merges the uploaded **v8.1 baseline** (which introduced the Capability Gateway, Decision Validator, bounded reasoning loop, Confidence Calibration, Market Calendar Service, and formal Freshness states — all adopted as-is, they're stronger than the prior draft) with three corrections made after review:

1. **Live Market Runtime is now Supabase-native (Cron polling), not an external always-on Node.js WebSocket worker.** The v8.1 doc's §7/§34 and its own diagram disagreed with each other about where that worker lives, and either way it requires a deployment target outside Lovable/Supabase — which conflicts with the "no changes in tech stack" decision. See §7.
2. **Trade execution (§29–30 of v8.1) is deferred.** v1 ships recommendations, alerts, and the full evidence/decision pipeline; it does not place real orders. The execution design is kept in this document because it's good design, but marked **NOT BUILT IN V1**.
3. **Fundamental data now has a named source: indianapi.in**, the same provider already integrated for live quotes — it also exposes company fundamentals, historical financials, ratios, IPO data, analyst forecasts, and news through the same API key. No new vendor relationship required.

Everything else below is the v8.1 architecture, carried forward.

---

## 1. Purpose

WealthOS is a production-grade personal Investment Operating System covering:

- Long-term investing
- Swing trading
- Intraday trading
- Stocks, ETFs, Mutual Funds, SIPs, Lump-sum, IPOs
- Portfolio management, Watchlists, Investment discovery
- Daily investment briefs
- Live market monitoring and anomaly detection
- Investment recommendations
- User-approved broker execution *(deferred — see §0.2, §29)*

WealthOS combines AI reasoning + deterministic financial intelligence + live market data + portfolio context + (later) controlled execution.

**The system does not claim guaranteed market prediction.** All recommendations must be evidence-driven, freshness-aware, explainable, auditable, and validated before presentation.

---

## 2. Core Architecture Decision

WealthOS has exactly **ONE AI AGENT — INVESTMENT BRAIN**. No separate Stock/Mutual Fund/IPO/Trading/Portfolio/News/Research Agents. These exist as deterministic engines/capabilities available to the Brain.

```text
AI decides WHAT needs investigation
             ↓
Deterministic engines calculate WHAT IS TRUE
             ↓
AI reasons about WHAT IT MEANS
             ↓
Deterministic controls verify WHAT IS ALLOWED
             ↓
User approves WHAT GETS EXECUTED (future phase)
```

---

## 3. AI Role

The Investment Brain owns investment reasoning, not just explanation:

```text
UNDERSTAND → PLAN → SELECT CAPABILITIES → INVESTIGATE → OBSERVE EVIDENCE
→ ADAPT ANALYSIS → BUILD THESIS → BUILD COUNTER-THESIS → DECIDE → EXPLAIN → MONITOR
```

The Brain dynamically decides which approved capabilities are needed and in what order — e.g. for "Should I buy HDFC Bank?" it may pull fundamentals, valuation, technical setup, and portfolio exposure, notice abnormal volume, and *then* pull news/corporate announcements/block-deal data to explain it, before synthesizing a decision. This adaptive investigation is the core AI capability — unchanged from v8.1, and a genuine improvement over a fixed rules-then-brain pipeline.

---

## 4. AI Boundaries

**CAN:** understand intent, plan analysis, choose approved engines, sequence analysis, request more evidence, compare conflicting evidence, build thesis/counter-thesis, identify risks, make recommendations, explain decisions, propose trades (surfaced to the user, not executed), define monitoring requirements.

**CANNOT:** fetch arbitrary external APIs directly, query production databases arbitrarily, fabricate data, calculate authoritative financial metrics itself, modify production rules/thresholds, bypass freshness requirements, bypass risk rules, bypass the Decision Validator, execute broker orders directly, bypass user approval.

---

## 5. Component Model — Twelve Logical Stages

1. Data Sources
2. Market Intelligence Platform
3. Live Market Monitoring (Supabase-native, not a WebSocket worker — §7)
4. WealthOS Data Platform (Supabase/PostgreSQL)
5. Request & Trigger Layer
6. Market Calendar Service
7. Capability Gateway
8. Intelligence Capabilities
9. Signal Intelligence + Aggregation
10. Investment Brain (reasoning loop)
11. Decision Validator
12. User Experience (Dashboard/Atlas) + Explanation

---

## 6. Data Sources — Named Providers

| Source | Provides | Status |
|---|---|---|
| **Angel One SmartAPI** | Live equity quotes, market depth, derivatives/OI (subject to API entitlement), broker execution *(deferred)* | Live for quotes; polled, not streamed — §7 |
| **indianapi.in** | Live/delayed pricing, **company fundamentals, historical financials & ratios, corporate actions, IPO data, analyst forecasts, market news** | **Live today** — now the named source for the Fundamental engine, closing the gap in v8.1 |
| **NSE/BSE** | Corporate announcements, results, filings, corporate actions, exchange events | Official, free |
| **AMFI/MFAPI** | Mutual fund NAV, fund data | Live today (`mf-data.server.ts`) |
| **News Provider** | Financial/company news beyond indianapi.in's coverage if needed | Open — evaluate only if indianapi.in's news coverage proves insufficient |
| **Social Providers (Reddit/X)** | Retail sentiment | **Honesty caveat carried forward:** X's meaningful API tiers are paid, not free; Reddit is free but rate-limited with thin coverage of Indian mid/small-caps. Sentiment signal confidence must reflect this honestly rather than force a strong signal from weak coverage. |
| **Institutional Flow (FII/DII)** | Daily flow data | Open — RBI/NSE bulletins, daily granularity only, not urgent to resolve before Phase 1 |
| **Macro (RBI/MOSPI)** | Rates, inflation, GDP | Open — low build priority, daily/periodic data |

User/Portfolio Data (holdings, transactions, watchlist, goals, risk preferences, SIP info) is internal, from the Supabase Operational Data domain (§8).

---

## 7. Market Intelligence Platform & Live Monitoring *(corrected from v8.1)*

The Market Intelligence Platform remains the sole external-data boundary — provider adapters, auth, fetch, normalization, validation, timestamps, quality/freshness metadata, provider health, rate-limit management, fallback handling. Downstream components never see provider-specific payloads.

```text
External Provider → Provider Adapter → Normalize → Validate
→ Quality/Freshness Metadata → WealthOS Data
```

### Live Monitoring — Supabase-native (v1)

No always-on external worker. Instead:

```text
Supabase Cron (pg_cron, 1-min interval, market hours only)
        ↓
Scheduled Edge Function
        ↓
Angel One SmartAPI REST quote/LTP endpoints (portfolio + watchlist symbols only)
        ↓
Normalize → Upsert live-quote table (Supabase)
        ↓
Rolling-window recompute (Technical signal, Anomaly Detection)
        ↓
Signal Aggregation → Freshness Gate → Dashboard / Trigger Engine
```

- **Monitoring universe is portfolio + watchlist + selected Discovery candidates** — not all of NSE — same as v8.1's intent, now also the right scope for polling rate limits.
- **Freshness ceiling is ~60 seconds**, not tick-level. This is adequate for swing and ordinary intraday review; it is not built for scalping.
- **Upgrade path preserved, not designed now:** if 60s proves insufficient once this is running, the Provider Adapter interface means swapping in a real WebSocket worker (a small external host) later is a contained change — it replaces the ingestion mechanism only, not the Signal Layer, Anomaly Detection, or anything downstream. This is a deliberate, explicit deferral, not a gap.
- Reconnect/heartbeat concerns from v8.1 don't apply the same way to polling (no persistent connection to lose) — instead, monitor **scheduled-job failure/skip** as the equivalent operational alert: a missed poll must surface as "stale," never silently look live.

---

## 8. WealthOS Data Platform (Supabase/PostgreSQL)

Unchanged from v8.1. Logical storage domains:

- **Operational Data** — Portfolio, Transactions, Watchlist, Goals, User preferences, Strategies
- **Market Data** — Latest quotes, candles, NAV history, fundamentals, market events, news, corporate actions
- **Evidence** (append-only) — Research evidence, signals, composite signals, probabilities, market regimes, rule evaluations, portfolio snapshots
- **AI Decision & Audit** (append-only) — Brain runs, analysis plans, capability calls, evidence references, decisions, validation results, explanations
- **Execution** *(schema reserved, not populated in v1)* — Trade proposals, user approvals, orders, executions, reconciliation
- **Evaluation** — Signal outcomes, decision outcomes, strategy performance, confidence calibration

---

## 9. Request & Trigger Layer

Unchanged from v8.1. Analysis can start from: Atlas question, Dashboard action, scheduled job, market event, anomaly, portfolio change, watchlist change, IPO event, results event. Trigger Engine handles deterministic events; Market Calendar Service controls market-dependent scheduling.

---

## 10. Market Calendar Service

Unchanged from v8.1 — knows NSE/BSE holidays, market open/close, pre-open, special sessions, exceptional closures. Exposes `isTradingDay()`, `isMarketOpen()`, `currentSession()`, `nextOpen()`, `nextClose()`, `isSpecialSession()`. Used by Trigger Engine, Live Monitoring (§7), Data Freshness Gate, Decision Validator. No workflow assumes plain Monday–Friday.

---

## 11. Capability Gateway

Unchanged from v8.1. All Brain tool requests pass through the gateway — the Brain cannot invoke arbitrary code. Controls approved capabilities, parameter validation, permissions, duplicate-analysis prevention, timeouts, max iterations, tool-call budget, provider availability, failure handling.

```text
Investment Brain → "I need valuation analysis" → Capability Gateway
→ Validate request → Valuation capability → Structured evidence → Investment Brain
```

---

## 12. Intelligence Capabilities

Unchanged from v8.1, grouped: Research (Technical/Fundamental/Valuation/Liquidity/Derivatives/Institutional/Sector/Macro), Market Events (Earnings/Filings/Corporate actions/News/Block-Bulk deals/Ratings/Regulatory), Portfolio (Holdings/Transactions/Allocation/P&L/XIRR/Concentration/Exposure/Cash/Goals), Rules & Risk (the 12 categories), Strategy (Long Term/Swing/Intraday/ETF/MF/SIP/IPO/Portfolio Review), Discovery (Candidate screening/Watchlist intelligence/Portfolio cross-reference). Logical groupings, not separate microservices.

---

## 13. Signal Intelligence

Ten signal families — Technical, Fundamental, Valuation, Sentiment, Corporate Action, Derivatives, Institutional Flow, Liquidity, Sector, Macro — each producing `{direction, strength, confidence, evidence, observedAt, source}`. **Individual signals never produce BUY/SELL.**

**Build-order note (carried from prior HLD, still valid):** Technical + Fundamental first (now backed by indianapi.in, §6), then Corporate Action + Sentiment (with the honesty caveat above), then the rest as Institutional Flow/Sector/Macro sources get resolved.

---

## 14. Signal Aggregation

Unchanged from v8.1. Instrument × Strategy composite view — the same stock can be BULLISH for Long Term and NEUTRAL for Intraday simultaneously. Composite states: STRONGLY_BULLISH, BULLISH, NEUTRAL, BEARISH, STRONGLY_BEARISH. **Never outputs BUY/SELL** — only the Investment Brain does, because a bullish instrument may still be unsuitable for this portfolio.

---

## 15. Confidence Calibration

Unchanged from v8.1 — deterministic, not LLM-invented. Considers signal agreement, historical signal reliability, evidence quality, freshness, data completeness, market regime compatibility, strategy compatibility. Historical outcomes feed calibration over time (Evaluation → Confidence Calibration → Signal Aggregation → Investment Brain).

---

## 16. Market Probability

Unchanged. Bullish/Bearish/Sideways probability + confidence. **Probability is evidence, never a recommendation.**

---

## 17. Market Regime

Unchanged. BULL/BEAR/SIDEWAYS/RISK_ON/RISK_OFF/HIGH_VOL/NORMAL_VOL/LOW_VOL — market-wide context for signals and reasoning.

---

## 18. Anomaly Detection

Unchanged, now running on the polled 60s cadence (§7) rather than tick data. Flags abnormal price/volume/volatility/gaps/momentum/historical deviation, feeds Dashboard/Signal Aggregation/Trigger Engine/Notification immediately — does not wait for AI. If no credible cause is identified: `UNEXPLAINED_MOVE`. **WealthOS must never fabricate a cause.**

---

## 19. Data Freshness Gate

Unchanged — every important datum carries `source`, `observedAt`, `receivedAt`, `freshness`, `quality`. States: LIVE, FRESH, STALE, EXPIRED. Controls both UI (stale data cannot appear as live) and Decision Eligibility (a time-sensitive decision can be blocked when required data is stale → `INSUFFICIENT_DATA` rather than an AI guess). **Freshness thresholds must be recalibrated for the ~60s polling cadence in §7** — this is an LLD-level parameter, not re-derived here.

---

## 20. Evidence Model

Unchanged. Structured contract: `evidenceId, correlationId, instrument, assetType, category, engine, engineVersion, direction, strength, confidence, facts, source, observedAt, fetchedAt, freshness, quality`. The Brain reasons from structured evidence, never raw API payloads.

---

## 21. Investment Brain Reasoning Loop

Unchanged from v8.1 — bounded by max iterations, max capability calls, timeout, cost/token budget, capability permissions.

```text
REQUEST/EVENT → BRAIN → UNDERSTAND → PLAN → CAPABILITY GATEWAY
→ REQUIRED CAPABILITIES → STRUCTURED EVIDENCE → BRAIN
→ ENOUGH EVIDENCE? → NO: EXTEND ANALYSIS (loop) | YES: THESIS + COUNTER-THESIS → DECIDE
```

---

## 22. Investment Decisions

Unchanged set: BUY, SELL, HOLD, REDUCE, TOP_UP, REBALANCE, BOOK_PROFIT, START_SIP, INCREASE_SIP, REDUCE_SIP, PAUSE_SIP, LUMPSUM, APPLY_IPO, AVOID_IPO, ADD_WATCHLIST, REMOVE_WATCHLIST, MONITOR, NO_ACTION, INSUFFICIENT_DATA. **`NO_ACTION` is a successful decision** — the architecture must never pressure the Brain into an action for every analysis.

---

## 23. Decision Contract

Unchanged: `decisionId, correlationId, instrument, strategy, action, confidence, thesis, counterThesis, supportingEvidenceIds, contradictingEvidenceIds, risks, invalidationConditions, missingEvidence, timeHorizon, monitoringPlan, executionProposal, brainVersion, promptVersion`. `executionProposal` is populated in the schema now but has nowhere to go until the deferred execution phase (§29).

---

## 24. Decision Validator

Unchanged — the Brain cannot bypass this. Validates required evidence exists, freshness, quality, strategy eligibility, portfolio limits, risk limits, applicable rules, confidence threshold, contradictions acknowledged, duplicate recommendation, current market state. Failure → `NO_ACTION` or `INSUFFICIENT_DATA`.

---

## 25. User Experience

Unchanged split — live deterministic info (quotes, portfolio values, composite signals, market state, anomalies, freshness, watchlist, P/L) never requires the Brain; AI intelligence (why did this move, should I invest/sell, today's opportunities, portfolio risks, IPO/SIP decisions) does. This keeps the LLM off the critical path for the live dashboard — important now that quotes refresh every ~60s via Cron rather than push.

---

## 26. Explanation

Unchanged contract: WHAT HAPPENED, WHY IT MATTERS, EVIDENCE, THESIS, COUNTER-THESIS, PORTFOLIO IMPACT, RECOMMENDATION, RISKS, WHAT WOULD CHANGE OUR VIEW, CONFIDENCE. Cannot alter the structured decision.

---

## 27. Daily Investment Brief

Unchanged pipeline: pre-market trigger → market context/portfolio/watchlist/events/signals/anomalies/discovery/regime → evidence package → Investment Brain → prioritize/investigate/identify opportunities & risks/recommend → Decision Validation → Daily Investment Brief.

---

## 28. Live Monitoring (Dashboard)

Same intent as v8.1, mechanism updated per §7:

```text
Supabase Cron (Angel One REST poll, ~60s, market hours)
    → Live Market State → Signals/Anomaly → Signal Aggregation
    → Freshness Gate → LIVE DASHBOARD
```

Significant events still route: Anomaly → Trigger Engine → Investment Brain → Investigate → Decision → Alert/Recommendation. Live monitoring stays separated from AI reasoning, unchanged from v8.1's intent.

---

## 29. Trade Execution *(DESIGN RETAINED, NOT BUILT IN V1)*

Kept here because it's a sound design and the Decision Contract (§23) already anticipates it — but explicitly **out of v1 scope** per your decision. When this phase starts:

```text
Investment Brain → Validated Recommendation → Trade Proposal
→ USER APPROVAL → Execution Validator → Broker Gateway → Angel One
→ Execution Confirmation → Portfolio Reconciliation
```

The user remains the final trade authority — the Brain proposes, never executes directly, unchanged from v8.1.

---

## 30. Execution Safety *(deferred with §29)*

Before submitting an approved order (future phase): approval validity, proposal unchanged, instrument, quantity, price tolerance, available cash/holdings, position limits, portfolio risk, market session, strategy permissions, duplicate order, broker health. Material market change → `REAPPROVAL_REQUIRED`.

---

## 31. Evaluation & Learning

Unchanged. Tracks signal/strategy/recommendation/confidence/reference price/regime/1D/5D/20D outcomes/MFE/MAE, feeding Confidence Calibration. The Brain may analyze results and *recommend* strategy/rule changes; it cannot autonomously deploy them.

---

## 32. Observability

Unchanged list, with one addition specific to §7: **scheduled-job status/skip detection** for the Cron-based poller replaces "WebSocket heartbeat/reconnect failures" as the operational signal to alert on. A missed poll must never silently present as live data.

---
## 33. AI Production Controls

Unchanged — structured output validation, capability allow-list, evidence-reference validation, hallucinated-evidence detection, iteration limits, timeout, retry policy, model-provider abstraction, deterministic decision validation. AI failure must fail safely.

---

## 34. Technology Architecture *(corrected)*

| Layer | Technology |
|---|---|
| Development platform | Lovable |
| UI | React + TypeScript + Tailwind |
| Application | TanStack Start / TypeScript |
| Application runtime | Node.js (via TanStack server functions — no separate runtime) |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Scheduling | Supabase Cron / scheduled Edge Functions |
| **Live market data ingestion** | **Supabase Cron polling (~60s), Angel One REST quote/LTP — no external worker in v1** |
| AI | Provider-abstracted LLM |
| Initial LLM | Claude |
| Live price provider | Angel One SmartAPI (polled) |
| **Fundamental data provider** | **indianapi.in (already integrated) — fundamentals, financials, ratios, IPO data, forecasts, news** |
| Exchange/corporate sources | NSE/BSE |
| Mutual funds | AMFI/MFAPI |
| Observability | Structured logs + correlation IDs + operational alerts (incl. missed-poll detection) |
| Broker execution | **Deferred** — adapter-based design retained (§29), not implemented in v1 |

No microservices, Kafka, Kubernetes, Redis, or vector database without a measured requirement — unchanged from v8.1.

---

## 35. Deployment Architecture *(corrected)*

```text
                     LOVABLE / APPLICATION
                             │
              ┌──────────────┼───────────────┐
              │              │               │
              ▼              ▼               ▼
             UI      Investment Brain      Engines
              │              │               │
              └──────────────┼───────────────┘
                             │
                             ▼
                  SUPABASE / POSTGRES
                    (data + Cron scheduler)
                             │
                             ▼
                  Scheduled Edge Function
                    (polls Angel One REST,
                     ~60s, market hours)
                             │
                             ▼
                         ANGEL ONE
              (quotes via REST poll; broker
               execution adapter reserved,
               not active in v1)
                External Data Providers
              NSE / BSE / AMFI / indianapi.in
                    External AI Provider
                      Claude / Future LLM
```

**Single deployment target: Lovable + Supabase.** No second host, no separate CI/CD path, no independent uptime surface to maintain outside the platform you're already building in. This is the one architectural difference from v8.1's diagram, and it's the point of this correction.

---

## 36. Final HLD Flow

Unchanged sequence from v8.1:

```text
1. DATA SOURCES → 2. MARKET INTELLIGENCE (Cron-polled) → 3. DATA PLATFORM
→ 4. REQUEST/TRIGGER → 5. BRAIN (Understand+Plan) → 6. CAPABILITY GATEWAY
→ 7. REQUIRED CAPABILITIES → 8. SIGNAL/MARKET INTELLIGENCE → 9. EVIDENCE+FRESHNESS
→ 5. BRAIN (Observe+Adapt+Reason) → more evidence? loop to 6 : proceed
→ 10. INVESTMENT DECISION → 11. DECISION VALIDATION → 12. DASHBOARD/ATLAS/ALERT
→ trade required? → NO: done | YES: TRADE PROPOSAL (queued for future execution phase,
   not actioned in v1) → PORTFOLIO/AUDIT
```

---

## 37. Final Architecture Boundary

Unchanged three-way split:

- **AI owns:** Understand, Plan, Choose, Investigate, Adapt, Connect evidence, Challenge thesis, Reason, Recommend, Explain, Monitor.
- **Deterministic software owns:** Market data, financial calculations, research calculations, signals, composite scores, probability, confidence calibration, anomaly detection, freshness, portfolio calculations, risk, rules, validation, (future) trade execution, audit.
- **User owns:** Goals, preferences, risk profile, final trade approval.

---

## 38. Final Architecture Statement

WealthOS is a **Single-Agent Hybrid Investment Intelligence System**, entirely within Lovable + Supabase, using AI for adaptive investment reasoning, deterministic software for financial truth/reliability/safety, and (in a later phase) human approval for real-money execution.

**This HLD (v8.2) is the frozen architectural baseline for LLD and implementation**, superseding both the earlier draft HLD and the uploaded v8.1 document — the difference is three corrections (§0), not a different architecture.

### Still-open items (non-blocking, resolve during relevant engine's LLD)
- Institutional Flow (FII/DII) and Macro data sources — daily-granularity, low build priority.
- Whether indianapi.in's news coverage is sufficient or a dedicated news aggregator is still needed.
- Freshness threshold values (LIVE/FRESH/STALE/EXPIRED cutoffs) for the ~60s polling cadence — an LLD parameter, not an HLD decision.
