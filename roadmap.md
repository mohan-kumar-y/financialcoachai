# Roadmap

## Done
- [x] Phases 1-8 (agent loop, market intelligence, freshness+rules, calendar+portfolio, signals, aggregation/probability/anomaly, strategy registry, trigger engine)
- [x] Full product/technical audit (findings summarised in chat; detail in .lovable/plan.md)
- [x] Phase 9 — watchlist target alerts, discovery cross-reference, corporate-action signal, Reddit sentiment signal

## Open
- [ ] Audit remediation round 1: require cron secret, reject anonymous chat, remove fabricated alerts, enforce disclaimer in code
- [ ] Audit round 2: goals persistence, real mutual-fund data, real daily brief
- [ ] Surface watchlist targets + triggered alerts in the UI (engine + server fns exist, no screen yet)

## Blocked on credentials
- [ ] Angel One (live quotes/candles inert — also means target alerts never fire yet)
- [ ] Reddit (sentiment signal degrades to "unavailable")
