---
summary: Execution tracker for the shareable asset system spanning profile consistency cards, post session cards, and CLI share handoffs
last_updated: "2026-03-16 11:45 PDT"
status: active
read_when:
  - resuming the shareable asset workstream
---

# Shareable Asset System Tracker

## Goal

Ship a multi-surface share system that makes Straude feel natively brag-worthy: a consistency card for profile-level sharing, a session card for post-level sharing, and CLI success output that hands users a shareable URL immediately.

## Source

- User request on 2026-03-14 to build a tweetable, Strava-like shareable asset without copying the supplied screenshot directly
- Durable plan: [`.waypoint/docs/shareable-asset-system-plan.md`](/Users/mark/clawd/projects/straude/.waypoint/docs/shareable-asset-system-plan.md)

## Current State

- [2026-03-14 14:12 PDT] Planning pass completed. Existing recap, profile contribution graph, post share image flow, and CLI push output have been inspected.
- [2026-03-14 14:12 PDT] Recommended direction is a two-card family: profile-level Consistency Card plus post-level Session Card.
- [2026-03-14 14:31 PDT] Shared asset foundation is implemented: heatmap helpers, profile-card data/image utilities, and session-card image rendering are in place.
- [2026-03-14 14:31 PDT] Public consistency route, profile/post inline share panels, post OG image route, and CLI share handoff are implemented.
- [2026-03-14 14:31 PDT] Manual QA was completed through `/og-image/share-assets` because the local machine does not have Supabase env loaded for live data routes.
- [2026-03-16 11:45 PDT] PR #50 now carries the latest local-Supabase follow-up fixes from PR #47, including CI placeholder env coverage and the production-safe browser env lookup used by `/cli/verify`.

## Next

- [2026-03-16 11:45 PDT] Wait for PR #50 reviewer response now that the branch includes the full local-dev fix chain needed for green CI.
- [2026-03-14 14:31 PDT] If another pass is needed, verify the live profile and post routes against a real Supabase-backed local env, not only the preview harness.
- [2026-03-14 14:31 PDT] Decide whether the feed-level `ShareMenu` should be simplified further now that the permalink page carries the full share experience.

## Workstreams

### 1. Asset Foundation

- [x] Create shared heatmap scale and legend helpers
- [x] Create profile-card data utility
- [ ] Create post-card data utility
- [x] Create Satori-safe profile card image component
- [x] Create Satori-safe post card image component

### 2. Profile Consistency Sharing

- [x] Add public consistency share route
- [x] Add profile consistency image endpoint
- [x] Add profile share panel under contributions
- [x] Respect public/private shareability rules

### 3. Post Session Sharing

- [x] Redesign post share image route around the session card
- [x] Add post detail share panel with visible URL + preview
- [x] Update post OG metadata to match the session card
- [ ] Reduce feed share menu to quick actions / permalink handoff

### 4. CLI Share Handoff

- [x] Print post permalink(s) clearly after push success
- [x] Print profile consistency-card URL after push success
- [x] Keep multi-day output readable

### 5. Verification And Docs

- [x] Add / update API tests
- [x] Add / update CLI tests
- [x] Manually verify copy/download/public-preview flows
- [x] Update changelog / docs if shipped behavior changes

## Verification

- [2026-03-14 14:31 PDT] `bun run typecheck` in `apps/web`
- [2026-03-14 14:31 PDT] `bun run test -- __tests__/api/post-share-image.test.ts __tests__/api/consistency-image.test.ts __tests__/unit/share-image-satori.test.tsx __tests__/unit/profile-card-image-satori.test.tsx` in `apps/web`
- [2026-03-14 14:31 PDT] `bun run test -- __tests__/commands/push.test.ts` in `packages/cli`
- [2026-03-14 14:31 PDT] Manual browser QA on `/og-image/share-assets`: visually verified both card designs; confirmed both share panels copy their URLs; confirmed both download actions complete successfully against same-origin preview assets.
- [2026-03-16 11:45 PDT] Re-verified the shareable branch after merging later local-dev fixes: `bun run test -- __tests__/api/usage-submit.test.ts __tests__/flows/web-import-flow.test.ts` in `apps/web`; `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_placeholder SUPABASE_SECRET_KEY=sb_secret_placeholder bun run build` from repo root; manual `next start` smoke test for `/cli/verify?code=TEST1234` confirmed the page renders in production mode instead of crashing.

## Decisions

- [2026-03-14 14:12 PDT] Use two purpose-built cards instead of mutating recap into every share use case.
- [2026-03-14 14:12 PDT] Use a dedicated public route for the profile consistency card, but keep the post permalink as the canonical post share URL.
- [2026-03-14 14:12 PDT] Use a warm Straude/Claude palette and a heatmap-first layout rather than copying the blue screenshot.

## Notes

- The existing recap system remains in scope only as a reusable reference and possible helper consumer, not as the center of this feature.
- The CLI already stores `username`, so no additional auth flow is needed to construct a profile-level share URL.
- The preview harness exists because local manual QA would otherwise be blocked by missing Supabase env in this workspace.
- Stacked PRs in this repo need explicit sync. Later fixes on `local-supabase-dev` did not automatically reach `shareable-asset`; they had to be merged forward before PR #50 could go green.
