# Mission Progress

**Mission:** improve Straude activation
**Started:** 2026-05-04
**Status:** Complete. PR https://github.com/ohong/straude/pull/114 opened 2026-05-04.

## Follow-ups

- 7-day check-in scheduled (one-shot cron in this Claude session, plus the manual notebook): query insight `DV22QC1d` on 2026-05-11 and confirm activation rate moved from the 47% baseline.
- Re-engage the 55 install-but-never-pushed users once the PR ships and the new CLI propagates via npm.
- Consider relaxing or quarantining the flaky `authenticated-100ms.test.tsx > messages optimistic send` perf budget — flaked at 1018ms / 1068ms under concurrent monorepo load.

## Milestones

- [x] Milestone 1: CLI resilience + activation tracking
- [x] Milestone 2: ccusage detect & install on first run
- [x] Milestone 3: Filter out-of-window backfill dates client-side
- [x] Milestone 4: Silent re-auth on 401 + sliding token refresh
- [x] Milestone 5: Schedule weekly activation check-in via PostHog
  - Insight: https://us.posthog.com/project/374497/insights/DV22QC1d
  - Notebook: https://us.posthog.com/project/374497/notebooks/QQ7eCe7G
  - PostHog Subscriptions are paid tier — using a notebook + manual reminder as the no-cost equivalent.
- [x] Milestone 6: Integration, verification & PR
