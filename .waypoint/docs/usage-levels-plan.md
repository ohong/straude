---
summary: Implementation plan and recommendation for a shareable L1-L8 usage level system on profiles and leaderboard rows.
last_updated: "2026-03-16 13:21 PDT"
read_when:
  - planning a usage-based level or progression feature
  - deciding whether to add profile and leaderboard status layers
  - implementing profile or leaderboard status badges
---

# Usage Levels Plan

## TL;DR

Yes, Straude should add levels, but only as a compact social identity layer, not as a second leaderboard.

The right v1 is:

- `L1` through `L8`
- derived from a user's **best 30-day stretch**
- unlocked by meeting both a **consistency gate** and a **usage volume gate**
- **sticky once earned** so users never drop backward
- shown only on **profiles** and **leaderboard rows**

This fits the user's goal better than expanding achievements because it gives people one simple status label they can point to, while still rewarding power users.

## Why This Is Worth Doing

### Current product state

- Profiles already show streak, lifetime spend, lifetime output, contributions, and achievements in [`apps/web/app/(app)/u/[username]/page.tsx`](/Users/mark/clawd/projects/straude/apps/web/app/(app)/u/[username]/page.tsx).
- Leaderboard rows already show rank, spend, output, and streak in [`apps/web/components/app/leaderboard/LeaderboardTable.tsx`](/Users/mark/clawd/projects/straude/apps/web/components/app/leaderboard/LeaderboardTable.tsx).
- Achievements already cover many lifetime and milestone-based usage behaviors in [`apps/web/lib/achievements.ts`](/Users/mark/clawd/projects/straude/apps/web/lib/achievements.ts).
- The live default leaderboard at [straude.com/leaderboard](https://straude.com/leaderboard), scraped on 2026-03-16, shows a strong competitive surface but no compact identity marker beyond rank and streak. The visible spend range on that page runs from `$2502.06` down to `$16.00`, so the middle of the pack has activity worth signaling even when users are far from rank #1.

### Product read

Levels are justified because they solve a different job than achievements or rank:

- achievements are many-to-many and feel collectible
- rank is positional and zero-sum
- a level is a single portable identity marker

That makes levels a good fit for "people want to share it" as long as the feature stays legible.

## Product Decision

### Recommendation

Ship usage levels.

### Positioning

Present levels as **your best recent stretch**, not as an RPG or a hidden formula.

### Core rules

- Level is based on the user's **best historical 30-day window**.
- Level uses **two gates**: active days and spend in that same 30-day window.
- Once a level is unlocked, it does **not** go down.
- Users with no logged usage do not show a level yet.

This resolves the product tension from discovery:

- user wanted a rolling-status idea
- user did not want people to lose status

Using the best 30-day window gives the feature recent-shape meaning without punishing quiet periods.

## Level Ladder

Use this exact v1 ladder:

| Level | Active Days In A 30-Day Window | Spend In The Same 30-Day Window |
| --- | --- | --- |
| L1 | 1 | $1 |
| L2 | 3 | $10 |
| L3 | 7 | $40 |
| L4 | 10 | $100 |
| L5 | 15 | $250 |
| L6 | 20 | $500 |
| L7 | 24 | $1,000 |
| L8 | 28 | $2,000 |

### Why these cutoffs

- They create meaningful spread for casual, regular, and elite users.
- They avoid a pure wallet metric by requiring consistency at every tier.
- They still align with Straude's core spend-driven identity and existing leaderboard language.
- They map plausibly onto the live leaderboard's visible weekly spend spread without compressing everyone into `L1`-`L3`.

### Explicit v1 tradeoff

Do **not** include output tokens, efficiency, verification, or social activity in the v1 level formula.

Reason:

- output-plus-spend makes the system harder to explain
- verification is already surfaced elsewhere
- social metrics belong to achievements and reputation, not usage level
- the leaderboard and project north-star metric already center spend

If Straude later ships Efficiency Score, that can be a separate dimension rather than contaminating level logic.

## Proposed Implementation

### 1. Add durable persistence for earned level

Create a new table:

- `user_levels`

Suggested columns:

- `user_id uuid primary key references users(id) on delete cascade`
- `level integer not null`
- `best_window_start date not null`
- `best_window_end date not null`
- `best_window_cost_usd numeric not null`
- `best_window_active_days integer not null`
- `promoted_at timestamptz not null`
- `updated_at timestamptz not null`

Why a table instead of computing on every read:

- leaderboard rows need level for many users at once
- level is sticky and should have provenance
- profile and leaderboard reads stay simple
- the no-downgrade rule becomes explicit

### 2. Add a database function that recalculates one user's level

Create a SQL function:

- `recalculate_user_level(p_user_id uuid)`

Function behavior:

1. Read all distinct usage dates for the user from `daily_usage`.
2. For each candidate end date, compute:
   - total `cost_usd` across the trailing 30 calendar days
   - count of distinct active days in that same window
3. Determine the highest `L1`-`L8` threshold that any window satisfies.
4. Upsert `user_levels` with the highest unlocked level and the matching best window metadata.
5. If no window satisfies `L1`, delete any existing `user_levels` row for that user.

Implementation note:

- because the table is keyed by user and user history is still small, a full per-user recompute is simpler and safer than incremental diff logic
- do the computation in SQL so backfills and runtime recalculation share one source of truth

### 3. Backfill existing users

Add a migration step that populates `user_levels` for every user with at least one `daily_usage` row.

At current scale this can run in the migration safely by iterating over distinct `user_id`s and calling `recalculate_user_level`.

### 4. Recalculate on usage writes only

Update [`apps/web/app/api/usage/submit/route.ts`](/Users/mark/clawd/projects/straude/apps/web/app/api/usage/submit/route.ts):

- after the daily usage row is finalized
- after the post create/update path succeeds
- in the same deferred/side-effect section where achievements are rechecked

Call the new database function for the affected user.

Do not recalculate levels on kudos, comments, or photo edits.

### 5. Expose levels to profile and leaderboard surfaces

#### Profile

Update [`apps/web/app/(app)/u/[username]/page.tsx`](/Users/mark/clawd/projects/straude/apps/web/app/(app)/u/[username]/page.tsx):

- fetch the viewer's `user_levels` row alongside the existing stats query bundle
- render a compact `Lx` badge near the username or at the start of the stats row
- add helper text on profile only: `Best 30-day stretch`

#### Leaderboard

Update:

- [`apps/web/app/(app)/leaderboard/page.tsx`](/Users/mark/clawd/projects/straude/apps/web/app/(app)/leaderboard/page.tsx)
- [`apps/web/app/api/leaderboard/route.ts`](/Users/mark/clawd/projects/straude/apps/web/app/api/leaderboard/route.ts)
- [`apps/web/components/app/leaderboard/LeaderboardTable.tsx`](/Users/mark/clawd/projects/straude/apps/web/components/app/leaderboard/LeaderboardTable.tsx)
- [`apps/web/types/index.ts`](/Users/mark/clawd/projects/straude/apps/web/types/index.ts)

Approach:

- keep rank ordering unchanged
- batch-fetch `user_levels` for the returned `user_id`s
- merge `level` into the leaderboard entry payload
- show a compact level pill in the user column on desktop and beside the avatar/name on mobile

Do not sort, filter, or paginate by level in v1.

## UI Guidance

### Profile badge

- small but prominent
- visually closer to rank/streak language than to achievements
- use existing app badge language rather than inventing a new decorative component

### Leaderboard badge

- visually subordinate to rank
- must not make the row feel noisy
- render as plain `L4`, `L7`, etc. with no subtitle

### Copy

Keep copy minimal:

- profile label: `Level`
- profile subtext: `Best 30-day stretch`
- leaderboard cell: `Lx`

Do not add named titles like "Architect" or "Orchestrator" in v1. The mock's narrative copy is useful inspiration but too opinionated for the first shipped version.

## Acceptance Criteria

### Product

- A user with usage history sees exactly one level on their public profile.
- A public leaderboard row shows the same level for that user.
- Levels never decrease after additional syncs or quiet periods.
- A user cannot reach a high level from a single expensive day because each tier requires active-day consistency.

### Data

- Existing users are backfilled and do not need to sync again to get a level.
- `user_levels` contains the best qualifying 30-day window metadata for each leveled user.
- Re-running the recalculation function for the same user is idempotent.

### UX

- Level does not replace achievements.
- Level does not replace streak.
- Leaderboard ranking remains spend-based.
- Users with no logged usage do not show a misleading default level.

## Verification

### Automated

- Add backend/API coverage proving that recalculation promotes users at the exact threshold boundaries.
- Add coverage for no-downgrade behavior after later low-usage windows.
- Add leaderboard/profile response coverage that includes the level field when present.

### Manual

1. Seed or create a user just below a threshold and confirm the old level remains.
2. Add usage that crosses the threshold and confirm profile plus leaderboard update to the new level.
3. Add a later low-usage period and confirm the level does not fall.
4. Confirm users without usage still show no level badge.
5. Check desktop and mobile leaderboard layouts for crowding.

## Non-Goals

- no level share card
- no feed-card or post-card level display
- no level-based notifications
- no named classes beyond `L1`-`L8`
- no use of comments, kudos, referrals, or achievements in the formula
- no replacement of rank, streak, or achievements

## Risks And Mitigations

### Risk: level feels redundant with achievements

Mitigation:

- keep it singular and always visible
- avoid adding many badges or secondary states around it

### Risk: level feels pay-to-win

Mitigation:

- require active-day gates at every tier
- explain it as best 30-day stretch, not total lifetime spend

### Risk: threshold tuning is imperfect at launch

Mitigation:

- ship the ladder above as v1
- after launch, review the actual distribution of `user_levels` before changing thresholds
- if thresholds change later, record the decision in `docs/DECISIONS.md`

The current local database snapshot is too small to calibrate percentiles safely, so threshold refinement must use production distribution review after rollout rather than pretending this repo has enough sample size now.

## Final Recommendation

Do it.

But do it as a **small, opinionated status layer**:

- best 30-day stretch
- sticky levels
- profile + leaderboard only
- simple spend-plus-consistency ladder

If the feature grows beyond that in v1, it will start competing with the leaderboard and achievements instead of strengthening them.
