# Workstream 7: Final Integration Pass

Priority: P1  
Owner: integration lead  
Estimated size: S-M  
Depends on: Workstreams 1-6

## Goal

Combine the workstreams into one coherent product experience.

The final result should feel like one fast activation loop across landing, signup, onboarding, app, and CLI.

## Integration Result

Merged onto `codex/activation-integration-pass` in this order:

1. `codex/onboarding-first-sync`
2. `codex/public-landing-performance`
3. `codex/authenticated-shell-performance`
4. `codex/core-app-activation-ux`
5. `codex/cli-first-run-snappiness`

Review the stack sequentially:

- PR #133: activation analytics contract.
- PR #134: onboarding completion gated on first sync confirmed in web.
- PR #135: public landing and `/open` performance.
- PR #136: authenticated shell provider, modal, notification, and sidebar deferral.
- PR #137: CLI first-run snappiness and 30-day backfill path.
- PR #138: empty-state activation guidance and guest conversion CTAs.

The activation definition is `activation_completed` after the web app confirms synced usage. Optional profile setup is no longer activation.

## PostHog Admin Follow-Up

Server-side and client-side capture are implemented, but PostHog project admin updates were not applied from this checkout. Tool discovery did not expose a PostHog MCP/tool, `posthog` is not installed on PATH, and the local env only exposes `NEXT_PUBLIC_POSTHOG_KEY` plus `NEXT_PUBLIC_POSTHOG_HOST`, not a project API key.

Create or update these PostHog actions after deploying the taxonomy:

- Visitor CTA: `landing_primary_cta_clicked`
- Signup started: `signup_started`
- Signup completed: `signup_completed`
- Profile started: `onboarding_profile_started`
- Command copied: `sync_command_copied`
- CLI login completed: `login_completed`
- Usage push succeeded: `usage_pushed`
- Usage push failed: `usage_push_failed`
- First sync confirmed in web: `first_sync_confirmed`
- Activated: `activation_completed`

Create an activation funnel dashboard with these ordered steps:

1. `$pageview` on `/`
2. `landing_primary_cta_clicked`
3. `signup_completed`
4. `sync_command_copied`
5. `login_completed`
6. `usage_pushed`
7. `first_sync_confirmed`
8. `activation_completed`

Create a CLI health dashboard for `usage_pushed`, `usage_push_failed`, p50 and p95 push timing, p50 and p95 ccusage timing, pricing mode, requested day count, submitted day count, and backfill completion.

## Integration Verification

Passed on `codex/activation-integration-pass`:

```bash
bun --cwd apps/web typecheck
bun --cwd packages/cli typecheck
bun --cwd apps/web test -- __tests__/flows/activation-contract.test.ts __tests__/api/activation-analytics.test.ts __tests__/api/usage-status.test.ts __tests__/api/profile.test.ts __tests__/api/usage-submit.test.ts __tests__/components/FeedList.test.tsx __tests__/components/ActivityCard.test.tsx __tests__/components/CommandPalette.test.tsx __tests__/components/SubmitPromptWidget.test.tsx __tests__/lib/open-stats.test.ts
bun --cwd packages/cli test -- __tests__/ccusage.test.ts __tests__/commands/push.test.ts __tests__/flows/cli-sync-flow.test.ts __tests__/resolve-push-date-range.test.ts __tests__/commands/login.test.ts
bun --cwd apps/web build
bun --cwd packages/cli build
bun --cwd apps/web test:e2e -- e2e/golden-path/landing-to-signup.spec.ts
```

Results: 91 focused web tests passed, 51 focused CLI tests passed, production web build passed, CLI build passed, and 10 golden-path landing-to-signup Playwright tests passed.

## In Scope

- Cross-workstream copy consistency.
- Activation-state consistency.
- PostHog event, action, and dashboard consistency.
- Bundle and network regression review.
- End-to-end activation testing.
- Release notes and rollout checks.

## Out of Scope

- New feature work not required by Workstreams 1-6.
- Broad refactors outside touched surfaces.

## Integration Instructions

1. Reconcile state naming.
   - Confirm every surface uses the same activation contract from Workstream 1.
   - Remove local synonyms that reintroduce ambiguity, such as using `onboarding_completed` when the code means `activated`.
2. Reconcile copy.
   - Canonical command is `npx straude@latest`.
   - Use "sync" for CLI data upload.
   - Use "session" for a logged coding session.
   - Use "first session" for activation.
3. Verify no-data paths.
   - Signed-in user with no usage sees first-sync guidance in onboarding and authenticated app.
   - User who skips sync can still find the command quickly.
   - User with usage no longer sees first-sync nudges.
4. Verify public paths.
   - Landing page loads without app-only providers.
   - Guest feed and public profile remain browseable.
   - Guest conversion CTAs do not block public reading.
5. Verify CLI and web agree.
   - CLI success destination opens or points to a route that exists.
   - Web onboarding detects usage submitted by the CLI.
   - CLI telemetry and web analytics use compatible PostHog event names.
6. Verify PostHog end to end.
   - Confirm deployed web has `NEXT_PUBLIC_POSTHOG_KEY`.
   - Confirm consented web sessions send `$pageview` through `/ingest`.
   - Confirm landing, signup, onboarding, CLI login, usage push, first-sync confirmation, and activation completion events appear in the PostHog project.
   - Create or update PostHog actions for the final funnel events after the taxonomy is populated.
   - Create or update an activation funnel dashboard that tracks visitor to signup, signup to command copy, command copy to CLI login, CLI login to `usage_pushed`, and `usage_pushed` to `activation_completed`.
   - Create or update a CLI health dashboard for `usage_pushed`, `usage_push_failed`, p50/p95 timing properties, pricing mode, and backfill mode.
7. Verify performance.
   - Compare current route-bundle stats to the pre-work stale baseline and the first fresh baseline captured by Workstream 3.
   - Confirm `/`, `/signup`, `/onboarding`, `/feed`, and `/u/[username]` do not regress.
   - Confirm authenticated shell no longer fetches full notifications, command palette, or desktop sidebar data before needed.
8. Prepare rollout notes.
   - Mention activation-state behavior changes.
   - Mention any analytics event renames.
   - Mention any CLI first-run/backfill behavior changes.
   - Include any manual Supabase migration or cron steps.

## Full Verification Commands

Run from the repo root after dependencies are restored:

```bash
bun install --frozen-lockfile
bun --cwd apps/web typecheck
bun --cwd packages/cli typecheck
bun --cwd apps/web test
bun --cwd packages/cli test
bun --cwd apps/web build
bun --cwd packages/cli build
bun --cwd apps/web test:e2e
```

If the full E2E suite requires services:

```bash
bun run supabase:start
bun --cwd apps/web dev
```

Then rerun the focused activation spec:

```bash
bun --cwd apps/web test:e2e -- e2e/signup-to-first-session.spec.ts
```

PostHog verification query:

```sql
SELECT event, count() AS count, max(timestamp) AS last_seen
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
  AND event IN (
    '$pageview',
    'landing_primary_cta_clicked',
    'signup_started',
    'signup_completed',
    'onboarding_profile_started',
    'sync_command_copied',
    'cli_first_run',
    'cli_authenticated',
    'login_completed',
    'usage_pushed',
    'usage_push_failed',
    'first_sync_confirmed',
    'activation_completed'
  )
GROUP BY event
ORDER BY event
LIMIT 100
```

## Manual Acceptance Checklist

- New visitor lands on `/`, understands the loop, and can choose signup or copy command.
- New user signs up and sees first-sync command without optional profile questions getting in the way.
- New user runs CLI and sees immediate success.
- Web detects first sync and shows a rewarding success state.
- User can reach profile/feed and see the first session.
- Returning signed-in user with no usage still sees first-sync guidance.
- Returning signed-in user with usage sees normal app surfaces with no activation clutter.
- Public guest can browse before signing up.
- Mobile app navigation remains understandable.
- PostHog captures the funnel events for consented web users and CLI users.

## Done Criteria

- All focused workstream tests pass.
- Full web and CLI typecheck pass.
- Full web and CLI test suites pass or documented unrelated failures are approved by the integration lead.
- Production build passes.
- Bundle/network measurements are attached to the final PR.
- Product copy is consistent across landing, onboarding, app, and CLI.
- PostHog funnel and CLI health dashboards are updated or explicitly deferred with a reason.

## Stop Conditions

- Stop if two workstreams encode conflicting activation rules.
- Stop if performance wins rely on removing a critical feature rather than deferring it.
- Stop if any route loses unauthenticated/public access behavior unintentionally.
- Stop if PostHog web capture remains stale after deployment and no consent-safe fallback is proposed.
