# WealthOS Low-Level Design (LLD)
## Aligned to HLD v8.2 (Frozen Baseline)
### Status: Source of truth for implementation

Every component below traces directly to a numbered section of `01-HLD.md`. Where the old draft LLD used different component names (Request Orchestrator, no Capability Gateway), this version replaces them entirely — it is not a patch, it is the LLD for v8.2.

---

## 1. API Source Catalog — Concrete Endpoints

This is the "everything should be present" list: every external call any engine makes, named.

### 1.1 Angel One SmartAPI (live quotes; execution reserved, not called in v1)

| Purpose | Endpoint (SmartAPI) | Called by | Cadence |
|---|---|---|---|
| Session login (TOTP) | `POST /rest/auth/angelbroking/user/v1/loginByPassword` | Auth adapter, on worker/function cold start + token refresh | Per session (~24h token validity) |
| LTP / quote | `POST /rest/secure/angelbroking/order/v1/getLTP` | `angel-one.adapter.ts` | Every Cron tick, ~60s, market hours only |
| Historical candles | `POST /rest/secure/angelbroking/historical/v1/getCandleData` | Technical Signal Engine (for indicators needing history, e.g. moving averages) | On-demand, cached |
| Option chain / OI | Subject to SmartAPI entitlement — verify access during Phase 6 build, not assumed here | Derivatives Signal Engine | Deferred to Phase 11 (Tier 2 data) |
| Order placement | `POST /rest/secure/angelbroking/order/v1/placeOrder` | Broker Gateway | **Not called — execution deferred (HLD §29)** |

Auth note: requires API key + client code + PIN + TOTP secret, stored as Supabase server-only secrets, never in client bundle.

### 1.2 indianapi.in (fundamentals, financials, IPO, forecasts, news)

| Purpose | Endpoint (per dev.indianapi.in docs) | Called by | Cadence |
|---|---|---|---|
| Company fundamentals/profile | `GET /stock` (by name/symbol) | Fundamental Signal Engine, Research Engine | Cached, daily |
| Historical financials/ratios | financials/ratios endpoints under `/stock` | Fundamental + Valuation Signal Engines | Cached, quarterly refresh (results-driven) |
| Corporate actions | corporate-actions endpoint | Corporate Action Signal Engine | Daily |
| IPO data | `GET /ipo` | IPO capability (Discovery/Strategy) | Daily |
| Analyst forecasts/targets | forecasts endpoint | Valuation Signal Engine (context only, never authoritative) | Cached, weekly |
| News | news endpoint | Sentiment/Corporate Action Signal Engines | Every few hours |
| Live/delayed price (existing) | already wired in `market-data.server.ts` | MIP (long-term/MF path) | 30-min cache, unchanged |

Exact path names to be confirmed against `dev.indianapi.in` at implementation time — this table is the integration plan, not a copy of their API reference.

### 1.3 NSE/BSE (official, free)

| Purpose | Source | Called by |
|---|---|---|
| Corporate announcements, results, filings | NSE/BSE public endpoints or indianapi.in's corporate-actions passthrough (prefer the latter to avoid a second scraper) | Corporate Action Signal Engine |
| Market holidays/sessions | NSE holiday calendar (published annually) | Market Calendar Service — loaded as static config, refreshed yearly, not polled live |

### 1.4 AMFI / MFAPI

| Purpose | Endpoint | Called by | Cadence |
|---|---|---|---|
| MF NAV | mfapi.in (existing `mf-data.server.ts`) | MIP, unchanged | 3-hr cache, unchanged |

### 1.5 News/Sentiment (open per HLD §6 — planned, not committed)

| Purpose | Candidate | Status |
|---|---|---|
| General news beyond indianapi.in | TBD — evaluate only if indianapi.in coverage is insufficient | Not built |
| Social sentiment | Reddit API (free, rate-limited) first; X API only if Reddit proves too thin | Not built — Phase 9 |

---

## 2. Supabase Schema — All Domains

```sql
create table user_preferences (
  user_id uuid primary key references auth.users(id),
  risk_tolerance text not null,
  sectors text[] default '{}',
  sip_habits jsonb default '{}',
  explanation_style text default 'DETAILED',
  updated_at timestamptz default now()
);

create table strategies (
  id text primary key,
  signal_weights jsonb not null,
  thresholds jsonb not null,
  horizon text not null,
  risk_profile text not null
);

create table live_quotes (
  symbol text primary key,
  ltp numeric not null,
  volume bigint,
  observed_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  source text not null default 'ANGEL_ONE',
  quality text not null default 'ok'
);

create table candles (
  symbol text not null,
  interval text not null,
  ts timestamptz not null,
  open numeric, high numeric, low numeric, close numeric, volume bigint,
  primary key (symbol, interval, ts)
);

create table fundamentals_cache (
  symbol text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create table market_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  event_type text not null,
  payload jsonb not null,
  source text not null,
  observed_at timestamptz not null
);

create table evidence_records (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  stage text not null,
  symbol text,
  payload jsonb not null,
  freshness text not null,
  created_at timestamptz not null default now()
);
create index on evidence_records (correlation_id);
create index on evidence_records (symbol, stage);

create table anomaly_flags (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  flagged boolean not null,
  deviation_score numeric not null,
  driver_class text not null,
  confidence numeric not null,
  created_at timestamptz not null default now()
);

create table brain_runs (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  user_id uuid not null references auth.users(id),
  request_text text,
  trigger_type text not null,
  plan jsonb,
  capability_calls jsonb,
  iterations int not null default 0,
  model text not null,
  prompt_version text not null,
  latency_ms int,
  token_cost numeric,
  created_at timestamptz not null default now()
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null references brain_runs(correlation_id),
  instrument text,
  strategy text,
  action text not null,
  confidence numeric not null,
  thesis text,
  counter_thesis text,
  supporting_evidence_ids uuid[],
  contradicting_evidence_ids uuid[],
  risks text[],
  invalidation_conditions text[],
  missing_evidence text[],
  time_horizon text,
  monitoring_plan text,
  execution_proposal jsonb,
  brain_version text,
  validation_result text,
  created_at timestamptz not null default now()
);

create table explanations (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references decisions(id),
  what_happened text, why_it_matters text, evidence text[],
  risks text[], counter_arguments text[], action text, confidence numeric,
  created_at timestamptz not null default now()
);

create table trade_proposals (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid references decisions(id),
  status text not null default 'PROPOSED',
  created_at timestamptz not null default now()
);

create table decision_outcomes (
  decision_id uuid primary key references decisions(id),
  reference_price numeric,
  outcome_1d numeric, outcome_5d numeric, outcome_20d numeric,
  max_favorable_excursion numeric, max_adverse_excursion numeric,
  regime_at_decision text,
  evaluated_at timestamptz
);
```

All Evidence/Decision/Audit tables are append-only by convention — no UPDATE/DELETE from the application role; RLS restricts mutation to a service role only.

---

## 3. Capability Gateway (HLD §11)

```typescript
export type CapabilityId =
  | "RESEARCH_TECHNICAL" | "RESEARCH_FUNDAMENTAL" | "RESEARCH_VALUATION"
  | "RESEARCH_LIQUIDITY" | "RESEARCH_DERIVATIVES" | "RESEARCH_INSTITUTIONAL"
  | "RESEARCH_SECTOR" | "RESEARCH_MACRO"
  | "EVENTS_EARNINGS" | "EVENTS_FILINGS" | "EVENTS_CORP_ACTION" | "EVENTS_NEWS"
  | "PORTFOLIO_SNAPSHOT" | "RULES_EVALUATE" | "STRATEGY_GET"
  | "DISCOVERY_SCREEN" | "WATCHLIST_QUERY";

export interface CapabilityRequest {
  capability: CapabilityId;
  params: Record<string, unknown>;
  correlationId: string;
}

export interface CapabilityGatewayConfig {
  approvedCapabilities: CapabilityId[];
  maxIterations: number;
  maxCapabilityCalls: number;
  timeoutMs: number;
  tokenBudget: number;
}

export async function invoke(
  request: CapabilityRequest,
  config: CapabilityGatewayConfig,
  runState: { iterationsUsed: number; callsUsed: number }
): Promise<{ evidence: Evidence[] } | { error: "NOT_APPROVED" | "BUDGET_EXCEEDED" | "TIMEOUT" | "PROVIDER_UNAVAILABLE" }>;
```
Enforces the allow-list, dedupes identical requests within a run, and is the only path from investment-brain.ts to any Engine.

---

## 4. Investment Brain (HLD §3, §21)

```typescript
export interface BrainRunInput {
  correlationId: string;
  userRequest?: string;
  triggerType: TriggerType;
  userId: string;
}

export async function run(input: BrainRunInput): Promise<Decision> {
  // 1. UNDERSTAND + PLAN
  // 2. loop: call Capability Gateway -> accumulate Evidence[] -> ask "enough evidence?"
  //    bounded by CapabilityGatewayConfig
  // 3. BUILD THESIS + COUNTER-THESIS
  // 4. DECIDE -> structured Decision (HLD §23 contract)
  // 5. hand off to Decision Validator -- never returned to caller unvalidated
}
```
Direct replacement for today's chat.ts. The Brain calls the Capability Gateway in a loop and decides what it needs next, per HLD §3's adaptive-investigation example. advisor.ts's rule logic becomes reachable only via the RULES_EVALUATE capability, not a direct import.

---

## 5. Decision Validator (HLD §24)

```typescript
export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export function validate(decision: DraftDecision, context: PortfolioContext): {
  result: "PASSED" | "NO_ACTION" | "INSUFFICIENT_DATA";
  checks: ValidationCheck[];
  finalDecision: Decision;
}
```
Runs after the Brain proposes, before anything reaches the Explanation Engine or the user.

---

## 6. Data Freshness Gate (HLD §19)

```typescript
export type Freshness = "LIVE" | "FRESH" | "STALE" | "EXPIRED";

export interface FreshnessPolicy {
  dataType: "QUOTE" | "NAV" | "FUNDAMENTAL" | "NEWS" | "CORP_ACTION";
  strategy?: StrategyId;
  liveThresholdSec: number;
  freshThresholdSec: number;
  staleThresholdSec: number;
}

export const DEFAULT_POLICIES: FreshnessPolicy[] = [
  { dataType: "QUOTE", strategy: "INTRADAY", liveThresholdSec: 90,  freshThresholdSec: 180, staleThresholdSec: 600 },
  { dataType: "QUOTE", strategy: "SWING",    liveThresholdSec: 300, freshThresholdSec: 900, staleThresholdSec: 3600 },
  { dataType: "QUOTE", strategy: "LONG_TERM",liveThresholdSec: 3600,freshThresholdSec: 86400,staleThresholdSec: 259200 },
  { dataType: "NAV",   liveThresholdSec: 86400, freshThresholdSec: 259200, staleThresholdSec: 604800 },
];

export function classify(observedAt: Date, policy: FreshnessPolicy): Freshness;
```

---

## 7. Signal Layer (HLD §13) — Common Contract + Ten Engines

```typescript
export interface Signal {
  engine: "TECHNICAL"|"FUNDAMENTAL"|"VALUATION"|"SENTIMENT"|"CORPORATE_ACTION"
        |"DERIVATIVES"|"INSTITUTIONAL_FLOW"|"LIQUIDITY"|"SECTOR"|"MACRO";
  symbol: string;
  direction: "BULLISH"|"BEARISH"|"NEUTRAL";
  strength: number;
  confidence: number;
  evidence: string[];
  observedAt: string;
  source: string;
}
```
Build order: Technical, Fundamental first, then Corporate Action + Sentiment, then remaining six as data sources resolve.

- technical.signal.ts — reads live_quotes + candles.
- fundamental.signal.ts — reads fundamentals_cache (indianapi.in).
- valuation.signal.ts — combines price with fundamentals_cache; analyst forecasts are context only, never authoritative.
- corporate-action.signal.ts — reads market_events (CORP_ACTION, RESULTS).
- sentiment.signal.ts — reads market_events (NEWS) plus Reddit adapter later; must set confidence low when coverage is thin.
- Remaining five (derivatives, institutional-flow, liquidity, sector, macro) stubbed NOT_IMPLEMENTED until sources land.

---

## 8. Signal Aggregation (HLD §14)

```typescript
export type CompositeState = "STRONGLY_BULLISH"|"BULLISH"|"NEUTRAL"|"BEARISH"|"STRONGLY_BEARISH";

export function aggregate(
  signals: Signal[],
  strategy: StrategyPack
): { symbol: string; strategy: StrategyId; state: CompositeState; score: number };
```

---

## 9. Confidence Calibration (HLD §15)

```typescript
export function calibrate(
  signals: Signal[],
  historicalReliability: Record<Signal["engine"], number>,
  freshness: Freshness,
  regimeCompatibility: number
): number;
```
historicalReliability starts as a flat prior until decision_outcomes has enough rows.

---

## 10. Market Probability, Market Regime, Anomaly Detection (HLD §16-18)

```typescript
export function computeProbability(signals: Signal[], weights: Record<Signal["engine"], number>): ProbabilityResult;
export function computeRegime(marketWideSignals: Signal[]): MarketRegime;
export function detect(
  priceHistory: { symbol: string; ts: string; ltp: number; volume: number }[],
  thresholdSigma: number
): AnomalyFlag;
```
Runs on the Cron-polled ~60s cadence. detect() is called directly after each poll, not from within a Brain run.

---

## 11. Rules Engine (12 categories) & Strategy Registry (HLD §12)

```typescript
export type RuleCategory = "PORTFOLIO"|"RISK"|"ALLOCATION"|"CASH_MANAGEMENT"|"STOCK"
  |"COMPLIANCE"|"TRADING"|"MUTUAL_FUND"|"ETF"|"SIP"|"IPO"|"TAX";

export function evaluate(category: RuleCategory, context: RuleContext): RuleEvaluation[];
```
One file per category. Starter rules: PORTFOLIO (concentration limits), RISK (volatility vs tolerance), ALLOCATION (asset-class bands), CASH_MANAGEMENT (min buffer), STOCK (liquidity/market-cap floor), COMPLIANCE (SEBI-adjacent, low priority for personal use), TRADING (trades/day cap), MUTUAL_FUND/ETF/SIP/IPO (category eligibility), TAX (LTCG/STCG awareness).

```typescript
export function getStrategy(id: StrategyId): StrategyPack;
```
Eight packs: LONG_TERM, SWING, INTRADAY, ETF, MUTUAL_FUND, SIP, IPO, PORTFOLIO_REVIEW — seeded in the strategies table.

---

## 12. Portfolio, Watchlist, Discovery Engines

```typescript
export function snapshot(userId: string): PortfolioSnapshot;
export function addTargetAlert(symbol: string, targetPrice: number, direction: "ABOVE"|"BELOW"): Promise<void>;
export function screen(): DiscoveryCandidate[];
export function crossReference(candidates: DiscoveryCandidate[], portfolio: PortfolioSnapshot, watchlist: WatchlistItem[]): DiscoveryCandidate[];
```

---

## 13. Market Calendar Service (HLD §10)

```typescript
export function isTradingDay(date: Date): boolean;
export function isMarketOpen(at?: Date): boolean;
export function currentSession(): "PRE_OPEN"|"REGULAR"|"CLOSED"|"SPECIAL";
export function nextOpen(): Date;
export function nextClose(): Date;
export function isSpecialSession(date: Date): boolean;
```
Backed by a static NSE holiday-calendar config, refreshed yearly.

---

## 14. Trigger Engine, Notification Engine, Explanation Engine

```typescript
export type TriggerType = "MANUAL"|"SCHEDULED"|"MARKET_OPEN"|"MARKET_CLOSE"|"EARNINGS"
  |"IPO_OPEN"|"PORTFOLIO_CHANGE"|"WATCHLIST_CHANGE"|"MARKET_CRASH";
export function fire(type: TriggerType, context: Record<string, unknown>): Promise<void>;

export async function notify(channel: "DASHBOARD"|"CHAT"|"PUSH"|"EMAIL", explanation: Explanation): Promise<void>;

export async function explain(decision: Decision): Promise<Explanation>;
```

---

## 15. Evaluation & Learning (HLD §31)

```typescript
export async function recordOutcome(decisionId: string, referencePrice: number): Promise<void>;
export async function evaluateOutcomes(): Promise<void>;
```

---

## 16. File/Module Map (current -> target)

| Component | Current file | Target module |
|---|---|---|
| MIP - equities (long-term path) | market-data.server.ts | unchanged, becomes a ProviderAdapter |
| MIP - equities (live path) | - | src/server/mip/angel-one.adapter.ts (new) |
| MIP - fundamentals | - | src/server/mip/indianapi-fundamentals.adapter.ts (new) |
| MIP - MF NAV | mf-data.server.ts | unchanged, becomes a ProviderAdapter |
| Capability Gateway | - | src/server/gateway/capability-gateway.ts (new) |
| Investment Brain | chat.ts (conflated) | src/server/brain/investment-brain.ts |
| Decision Validator | - | src/server/validator/decision-validator.ts (new) |
| Explanation Engine | chat.ts (conflated) | src/server/explanation/explanation-engine.ts |
| Rules Engine | advisor.ts (partial) | src/server/rules/rules-engine.ts + 12 category files |
| Portfolio Engine | advisor.ts (partial) | src/server/portfolio/portfolio-engine.ts |
| Watchlist Engine | watchlist.functions.ts | extended in place |
| Discovery Engine | discovery.functions.ts | extended in place |
| Signal Layer | - | src/server/signals/*.signal.ts (new) |
| Signal Aggregation | - | src/server/aggregation/signal-aggregation.ts (new) |
| Confidence Calibration | - | src/server/calibration/confidence-calibration.ts (new) |
| Market Probability | - | src/server/probability/market-probability.ts (new) |
| Market Regime | - | src/server/regime/market-regime.ts (new) |
| Anomaly Detection | - | src/server/anomaly/anomaly-detection.ts (new) |
| Freshness Gate | - | src/server/freshness/freshness-gate.ts (new) |
| Strategy Registry | - | src/server/strategy/strategy-registry.ts (new) |
| Market Calendar Service | - | src/server/calendar/market-calendar.ts (new) |
| Trigger Engine | inline/implicit | src/server/trigger/trigger-engine.ts (new) |
| Notification Engine | inline in routes | src/server/notification/notification-engine.ts (new) |
| Evaluation Engine | - | src/server/evaluation/evaluation-engine.ts (new) |
| Live quote poller | - | Supabase scheduled Edge Function calling angel-one.adapter.ts |

---

## 17. Design Rules

- The Brain is the only module allowed to reach a decision-capable LLM prompt, and only reaches Engines through the Capability Gateway.
- explanation-engine.ts calls an LLM for prose only; cannot call the Decision Validator, Rules Engine, or Capability Gateway.
- Every Evidence/Decision/Audit table write includes correlation_id.
- No module outside src/server/mip/ imports a provider SDK or calls fetch() against an external host.
- execution_proposal fields and trade_proposals table exist in schema now but nothing writes to trade_proposals until the deferred execution phase — intentional forward-compatibility.
