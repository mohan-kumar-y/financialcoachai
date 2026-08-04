# Addendum — Data Source Status & Compliance Note
## Aligned to HLD v8.2 / LLD (source of truth)

Supersedes the earlier tier-based addendum now that several items have been resolved through actual decisions rather than left as tiers to plan later.

## 1. Resolved

| Item | Resolution |
|---|---|
| Live equity data hosting | Supabase Cron polling (~60s), Angel One SmartAPI REST — no external worker (HLD §7) |
| Fundamental data source | indianapi.in, already integrated (HLD §6, LLD §1.2) |
| Trade execution | Deferred to Phase 14 — design retained, not built in v1 (HLD §29) |
| SEBI compliance concern | Lower priority than originally flagged — this is single-user personal use with no execution and no distribution of recommendations to others. Re-open this only if outputs are ever shared beyond this account, or when Phase 14 execution ships. Kept as the COMPLIANCE rule category (LLD §11) so it isn't forgotten, not as a current blocker. |

## 2. Still Open (non-blocking, resolve at the relevant phase)

| Item | Plan | Phase |
|---|---|---|
| Angel One option-chain/OI entitlement | Verify actual API access before building Derivatives signal — SmartAPI's option-chain access isn't assumed in this LLD | Phase 11 |
| Institutional Flow (FII/DII) | RBI/NSE daily bulletins, daily granularity only | Phase 11 |
| Macro (RBI/MOSPI) | Periodic/on-publication data | Phase 11 |
| Sector signal source | Needs a sector-index/classification source — not yet named | Phase 11 |
| Sentiment coverage | Reddit first (free); X only if Reddit proves too thin — must report low confidence honestly for low-coverage symbols, never force a strong signal | Phase 9 |
| Dedicated news aggregator | Only if indianapi.in's news endpoint proves insufficient once Phase 2 is live | Evaluate after Phase 2 |

None of these block Phase 1 (the agentic Brain/Gateway/Validator loop) or Phase 2 (live data + fundamentals) — they're signal-engine-specific and land as their sources are confirmed, per the roadmap's Phase 11 approach of shipping each independently rather than blocking on all four together.
