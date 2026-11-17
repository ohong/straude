# Authenticated page performance review

## Current behavior and acceptance (2026-09-04)

The reviewed change renders initial settings, search, card, and recap data on the
server. It removes duplicate post/profile work and batches message attachment
signing. Auth keeps server-confirmed `getUser()` checks. Leaderboard listings and
ranks stay live, and radar snapshots fall back to the previous live calculation
when missing, unavailable, or older than 20 minutes.

Search deep links and the API share one validated filter. Editing the search box
issues one API request and changes the URL without a second server navigation.
Settings saves preserve the browser timezone fallback. Regional ranks require an
entry in the selected region.

The right-sidebar API keeps main's existing live implementation. The proposed
candidate-loader became slower after persistent caching was removed, so it was
removed. Public privacy changes take effect on the next request. No shared
sidebar cache remains.

Acceptance means useful initial data, working interactions, unchanged auth and
privacy boundaries, regression tests, and green CI. The old all-pages-under-500ms
target is not the current result. Production p75 performance remains unverified.

## Current local comparison

Baseline: `main` at `7ee21a7`. Candidate: `b01634a`, followed by restoring main's
sidebar implementation. The subsequent `3f82ac0` main merge changes CLI source
support and product wording; the table measures the named earlier commits.

Both used a production build, Next.js 16.2.6, Chromium 145 (Playwright 1.58.2),
the same isolated Supabase instance, and the same three local fixture users.
The two demo accounts have 21 days of usage each. Each route used five full
navigations; the first was discarded and the last four were summarized by their
median. TTFB and LCP below are milliseconds. The 1.5-second LCP observation
window and all measurement code matched across branches.

The candidate ran first, then main, then a confirming candidate run. The baseline
copied only the harness/config into a detached worktree; product code was
unchanged. Main has no perf timing marker, so its guard checked `#main-content`,
HTTP success, the exact URL, and a successful authenticated profile API request.
Both branches passed all 12 functional harness checks.

| Route | Main TTFB | PR TTFB | Main LCP | PR LCP | LCP difference |
|---|---:|---:|---:|---:|---:|
| `/feed` | 103 | 94 | 192 | 194 | +2 |
| `/leaderboard` | 85 | 90 | 544 | 412 | -132 |
| `/u/[username]` | 110 | 92 | 220 | 186 | -34 |
| `/post/[id]` | 109 | 89 | 214 | 178 | -36 |
| `/notifications` | 95 | 91 | 546 | 560 | +14 |
| `/messages` | 89 | 84 | 554 | 546 | -8 |
| `/prompts` | 87 | 89 | 554 | 542 | -12 |
| `/recap` | 77 | 92 | 690 | 562 | -128 |
| `/settings` | 79 | 87 | 644 | 174 | -470 |
| `/search` | 81 | 89 | 522 | 428 | -94 |

Settings improved from 644ms to 174ms LCP; search from 522ms to 428ms; recap from
690ms to 562ms. Feed was effectively unchanged at 192ms versus 194ms. The
confirming candidate met the historical threshold on 6/10 routes; main met it on
3/10. Notifications, messages, prompts, and recap still exceed 500ms.

The first candidate run was slower on feed and leaderboard, but those differences
disappeared in the confirming run. The sidebar regression persisted: main's API
median was 65ms, versus 120ms and 150ms in the two candidate runs. That experiment
was rejected and main's implementation restored. The restored route is measured
separately below; the slower version is not part of the final implementation.

Restored-sidebar recheck: 79ms median across four warm requests (117, 84, 74,
65ms; the 349ms initial request was discarded). This is close to the 65ms main
baseline and materially below the rejected 150ms result. Small remaining timing
differences are not evidence of an implementation change: the route now matches
main exactly.

These are small local samples with host scheduling and paint variability. They
are evidence for the tested fixture, not a production percentile or a promise
that every route is faster. No current bundle-size saving was measured.

## Functional verification

The local production walkthrough saved and reloaded a changed display name,
verified initial search results and one API request with zero duplicate RSC
requests after an edit, and hid then restored a profile after warming the
leaderboard/sidebar. The next reads reflected each privacy change. No browser
runtime errors were observed. The temporary fixture edits were restored.

Remote Supabase tests require explicit `PERF_ALLOW_REMOTE=1`. Auth state and
scorecard outputs remain ignored. The review used only the isolated local stack.
Current tests, build, CI, and final structured-review results are recorded in the
pull request closeout.

## Historical July 18 evidence (superseded implementation)

The July milestones recorded a claims-only auth gate, persistent snapshot caches,
and two passing local timing runs. Those implementation choices and completion
criteria are historical. They do not describe this review's final code or authorize
new deployments, database changes, scheduled work, or continuation of that plan.

The original July scorecard recorded these values:

| Page | TTFB | FCP | LCP | Server-Timing | Layout attribution | Pass |
|---|---:|---:|---:|---|---|:---:|
| `/feed` | 35ms | 92ms | 442ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:28ms | PASS |
| `/leaderboard` | 44ms | 108ms | 160ms | mw-auth:1ms | layoutAuth:3ms layoutProfile:36ms | PASS |
| `/u/[username]` | 43ms | 98ms | 466ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:36ms | PASS |
| `/post/[id]` | 36ms | 90ms | 432ms | mw-auth:0ms | layoutAuth:2ms layoutProfile:29ms | PASS |
| `/notifications` | 35ms | 92ms | 438ms | mw-auth:1ms | layoutAuth:1ms layoutProfile:29ms | PASS |
| `/messages` | 43ms | 100ms | 444ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:36ms | PASS |
| `/prompts` | 42ms | 98ms | 98ms | mw-auth:0ms | layoutAuth:2ms layoutProfile:35ms | PASS |
| `/recap` | 39ms | 94ms | 434ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:32ms | PASS |
| `/settings` | 43ms | 100ms | 444ms | mw-auth:1ms | layoutAuth:2ms layoutProfile:36ms | PASS |
| `/search` | 37ms | 92ms | 430ms | mw-auth:0ms | layoutAuth:1ms layoutProfile:31ms | PASS |

The July bundle analysis reported about 39 KiB gzip removed by keeping Agentation
out of production imports. That measurement has not been repeated for the current
merged dependency tree. See `BASELINE.md`, `DB.md`, `RUM.md`, and `bundles.md` for
other explicitly historical evidence. The current design is in `docs/DECISIONS.md`.
