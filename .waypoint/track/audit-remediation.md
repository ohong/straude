---
summary: Execution tracker for remediating the 2026-03-16 backend and frontend audit findings
last_updated: "2026-03-16 12:28 PDT"
status: active
read_when:
  - resuming the audit remediation workstream
---

# Audit Remediation Tracker

## Goal

Bring the current `main` branch from “not ready” to a materially safer ship state by implementing the high-priority backend/frontend audit fixes and carrying them through verification, docs, and PR follow-up.

## Source

- User request on 2026-03-16 to implement all fixes from:
  - `.waypoint/audit/16-03-2026-12-03-backend-audit.md`
  - `.waypoint/audit/16-03-2026-12-04-frontend-audit.md`
- Durable plan: [`.waypoint/docs/audit-remediation-plan.md`](/Users/mark/clawd/projects/straude/.waypoint/docs/audit-remediation-plan.md)

## Current State

- [2026-03-16 12:13 PDT] Planning is complete. The work has been split into privacy/access fixes, auth-boundary/UI fixes, media and DM-attachment hardening, unsubscribe correctness, and doc cleanup around rate-limit claims.
- [2026-03-16 12:13 PDT] The current `.gitignore` change ignores most `.waypoint` durable state, so the PR needs to preserve the intended ignore behavior for generated/local state while allowing the repo-memory files required by this work.
- [2026-03-16 12:28 PDT] The code changes are implemented and build/test verification is green for the targeted privacy, storage, unsubscribe, and profile-access surfaces.

## Next

- [2026-03-16 12:28 PDT] Stage the final repo-memory files, create the remediation branch, open the PR, and watch the initial review/CI loop.

## Workstreams

### 1. Privacy and access

- [x] Remove private-account email search
- [x] Align private-profile page access with owner-or-follower behavior
- [x] Align private-profile follows page with owner-or-follower behavior
- [x] Add regression coverage for the new privacy rules

### 2. Auth boundaries and notifications UX

- [x] Protect `/notifications`
- [x] Protect `/recap`
- [x] Make recap/notifications handle auth failures explicitly
- [x] Remove the unsupported notifications `Messages` tab

### 3. Media and DM attachment hardening

- [x] Add first-party storage URL validation helpers
- [x] Reject arbitrary external post image URLs
- [x] Reject arbitrary external DM attachment URLs
- [x] Convert DM attachments to private signed URL reads
- [x] Tighten Next image remote host policy
- [x] Align migration + local seed bucket privacy

### 4. Unsubscribe and docs truthfulness

- [x] Add one-click unsubscribe POST support
- [x] Surface unsubscribe update failures correctly
- [x] Downgrade rate-limit docs to match in-process reality if no shared limiter is added

### 5. Verification and delivery

- [x] Run focused web type/tests
- [x] Update workspace/docs/indexes as needed
- [ ] Commit the remediation branch
- [ ] Open a PR
- [ ] Monitor PR review/CI state and respond

## Verification

- [x] `bun run typecheck` in `apps/web`
- [x] `bun run test -- __tests__/api/search.test.ts __tests__/api/profile.test.ts __tests__/api/contributions.test.ts __tests__/api/messages.test.ts __tests__/api/upload.test.ts __tests__/api/posts.test.ts __tests__/api/unsubscribe.test.ts __tests__/flows/privacy-visibility.test.ts __tests__/flows/profile-and-contributions.test.ts` in `apps/web`
- [x] `NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_placeholder SUPABASE_SECRET_KEY=sb_secret_placeholder bun run build` in `apps/web`
- [ ] Manual auth/privacy/DM attachment spot checks if local env permits

## Decisions

- [2026-03-16 12:13 PDT] Exact-email search will be removed instead of preserved behind a privileged fallback.
- [2026-03-16 12:13 PDT] DM attachments will move to a private signed-URL model so storage privacy matches the product’s DM privacy expectations.
- [2026-03-16 12:13 PDT] Rate-limit work will be handled honestly; docs will stop overstating the current implementation even if a shared limiter is not introduced in this pass.

## Notes

- The backend and frontend audits overlap heavily on privacy behavior, so some fixes intentionally close findings in both reports at once.
