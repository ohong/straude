# Straude Activation, UX, and Speed Plan

Audit date: 2026-06-15  
Audit commit: `507e67c`  
Mode: read-only codebase audit. No source files were changed.

## Executive Direction

Optimize Straude around one product promise: a new user should understand the loop, sign up, run one command, and see their first session appear with useful feedback.

Keep the app functionality-rich, but make the first path narrow. Move secondary exploration, social features, prompts, and company rankings behind progressive disclosure until after first sync.

## Agent Workstreams

Run these workstreams in order. Workstreams 2-6 can proceed in parallel after Workstream 1 lands the shared activation contract and test scaffolding.

1. `001-activation-funnel-contract.md`  
   Define the canonical signup-to-first-sync funnel, instrumentation, and regression tests.

2. `002-onboarding-first-sync.md`  
   Rework onboarding so first session pushed is the primary activation boundary.

3. `003-public-landing-performance.md`  
   Slim the public landing page and remove live analytics aggregation from the landing render path.

4. `004-authenticated-shell-performance.md`  
   Make the authenticated app shell progressively loaded and stop fetching non-critical data on every app route.

5. `005-core-app-ux-activation.md`  
   Improve feed, profile, guest, empty-state, and navigation UX while preserving depth.

6. `006-cli-first-run-snappiness.md`  
   Make the CLI first run fast, explicit, and rewarding.

7. `007-final-integration-pass.md`  
   Merge the workstreams, resolve cross-surface copy and state conflicts, and run the full verification pass.

## Highest-Confidence Findings

- The app marks onboarding complete before first session sync. `apps/web/app/(onboarding)/onboarding/page.tsx` sends `onboarding_completed: true` before Step 3, and `apps/web/app/api/users/me/route.ts` sends welcome/onboarding side effects on that flag. This optimizes for profile completion rather than first session pushed.
- The Step 3 usage poll is both fragile and wasteful. It ignores pre-existing usage by baseline session count, then `/api/usage/status` selects all `daily_usage` rows every 4 seconds and reduces them in application code.
- The public landing page pays for too much interactivity up front. The root layout globally mounts analytics, query, theme, and app providers; the landing hero is a client component for one copy button; WebGL, motion-heavy sections, and a remote Product Hunt badge compete with the first CTA.
- The landing ticker fetch path can do live analytics work during page render. `getTickerStats()` calls `getOpenStatsForPage()`, which fetches up to 50,000 usage rows plus admin aggregates before falling back to snapshots. Public pages should use snapshot-first data.
- The authenticated shell eagerly fetches and hydrates non-critical surfaces. Notifications, app counts, command palette, route prefetches, prompt widget, sidebars, photo nudges, and duplicate usage totals are all mounted around every app route.
- The CLI first run can be slower than the activation moment allows. A fresh user may authenticate, run a 30-day migration backfill, use online `ccusage` pricing, submit usage, fetch dashboard data, render Ink output, and wait for telemetry shutdown before the command fully exits.
- Guest and no-data web surfaces do not consistently point users to the sync command. The product has strong data views, but the empty and guest states do not keep the activation loop visible enough.

## PostHog Status Checked On 2026-06-16

PostHog is installed and should be the analytics system of record for activation iteration.

- Web wiring exists in `apps/web/components/providers/PostHogProvider.tsx`. It initializes `posthog-js` only after analytics cookie consent, uses `/ingest` as a first-party proxy, disables automatic pageview capture, manually captures `$pageview`, and identifies Supabase users.
- CLI wiring exists in `packages/cli/src/lib/posthog.ts`. It uses the same public project key, sends to `https://us.i.posthog.com`, flushes immediately for short-lived CLI runs, scrubs home-directory paths, honors `STRAUDE_TELEMETRY_DISABLED` and `DO_NOT_TRACK`, and disables telemetry in tests.
- `apps/web/next.config.ts` includes `/ingest` rewrites to PostHog US endpoints. The CSP allows the same-origin proxy through `connect-src 'self'`.
- Local env files include PostHog config. Implementation agents still need to verify deployed Vercel env has `NEXT_PUBLIC_POSTHOG_KEY`.
- PostHog project data confirms recent CLI events are being captured: `cli_authenticated`, `usage_pushed`, `usage_push_failed`, `cli_first_run`, and `login_completed`.
- PostHog project data does not currently show the required web activation events: `landing_primary_cta_clicked`, `signup_started`, `signup_completed`, `sync_command_copied`, `first_sync_confirmed`, or `activation_completed`.
- `$pageview` exists in the project taxonomy but had no recent 30-day capture in the project query. Agents must verify whether this is caused by low "accept all" consent volume, deployed env configuration, provider placement, or pageview capture behavior.
- No activation/onboarding PostHog actions were found. Create actions or an activation dashboard only after the final event names are implemented.

## Dependency State Noted During Audit

The local dependency tree is incomplete. These read-only verification attempts failed because package targets were missing behind existing `.bin` symlinks:

```bash
bun --cwd apps/web typecheck
bun --cwd packages/cli typecheck
bun --cwd apps/web test
bun --cwd packages/cli test
```

Before implementation or verification, run:

```bash
bun install --frozen-lockfile
```

Then use each plan's narrower commands first. Do not rely only on root `bun run typecheck` or `bun run test` while iterating, because `turbo.json` makes those tasks depend on upstream builds.

## Cross-Workstream Rules

- Do not add a second onboarding model. One shared activation state should drive web banners, onboarding, CLI copy, and PostHog analytics.
- Keep `npx straude@latest` as the canonical command everywhere unless the CLI workstream intentionally changes it.
- Do not introduce new persistent user-facing terminology for the same concept. Use "sync", "session", and "first session" consistently.
- Prefer server components and route-specific client providers on public pages. Add client islands only for direct interaction.
- Keep the installed PostHog pipeline. Performance work may defer or route-split the PostHog client, but it must preserve consent handling, identity, first-party `/ingest` proxying, and CLI/web event continuity.
- Keep social depth after activation. Leaderboards, profiles, achievements, prompts, and company rankings should remain discoverable, but they should not distract from first sync.
- Every workstream must leave focused tests or a documented measurement artifact.
