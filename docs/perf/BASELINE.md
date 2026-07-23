# M0 performance baseline

Captured on 2026-07-18 from a local production build before the subsequent
auth-consolidation edits in the working tree.

## Result

All 10 authenticated gating pages met the TTFB target. Five met both gates.
The five failures were LCP-only: `/recap` (626ms), `/u/[username]` (518ms),
`/leaderboard` (510ms), `/feed` (504ms), and `/messages` (500ms). The target is
strictly less than 500ms, so 500ms is a failure.

| Page | TTFB | FCP | LCP | Server-Timing | Layout attribution | Pass |
|---|---:|---:|---:|---|---|:---:|
| `/feed` | 87ms | 148ms | 504ms | mw-auth:25ms | layoutAuth:25ms layoutProfile:29ms | FAIL |
| `/leaderboard` | 92ms | 152ms | 510ms | mw-auth:30ms | layoutAuth:29ms layoutProfile:30ms | FAIL |
| `/u/[username]` | 85ms | 144ms | 518ms | mw-auth:26ms | layoutAuth:26ms layoutProfile:30ms | FAIL |
| `/post/[id]` | 100ms | 162ms | 362ms | mw-auth:25ms | layoutAuth:27ms layoutProfile:38ms | PASS |
| `/notifications` | 87ms | 148ms | 494ms | mw-auth:29ms | layoutAuth:26ms layoutProfile:27ms | PASS |
| `/messages` | 92ms | 154ms | 500ms | mw-auth:26ms | layoutAuth:25ms layoutProfile:32ms | FAIL |
| `/prompts` | 84ms | 144ms | 144ms | mw-auth:25ms | layoutAuth:24ms layoutProfile:28ms | PASS |
| `/recap` | 88ms | 148ms | 626ms | mw-auth:29ms | layoutAuth:26ms layoutProfile:27ms | FAIL |
| `/settings` | 82ms | 142ms | 484ms | mw-auth:25ms | layoutAuth:25ms layoutProfile:27ms | PASS |
| `/search` | 85ms | 142ms | 486ms | mw-auth:26ms | layoutAuth:24ms layoutProfile:28ms | PASS |

Right-sidebar API median: **125ms** (informational).

## Method

- Command: `bun run perf` from the repository root.
- Runtime: Next.js 16.2.6 production build via `next build` and Playwright's
  `webServer` running `next start` on localhost.
- Browser: Playwright 1.58.2 with its pinned Chromium 145.0.7632.6 headless
  shell on macOS arm64.
- Backend: the configured production Supabase project, using the dedicated
  authenticated perf account from `PERF_TEST_EMAIL` and
  `PERF_TEST_PASSWORD`.
- Dynamic targets: the setup fixture selected a current leaderboard profile
  and recent post visible to the perf account.
- Sampling: five full navigations per page; run one discarded; reported values
  are the median of the remaining four runs.
- Gates: TTFB <300ms and LCP <500ms. FCP and right-sidebar response time are
  recorded but do not gate the page.

The raw JSON and generated Markdown remain in the gitignored
`apps/web/perf-results/` directory. Middleware auth attribution comes from the
`Server-Timing` response header. Layout auth/profile attribution comes from a
perf-only JSON marker in the rendered document because an App Router Server
Component cannot append response headers after middleware has returned.
