# Frontend Ship-Readiness Audit

Generated: 16-03-2026 12:04

## Scope
- Requested scope: Entire app.
- Assumed reviewable unit: The full `apps/web` Next.js frontend, including public marketing/shareable routes, auth and onboarding, authenticated product flows, public profile/share surfaces, and the admin route.
- In scope: Route entry points and layouts under `apps/web/app`, shared app and landing components, frontend-facing Supabase/auth/theme/helpers, key API routes that define frontend boundaries, and representative automated tests covering public flows and core interactions.
- Important dependencies: Supabase auth/database/storage, Vercel Analytics, Anthropic caption generation, Next.js metadata/OG generation, local route middleware, CLI verification/auth flows, privacy settings, and follower-based visibility rules.
- Explicitly out of scope: Background cron jobs, email template rendering/content quality, Supabase schema/RLS policy definitions not directly visible in the frontend repo slice, generated `.next` output, and vendored dependencies.

## Deployment Context
- Established context: Production app with real users; public web plus authenticated app flows and CLI integration; modern desktop/mobile browsers; SEO matters on public/shareable surfaces; localization is out of scope; accessibility should follow solid modern practices even without a formal compliance target.
- Missing context that affects the bar: None that materially changes the release decision.
- Assumptions used for this audit: The repo privacy policy reflects intended product behavior for private profiles; authenticated-only product routes should redirect guests instead of showing broken or misleading states.

## Repository Coverage
- Files and docs read completely: Root guidance and README; package manifests; app root layout; all route entry/layout/loading files under `apps/web/app`; middleware/proxy/auth/theme providers; major app components for feed, profile, comments, post editing, notifications, messages, recap, landing, and shared nav; core frontend utils/types; key API routes for feed, profile, search, follows, recap, notifications, messages, posts, comments, upload, prompts, usage submission, and AI captioning; representative Playwright, flow, API, and component tests.
- Areas intentionally skipped as irrelevant: Generated `.next` assets, `node_modules`, most email templates, cron routes, and lower-risk static/design-only assets that do not materially change frontend ship readiness.

## Summary
- Verdict: Not ready
- Highest-risk themes: Privacy boundaries are inconsistent across search and private-profile experiences; authenticated-only routes are not consistently gated; one user-facing notification filter advertises behavior the backend cannot serve.
- What would need to change before shipping, if not ready: Remove the private-user email lookup leak, align private-profile behavior with the documented follower visibility model, and enforce or gracefully handle auth on personal-only routes like notifications and recap.

## Findings

### F-001: Exact-email search leaks private accounts
- Priority: P1
- Why it matters: Private mode becomes meaningfully weaker if any signed-in user can confirm whether a specific email belongs to an account and immediately retrieve that user’s public profile fields.
- Evidence: [`apps/web/app/api/search/route.ts`](apps/web/app/api/search/route.ts) first limits normal search to `is_public = true`, then falls back to a service-role `lookup_user_id_by_email` and fetches the matched user without re-applying the public filter at lines 45-62.
- Affected area: User discovery, privacy controls, authenticated search.
- Risk if shipped as-is: Logged-in users can enumerate private accounts by email address, which creates a real privacy and harassment/phishing vector for a production social product.
- Recommended fix: Remove email-based people search for non-admin users, or re-scope it so it only returns the current user / explicitly public accounts. Do not use a service-role fallback that bypasses the public-profile filter for general search.
- Confidence: High

### F-002: Private-profile follower visibility is broken relative to the product contract
- Priority: P1
- Why it matters: The product explicitly promises that followers can still see activity from private profiles, but the main private-profile surfaces deny that experience even when follower access is supposed to be allowed.
- Evidence: [`apps/web/app/(landing)/privacy/page.tsx`](apps/web/app/(landing)/privacy/page.tsx) says private profiles still allow followers to see activity at lines 63-68. [`apps/web/app/api/users/[username]/contributions/route.ts`](apps/web/app/api/users/[username]/contributions/route.ts) implements that owner-or-follower rule at lines 25-40. But [`apps/web/app/(app)/u/[username]/page.tsx`](apps/web/app/(app)/u/[username]/page.tsx) treats every non-owner private profile as fully blocked at lines 45-79, and [`apps/web/app/(app)/u/[username]/follows/page.tsx`](apps/web/app/(app)/u/[username]/follows/page.tsx) 404s the follows page for everyone except the owner at lines 43-45.
- Affected area: Private profiles, follower experience, privacy settings, profile navigation.
- Risk if shipped as-is: Users who switch to private mode get a product that contradicts the published privacy contract, blocks follower access to expected profile surfaces, and creates confusing “private but follow to see activity” dead ends.
- Recommended fix: Centralize the private-profile access rule as owner-or-approved-follower, then apply it consistently across the profile page, follows page, and any related profile subroutes. Render the actual follower state in the private-profile CTA instead of always assuming the viewer is not following.
- Confidence: High

### F-003: Personal-only routes are not consistently protected for guests
- Priority: P2
- Why it matters: Guests can navigate to private, user-specific surfaces and get broken or misleading experiences instead of a clean auth redirect, which is a release-quality problem on a production app.
- Evidence: [`apps/web/lib/supabase/middleware.ts`](apps/web/lib/supabase/middleware.ts) protects only `/settings`, `/post/new`, `/search`, `/prompts`, `/messages`, and `/admin` at lines 78-88, leaving `/notifications` and `/recap` public. [`apps/web/app/(app)/notifications/page.tsx`](apps/web/app/(app)/notifications/page.tsx) renders the notifications surface without any server-side auth check, while [`apps/web/components/app/notifications/NotificationsList.tsx`](apps/web/components/app/notifications/NotificationsList.tsx) quietly turns a 401 fetch into an empty state at lines 44-48. [`apps/web/app/(app)/recap/page.tsx`](apps/web/app/(app)/recap/page.tsx) fetches `/api/recap` without checking `res.ok` at lines 22-27, even though [`apps/web/app/api/recap/route.ts`](apps/web/app/api/recap/route.ts) returns 401 for guests at lines 11-13.
- Affected area: Auth boundaries, guest navigation, notifications, personal recap.
- Risk if shipped as-is: Unauthenticated visitors can hit personal routes that either look empty when they should be protected or try to render unauthorized payloads, producing avoidable confusion and fragile client behavior.
- Recommended fix: Add `/notifications` and `/recap` to the protected-route set or redirect from those pages server-side. Also make the client fetch paths handle non-OK responses explicitly so auth failures never masquerade as empty content or invalid data.
- Confidence: High

### F-004: The Notifications UI advertises a Messages filter the API cannot serve
- Priority: P3
- Why it matters: Users are offered a filter that appears to target message notifications, but selecting it can never produce the promised result because the backend drops that type entirely.
- Evidence: [`apps/web/components/app/notifications/NotificationsList.tsx`](apps/web/components/app/notifications/NotificationsList.tsx) exposes a `Messages` tab at lines 10-18 and sends the selected `type` to `/api/notifications` at lines 38-45. [`apps/web/app/api/notifications/route.ts`](apps/web/app/api/notifications/route.ts) omits `"message"` from `VALID_TYPES` at line 4 and explicitly excludes `type = "message"` from the query at lines 22-27.
- Affected area: Notifications filtering, messaging discoverability.
- Risk if shipped as-is: The filter is misleading and undermines trust in the notifications center, especially for users trying to find recent DMs from the same screen.
- Recommended fix: Either support `message` as a real filter in the notifications API or remove the `Messages` tab from the notifications UI and keep message activity scoped to the inbox/header unread badge.
- Confidence: High

## Positive evidence
- Public routes have strong metadata coverage for SEO/share surfaces, including canonical/open graph/twitter metadata on landing, feed, leaderboard, and recap/profile share routes.
- The app applies a meaningful baseline security header set in [`apps/web/next.config.ts`](apps/web/next.config.ts), including CSP, HSTS, frame-ancestor restrictions, and related browser hardening.
- Shared theming has explicit bootstrap logic plus tests, reducing hydration/theme-flash risk across public and authenticated surfaces.
- Automated coverage is broad for the frontend surface: `bun --cwd apps/web test` ran 460 tests, with 447 passing. The only failures were 13 `usage-submit` tests blocked by missing local Supabase env, not by the reviewed frontend flows themselves.
- `bun --cwd apps/web typecheck` completed successfully.

## Open questions
- None that materially change the release decision.

## Release recommendation
Do not ship the current frontend as-is. The app is close in several areas, but the privacy model is not coherent enough for a production social product yet: exact-email search can expose private accounts, private-profile behavior contradicts the documented follower visibility contract, and some personal routes still leak guests into broken or misleading states. Fixing those issues would materially improve release safety; the message-filter mismatch should follow immediately after if it is not folded into the same pass.
