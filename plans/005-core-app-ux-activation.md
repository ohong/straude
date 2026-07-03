# Workstream 5: Core App UX Activation

Priority: P2  
Owner: core product UX agent  
Estimated size: M  
Depends on: Workstream 1 activation contract; coordinate with Workstream 4

## Goal

Make the core web app intuitive for new users while preserving the depth that makes Straude worth returning to.

Prioritize clearer hierarchy, stronger empty states, and progressive disclosure over adding more surfaces.

## Current Evidence

- `apps/web/components/app/feed/FeedList.tsx` shows a sync hint in the toolbar, but empty states do not consistently expose a copyable command.
- Guest feed routes show public content and bottom links, but there is no strong contextual signup prompt after the user has seen proof of value.
- `apps/web/components/app/ActivityCard.tsx` shows useful metadata, but cost, tokens, models, comments, verification, and actions compete at similar visual weight.
- `apps/web/app/(app)/u/[username]/page.tsx` loads and displays many profile concepts above the fold: identity, team, level, follow/message/edit/invite, bio, location, link, GitHub, referrer, following/follower counts, stats, badges, contribution graph, radar, and posts.
- `apps/web/components/app/GuestHeader.tsx` labels the company-ranking route as "Prometheus List", which is evocative but not self-explanatory for new visitors.
- Previous UX notes in `docs/ux-suggestions.md` already flagged feed-card flatness, profile-header overload, guest feed signup weakness, landing breathing room, and the confusing mobile "Prometheus" label.
- Core UX changes need PostHog coverage so the team can compare guest CTA clicks, empty-state command copies, and first-sync recovery after launch.

## In Scope

- `apps/web/components/app/feed/FeedList.tsx`
- `apps/web/components/app/ActivityCard.tsx`
- `apps/web/components/app/GuestHeader.tsx`
- `apps/web/components/app/MobileNav.tsx` if labels need coordination
- `apps/web/app/(app)/feed/page.tsx`
- `apps/web/app/(app)/u/[username]/page.tsx`
- Profile components under `apps/web/components/profile/*`
- Shared analytics wrapper from Workstream 1
- Empty-state components and tests

## Out of Scope

- New major product areas.
- Landing page hero redesign.
- CLI internals.
- Database schema changes.

## Implementation Instructions

1. Make no-data states activation-first.
   - For the user's own feed/profile with no usage, show the canonical command and a copy action.
   - Explain the payoff in one sentence: the first sync creates the profile, streak, spend, and shareable session history.
   - Keep secondary browse actions available but visually below the sync command.
2. Add contextual guest conversion.
   - On guest feeds and public profiles, insert a signup CTA after the user has seen enough proof of value.
   - Use the CTA to connect public content to the user's own first sync.
   - Do not block browsing; make the CTA contextual, not modal.
3. Rebalance activity cards.
   - Make the session's main outcome visually dominant: cost, tokens, model, and note/title.
   - Reduce repeated verified-badge noise. Use verification as a subtle trust affordance unless the card needs warning treatment.
   - Keep comments and reactions accessible but secondary.
   - Improve scanability for mixed public feeds with many similar cards.
4. Simplify the profile header.
   - First row: identity, follow/edit action, and one dominant performance stat.
   - Second row: compact stats and streak.
   - Move achievements, radar, referrer, and secondary metadata below the first viewport or behind expandable sections.
   - For the signed-in user's own empty profile, replace profile-density with first-sync guidance.
5. Rename unclear navigation labels for first-time comprehension.
   - Keep "Prometheus List" as page flavor if desired.
   - In nav, use a descriptive label such as "AI Budgets", "Company Rankings", or another tested plain-language label.
   - Apply the same label strategy to desktop and mobile guest navigation.
6. Preserve functional richness through disclosure.
   - Do not remove achievements, rankings, prompts, comments, or social stats.
   - Reorder and collapse them so they support the primary task instead of competing with it.
7. Add PostHog events for UX iteration.
   - Capture `guest_signup_cta_clicked` with `surface`, `cta_location`, and `destination`.
   - Capture `sync_command_copied` with `surface: "empty_state"` for no-data feed/profile states.
   - Capture `first_sync_nudge_clicked` when a signed-in no-usage user follows the nudge back to onboarding or the sync page.
   - Use the shared analytics wrapper so browser events respect cookie consent.
   - Do not add high-cardinality properties such as raw post titles, notes, prompts, URLs, or usernames.
8. Add interaction and copy tests.
   - Empty own-feed state includes the command and copy button.
   - Guest feed includes a contextual signup CTA after content.
   - Public profile remains readable when optional metadata is missing.
   - Activity cards remain stable with long titles, no note, many reactions, and verified state.

## Verification Commands

```bash
bun --cwd apps/web test -- components/app/feed components/app/ActivityCard
bun --cwd apps/web test -- components/profile
bun --cwd apps/web test:e2e -- e2e/public-profile.spec.ts e2e/landing-to-signup.spec.ts
bun --cwd apps/web typecheck
```

Manual review:

```bash
bun --cwd apps/web dev
```

Check these states at desktop and mobile widths:

- Guest feed with posts.
- Signed-in own feed with no usage.
- Signed-in own feed with usage.
- Public profile with dense metadata.
- Public profile with sparse metadata.

PostHog check after deploying core UX changes:

```sql
SELECT event, count() AS count, max(timestamp) AS last_seen
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
  AND event IN (
    'guest_signup_cta_clicked',
    'sync_command_copied',
    'first_sync_nudge_clicked'
  )
GROUP BY event
ORDER BY event
LIMIT 100
```

## Done Criteria

- New users can find the sync command from every no-data authenticated state.
- Guest users see a clear signup path after seeing product value.
- Feed cards are easier to scan without hiding important actions.
- Profile header has a clear first viewport hierarchy.
- Navigation labels are understandable without prior product lore.
- PostHog captures guest CTA, command-copy, and first-sync nudge interactions for consented sessions.

## Stop Conditions

- Stop if the profile refactor requires changing data contracts owned by Workstream 4.
- Stop if collapsing secondary content hides an existing paid or critical workflow.
- Stop if nav renaming conflicts with active marketing or launch copy; escalate with two concrete label options and tradeoffs.
