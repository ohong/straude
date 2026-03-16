---
summary: Plan to remediate the 2026-03-16 backend and frontend ship-readiness audit findings
last_updated: "2026-03-16 12:13 PDT"
read_when:
  - implementing the 2026-03-16 audit fixes
  - remediating privacy, auth-boundary, storage, and unsubscribe issues
  - resuming the audit remediation workstream
---

# Audit Remediation Plan

## Current State

Two new ship-readiness audits on 2026-03-16 found overlapping product and backend risks that all sit on the current `main` branch:

- `GET /api/search` still has a service-role exact-email lookup path that can return private accounts.
- Private-profile behavior is inconsistent: contribution data already allows owner-or-follower access, but the main profile page and follows page still block followers entirely.
- Auth gating is inconsistent for personal-only routes. `/notifications` and `/recap` are not protected at the middleware/page boundary, and the clients do not treat `401` as an auth state.
- The notifications UI still advertises a `Messages` filter even though the API excludes `message` notifications entirely.
- Stored media is too permissive. Post image URLs accept arbitrary strings, DM attachments persist arbitrary URLs, and `next/image` is configured to proxy any HTTPS host.
- DM attachment privacy is inconsistent between migrations and local seed behavior. Production SQL currently creates a public bucket, while local setup creates a private bucket.
- Unsubscribe emails advertise one-click POST semantics, but the route only supports GET and ignores update failures.
- Rate limiting is still process-local. This is a real limitation in production, but replacing it with a shared limiter is broader than the privacy/storage fixes and will need a scoped product decision if it is not already wired into the deployment stack.

## Proposed Changes

### 1. Privacy and access rules

Touch:

- `apps/web/app/api/search/route.ts`
- `apps/web/app/(app)/u/[username]/page.tsx`
- `apps/web/app/(app)/u/[username]/follows/page.tsx`
- new shared helper under `apps/web/lib/**` if it reduces duplicated private-profile access logic cleanly
- tests covering search and private-profile access behavior

Changes:

- Remove the email-based service-role fallback from public search so search only returns records that already satisfy the public-profile query.
- Centralize the private-profile access rule as:
  - public profile: visible to everyone
  - private profile owner: visible to self
  - private profile follower: visible to approved follower
  - everyone else: blocked
- Use that rule in the main profile page and follows page so follower access matches the documented privacy contract.
- Ensure the private-profile CTA uses the actual follow relationship when a logged-in viewer is blocked, instead of always pretending they do not follow.

Acceptance criteria:

- Searching by exact email never returns a private user.
- Followers can load a private user’s main profile page and follows page.
- Non-followers still see the private-profile blocked state.

### 2. Personal-route auth boundaries and notifications UX

Touch:

- `apps/web/lib/supabase/middleware.ts`
- `apps/web/app/(app)/notifications/page.tsx`
- `apps/web/components/app/notifications/NotificationsList.tsx`
- `apps/web/app/(app)/recap/page.tsx`
- `apps/web/app/api/notifications/route.ts`

Changes:

- Protect `/notifications` and `/recap` at the same boundary as the other personal routes.
- Add server-side redirects on those pages so auth is enforced even if middleware coverage changes later.
- Make client fetch code treat non-OK responses explicitly instead of turning unauthorized states into fake empty/success states.
- Remove the `Messages` filter from the notifications UI so the frontend matches the API’s actual contract.

Acceptance criteria:

- Guests are redirected to `/login` for notifications and recap.
- Notifications never show a misleading empty state for unauthorized users.
- Recap never tries to render unauthorized JSON as recap data.
- The notifications filter list only contains types the API actually serves.

### 3. Media origin hardening and private DM attachments

Touch:

- `apps/web/next.config.ts`
- `apps/web/app/api/upload/route.ts`
- `apps/web/app/api/posts/[id]/route.ts`
- `apps/web/app/api/messages/route.ts`
- `apps/web/components/app/messages/MessagesInbox.tsx`
- `apps/web/types/index.ts`
- `supabase/migrations/*.sql` for the DM attachment bucket correction
- `supabase/seed.sql`
- tests covering upload, posts, and messages

Changes:

- Introduce a shared storage-origin validator for first-party Supabase storage URLs and/or stored object keys.
- Reject post image updates unless every image points at the approved first-party `post-images` bucket for the current deployment.
- Change DM attachments to a private model:
  - keep the bucket private in both migrations and seed
  - stop returning public URLs from upload
  - persist enough storage metadata to later mint signed URLs
  - convert message reads into signed attachment URLs for authorized viewers
- Tighten `next/image` remote patterns to the approved storage host(s) instead of wildcard HTTPS.
- Keep file download and image preview behavior working in the inbox by using signed URLs returned from the message API.

Acceptance criteria:

- Arbitrary external media URLs cannot be stored through post editing or DM sending.
- DM attachments remain viewable for conversation participants but are no longer publicly readable by URL.
- `next/image` no longer proxies arbitrary HTTPS origins.

### 4. Unsubscribe correctness

Touch:

- `apps/web/app/api/unsubscribe/route.ts`
- email sender tests if present, plus route tests if absent
- any docs that claim one-click unsubscribe support

Changes:

- Add a `POST` handler that supports one-click unsubscribe requests using the same signed token contract as `GET`.
- Check the Supabase update result before returning success.
- Return an error response when the preference write fails instead of always rendering a success page.

Acceptance criteria:

- Both GET and POST unsubscribe requests work.
- A failed update does not render a false success state.

### 5. Rate-limit scope handling

Touch:

- `docs/API.md`
- audit/tracker/workspace notes

Changes:

- Do not silently pretend the in-memory limiter is production-grade.
- If a shared limiter is not already available in this repo, explicitly downgrade the docs language to “best-effort in-process throttling” for this release instead of leaving the docs stronger than reality.

Acceptance criteria:

- The repo no longer claims the current limiter is stronger than it is.

## Decisions And Tradeoffs

- Exact-email search will be removed instead of preserved behind a compatibility layer. This is the safest change and matches the project guidance that backward compatibility is not a hard requirement when it conflicts with cleaner behavior.
- DM attachments will move to a private signed-URL model rather than staying public. DMs are a private feature, and the product context treats privacy mistakes as release blockers.
- The rate-limit finding will be handled honestly but pragmatically. A true distributed limiter is worthwhile, but it is a separate infrastructure slice from the audit’s immediate privacy/security fixes. If there is no existing shared primitive in-repo, this pass should not invent a half-integrated external dependency just to check the box.

## Verification

- `bun --cwd apps/web run typecheck`
- `bun --cwd apps/web run test -- __tests__/api/search.test.ts __tests__/api/contributions.test.ts __tests__/api/messages.test.ts __tests__/api/upload.test.ts __tests__/api/posts.test.ts`
- Add or extend focused tests for:
  - private email search returning no private users
  - follower access to private profile surfaces
  - notifications/recap auth handling where executable tests fit cleanly
  - upload/post/message validation of first-party storage URLs
  - DM signed URL issuance on message reads
  - unsubscribe GET and POST success/failure behavior
- Manual spot-check in the app for:
  - guest redirect on `/notifications` and `/recap`
  - follower vs non-follower behavior on a private profile
  - DM image/file attachment rendering after the signed-URL change

## Non-Goals

- Replacing the in-memory limiter with a brand-new shared infrastructure dependency unless the repo already contains the needed primitive.
- Broad redesign of the notifications center or recap product.
- Reworking unrelated Supabase/storage behavior outside the audited risks.

## TL;DR

This pass removes the private-account search leak, aligns private-profile access with the documented follower model, enforces auth on personal routes, tightens the notifications UI to match the backend, converts DM attachments to private signed access, blocks arbitrary external media persistence, repairs the unsubscribe contract, and truthfully documents the current rate-limit scope.
