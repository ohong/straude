# Workstream 2: Onboarding First Sync

Priority: P1  
Owner: onboarding and activation UX agent  
Estimated size: M  
Depends on: Workstream 1 activation contract

## Goal

Make first session pushed to Straude the center of onboarding.

Users should leave onboarding understanding three things: what Straude syncs, why it is safe, and what they get immediately after running the CLI.

## Current Evidence

- `apps/web/app/(onboarding)/onboarding/page.tsx` calls `handleFinish()` on Step 2 and sends `onboarding_completed: true` before Step 3.
- `apps/web/app/api/users/me/route.ts` sends the welcome email, auto-follow logic, and referral attribution when `onboarding_completed` flips to true.
- `apps/web/app/(onboarding)/onboarding/page.tsx` lets users skip from Step 1 or Step 2 directly to `/feed`.
- Step 3 stores a baseline session count, then only succeeds if a later poll has a larger `session_count`. A user with existing usage before Step 3 can be stuck.
- `apps/web/app/api/usage/status/route.ts` selects all `daily_usage` rows for the current user on every poll.
- `apps/web/app/(app)/layout.tsx` only shows the "Finish setting up your profile" banner when `profile.onboarding_completed` is false, so users who finished profile setup but did not sync can lose the activation nudge.
- PostHog web activation events are not currently confirmed in the project. Onboarding must emit the events defined by Workstream 1 rather than adding local-only tracking names.

## In Scope

- `apps/web/app/(onboarding)/onboarding/page.tsx`
- `apps/web/app/(onboarding)/layout.tsx`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/api/users/me/route.ts`
- `apps/web/app/api/usage/status/route.ts`
- `apps/web/components/providers/PostHogProvider.tsx` or the shared analytics wrapper from Workstream 1
- `apps/web/components/app/*` activation banners or empty states
- Tests covering onboarding state and status polling

## Out of Scope

- CLI collection internals.
- Feed/profile redesign beyond no-data activation nudges.
- New marketing sections on the landing page.

## Implementation Instructions

1. Split "profile saved" from "activated".
   - Do not set `onboarding_completed: true` merely because the user filled profile fields.
   - Treat profile fields as helpful setup, not activation.
   - Send welcome/onboarding side effects only when the activation contract says the user is activated, or rename the server-side side effect to match the earlier lifecycle event.
2. Make the sync step primary.
   - The canonical command is `npx straude@latest`.
   - Show the command in a stable, copyable block.
   - Keep the privacy reassurance visible near the command: no prompts, code, or conversation text are uploaded.
   - Show the expected reward after sync: streak, cost, token totals, and first shareable session.
3. Replace hard skip links with explicit secondary choices.
   - Use a secondary action such as "Explore without syncing" only after the user has seen the sync command.
   - If the user chooses it, keep them in the `signed_up` or `profile_started` state, not `activated`.
   - The authenticated app must continue showing the first-sync nudge.
4. Fix Step 3 success detection.
   - Do not rely only on a session-count baseline captured after the page loads.
   - Accept existing usage for a newly authenticated user when it was submitted recently or belongs to the current user.
   - Prefer a status payload with `has_usage`, `latest_usage_at`, `session_count`, `total_cost`, and `latest_post_url`.
   - If the command is copied during onboarding, use that timestamp only as an enhancement, not as the only success gate.
5. Make `/api/usage/status` cheap.
   - Stop selecting every `daily_usage` row every 4 seconds.
   - Query only the aggregate fields needed by onboarding.
   - Prefer an indexed `count/head` query, a small RPC, or a limited latest-row query plus existing aggregate columns.
   - Preserve the current response shape only if existing callers require it; otherwise add a versioned shape for onboarding.
6. Update authenticated app banners.
   - Show a first-sync banner when the user is authenticated and has no usage, regardless of `onboarding_completed`.
   - Link the banner to onboarding Step 3 or a dedicated first-sync page.
   - Do not show profile-completion copy when the missing action is usage sync.
7. Move optional profile questions later.
   - Keep username and minimal identity early.
   - Move "How did you hear about us?", country, bio, and GitHub URL to post-sync profile enrichment unless they are needed for the activation contract.
8. Emit PostHog funnel events through the shared wrapper.
   - Capture `onboarding_profile_started` when the user begins profile setup.
   - Capture `sync_command_copied` with `surface: "onboarding"` when the command is copied.
   - Capture `first_sync_confirmed` when onboarding observes usage for the user.
   - Capture `activation_completed` only after the success state is shown.
   - Include `activation_state`, `session_count`, and `has_existing_usage` where applicable.
   - Do not emit browser PostHog events without analytics consent; use the consent-safe server path from Workstream 1 if full-funnel coverage is required.

## Verification Commands

```bash
bun --cwd apps/web test -- __tests__/flows
bun --cwd apps/web test -- app/api/usage/status
bun --cwd apps/web test:e2e -- e2e/signup-to-first-session.spec.ts
bun --cwd apps/web typecheck
```

Also manually verify with local Supabase:

```bash
bun run supabase:start
bun --cwd apps/web dev
```

Then complete signup, leave before sync, return to `/feed`, and confirm the first-sync nudge is still visible.

PostHog check after deploying onboarding changes:

```sql
SELECT event, count() AS count, max(timestamp) AS last_seen
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
  AND event IN (
    'onboarding_profile_started',
    'sync_command_copied',
    'first_sync_confirmed',
    'activation_completed'
  )
GROUP BY event
ORDER BY event
LIMIT 100
```

## Done Criteria

- A user is not counted as activated until first usage is observed or they explicitly choose a clearly labeled non-activated path.
- First-sync command copy is available in onboarding and no-data app states.
- Step 3 succeeds for both newly submitted usage and already-present usage.
- `/api/usage/status` returns in a bounded query shape and does not scan all user usage rows per poll.
- Welcome email and auto-follow side effects align with the new activation lifecycle.
- PostHog captures the onboarding funnel events for consented web sessions or through the approved consent-safe fallback.

## Stop Conditions

- Stop if the existing `users.onboarding_completed` field is used by production workflows that cannot distinguish profile completion from activation.
- Stop if the efficient usage-status query requires a missing index; create a migration plan rather than shipping an unindexed polling path.
- Stop if the no-data authenticated shell cannot derive usage state without adding a slow query to every route.
