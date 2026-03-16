# Workspace

Timestamp discipline: Prefix new or materially revised bullets in `Active Trackers`, `Current State`, `In Progress`, `Next`, `Parked`, and `Done Recently` with `[YYYY-MM-DD HH:MM TZ]`.

## Active Goal

- [2026-03-16 12:13 PDT] Implement the 2026-03-16 backend/frontend audit fixes end to end, including verification, repo-memory updates, PR creation, and review follow-through.
- [2026-03-14 14:12 PDT] Plan and prepare implementation for a multi-surface shareable asset system centered on a profile consistency card and a post session card.

## Active Trackers

- [2026-03-16 12:13 PDT] [`.waypoint/track/audit-remediation.md`](/Users/mark/clawd/projects/straude/.waypoint/track/audit-remediation.md) — Active execution tracker for the privacy, auth-boundary, storage, unsubscribe, and docs fixes from the 2026-03-16 audits.
- [2026-03-14 14:12 PDT] [`.waypoint/track/shareable-asset-system.md`](/Users/mark/clawd/projects/straude/.waypoint/track/shareable-asset-system.md) — Planning complete; next step is building the shared share-asset foundation and public consistency route.

## Current State

- [2026-03-16 12:28 PDT] The audit-remediation slice is implemented: private-account email search is gone, private-profile access now follows the owner-or-follower rule across APIs/pages, personal routes `/notifications` and `/recap` redirect guests cleanly, DM attachments now use private signed reads, post images are restricted to first-party storage URLs, and unsubscribe now supports one-click POST plus truthful failure handling.
- [2026-03-16 12:13 PDT] The 2026-03-16 backend/frontend audits both conclude the current `main` branch is not ready because of overlapping privacy/auth issues plus media-storage and unsubscribe correctness gaps; the remediation plan is now captured in `.waypoint/docs/audit-remediation-plan.md`.
- [2026-03-14 14:12 PDT] The repo already has three adjacent sharing surfaces: recap cards, a profile contribution graph, and post share images, but they are not unified into one strong viral sharing system.
- [2026-03-14 14:12 PDT] The CLI already receives `post_url` after sync and already stores the authenticated username locally, which is enough to print both post and profile share URLs without changing login.
- [2026-03-14 14:31 PDT] The new consistency-card route, inline share panels, post session-card redesign, and CLI share handoff are implemented and type/test-verified.
- [2026-03-16 11:45 PDT] PR #47 (`local-supabase-dev`) and PR #50 (`shareable-asset`) both required repeated CI follow-up because the dependent shareable branch did not automatically inherit later local-dev fixes, and because the CI workflow needed placeholder Supabase env values in `Build`, `Test (web)`, and `E2E tests`.
- [2026-03-16 11:45 PDT] The browser Supabase env helper now validates captured `NEXT_PUBLIC_*` values instead of runtime `process.env` on the client, which prevents production-bundle crashes on `/cli/verify` under `next start`.

## In Progress

- [2026-03-16 12:28 PDT] Packaging the verified remediation branch for review: refreshing indexes, staging the intended `.waypoint` memory files, and preparing the PR/review loop.
- [2026-03-16 12:13 PDT] Implementing the audit remediation slice across search, private-profile access, notifications/recap auth gating, media origin validation, DM attachment privacy, unsubscribe handling, and related tests/docs.
- [2026-03-16 11:45 PDT] Waiting on GitHub review state to catch up after the latest PR fixes; the technical blockers were CI/runtime issues rather than feature behavior regressions.

## Next

- [2026-03-16 12:28 PDT] Create the remediation branch, commit the audited fixes plus repo-memory updates, open the PR, and watch the first CI/review round.
- [2026-03-16 12:13 PDT] Land the privacy/auth fixes first, then the media/unsubscribe hardening, then run focused verification before opening the remediation PR.
- [2026-03-16 11:45 PDT] Once reviewers respond, merge PR #47 and PR #50 in order so the stacked branch relationship stays clean.
- [2026-03-16 11:45 PDT] Re-run browser QA against live Supabase-backed profile/post data when local env credentials are available.
- [2026-03-16 11:45 PDT] Decide whether the feed `ShareMenu` should be trimmed now that the permalink page is the primary share surface.

## Parked

- [2026-03-14 14:12 PDT] Replacing the recap feature entirely is deferred; recap should remain functional while the new card system ships.
- [2026-03-14 14:12 PDT] Persisting visual card preferences in the database is deferred; first pass uses shareable URLs and deterministic defaults.

## Done Recently

- [2026-03-16 12:28 PDT] Verified the remediation slice with focused web type/tests and a production build; rebuilt `.waypoint/DOCS_INDEX.md` and `.waypoint/TRACKS_INDEX.md` so the new plan/tracker are discoverable.
- [2026-03-16 12:13 PDT] Read the backend and frontend audit reports, traced the findings into the implementation files, and wrote a durable remediation plan at `.waypoint/docs/audit-remediation-plan.md` plus a live tracker at `.waypoint/track/audit-remediation.md`.
- [2026-03-14 14:12 PDT] Inspected the existing recap, profile, post, and CLI share surfaces and wrote a durable implementation plan at `.waypoint/docs/shareable-asset-system-plan.md`.
- [2026-03-14 14:31 PDT] Implemented the new shareable asset system across profile, post, and CLI surfaces; added a public consistency route; updated post share cards; and manually verified the new UI/interaction flows through the preview harness.
- [2026-03-16 11:45 PDT] Closed the review loop on PR #47 with follow-up fixes for local Supabase docs, env validation, CLI key parsing, CI placeholders, and production `/cli/verify` stability; propagated the same local-dev fixes into PR #50 so both branches could rerun cleanly.
- [2026-03-16 11:57 PDT] Added root `AGENTS.md` project guidance capturing durable backend/frontend context: production app with real users, single-tenant backend, no hard backward-compatibility requirement, modern browser/device support, SEO limited to public pages, and no current localization scope.
- [2026-03-16 12:03 PDT] Completed a full backend ship-readiness audit for the current `main` backend surface and wrote the report to `.waypoint/audit/16-03-2026-12-03-backend-audit.md`; current recommendation is not ready to ship due to privacy/security issues in public email search, stored media URL validation, and DM attachment storage policy.
