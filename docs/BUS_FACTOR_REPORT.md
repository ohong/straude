# Bus Factor Report

**Generated:** 2026-03-10
**Repository:** straude

## Summary

| Metric | Value |
|--------|-------|
| Bus Factor | **1** |
| Total Contributors | 2 |
| Total Commits | 147 |
| Files Tracked | 398 |
| Files Analyzed (non-binary) | 398 |
| Total Lines (blamed) | 54,435 |
| Single-Author Files | 377 (94.7%) |

## Line Ownership by Author

| Author | Lines | Percentage |
|--------|------:|-----------:|
| Oscar Hong | 53,382 | 98.1% |
| Alexey | 1,053 | 1.9% |

## Commits by Author

| Author | Commits |
|--------|--------:|
| Oscar Hong | 135 |
| Alexey | 12 |

## Directory-Level Bus Factor

| Directory | Bus Factor | Lines | Top Author (%) |
|-----------|:----------:|------:|----------------|
| `apps` | 1 | 35,730 | Oscar Hong (97.3%) |
| `.agents` | 1 | 5,702 | Oscar Hong (100.0%) |
| `packages` | 1 | 4,366 | Oscar Hong (99.9%) |
| `docs` | 1 | 3,483 | Oscar Hong (98.7%) |
| `supabase` | 1 | 3,044 | Oscar Hong (98.3%) |
| `gtm` | 1 | 970 | Oscar Hong (100.0%) |
| `references` | 1 | 702 | Oscar Hong (100.0%) |
| `(root)` | 1 | 277 | Oscar Hong (100.0%) |
| `.claude` | 1 | 93 | Oscar Hong (100.0%) |
| `.github` | 1 | 59 | Oscar Hong (100.0%) |
| `.githooks` | 1 | 9 | Oscar Hong (100.0%) |

## High-Risk Files (Single Author, 100+ Lines)

| File | Lines | Author |
|------|------:|--------|
| `docs/straude-specs-v1.md` | 1,957 | Oscar Hong |
| `gtm/JAPAN-LAUNCH.md` | 970 | Oscar Hong |
| `.agents/skills/react-email/TESTS.md` | 878 | Oscar Hong |
| `packages/cli/__tests__/commands/push.test.ts` | 817 | Oscar Hong |
| `packages/cli/__tests__/flows/cli-sync-flow.test.ts` | 793 | Oscar Hong |
| `apps/web/components/app/messages/MessagesInbox.tsx` | 783 | Oscar Hong |
| `apps/web/__tests__/api/social.test.ts` | 758 | Oscar Hong |
| `.agents/skills/react-email/references/PATTERNS.md` | 713 | Oscar Hong |
| `apps/web/components/app/post/CommentThread.tsx` | 710 | Oscar Hong |
| `references/Feed Mockup.html` | 702 | Oscar Hong |
| `apps/web/__tests__/api/usage-submit.test.ts` | 684 | Oscar Hong |
| `apps/web/lib/utils/share-image.tsx` | 674 | Oscar Hong |
| `.agents/skills/react-email/references/I18N.md` | 657 | Oscar Hong |
| `apps/web/app/(onboarding)/onboarding/page.tsx` | 569 | Oscar Hong |
| `.agents/skills/react-email/SKILL.md` | 518 | Oscar Hong |
| `apps/web/__tests__/flows/cli-push-flow.test.ts` | 504 | Oscar Hong |
| `apps/web/lib/utils/recap-image.tsx` | 496 | Oscar Hong |
| `apps/web/components/app/feed/ShareMenu.tsx` | 464 | Oscar Hong |
| `apps/web/__tests__/api/messages.test.ts` | 435 | Oscar Hong |
| `.agents/skills/react-email/references/COMPONENTS.md` | 429 | Oscar Hong |
| `.agents/skills/email-best-practices/resources/transactional-email-catalog.md` | 418 | Oscar Hong |
| `apps/web/__tests__/api/profile.test.ts` | 403 | Oscar Hong |
| `apps/web/app/(app)/u/[username]/page.tsx` | 399 | Oscar Hong |
| `apps/web/app/(app)/settings/page.tsx` | 393 | Oscar Hong |
| `apps/web/scripts/generate-og-athletic-surge.ts` | 367 | Oscar Hong |
| `apps/web/components/app/prompts/SubmitPromptWidget.tsx` | 362 | Oscar Hong |
| `apps/web/scripts/generate-og-real-users.ts` | 347 | Oscar Hong |
| `apps/web/app/(landing)/join/[username]/opengraph-image.tsx` | 332 | Oscar Hong |
| `apps/web/app/api/messages/route.ts` | 319 | Oscar Hong |
| `apps/web/__tests__/api/upload.test.ts` | 313 | Oscar Hong |

## Recommendations

- **Critical:** Bus factor is 1. The project depends entirely on a single contributor. Prioritize code review participation and pair programming to spread knowledge.
- **High concentration:** 94.7% of files have a single author. Encourage contributions across the codebase.
- **30 high-risk files** with 100+ lines and a single author. These are the highest-priority areas for knowledge sharing.

