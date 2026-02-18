# Roadmap

## Create Post Page

Add a dedicated `/post/new` page for composing posts directly in the app (title, description, images, model selection). Currently the "Create Post" button in the header dropdown links to `/settings/import` as a placeholder.

## Real-time Notifications

The notifications system is built but uses polling (fetch on dropdown open + initial load). Consider adding Supabase Realtime subscriptions to push new notifications to the client without requiring a page refresh or dropdown toggle.

## Notifications Page

The dropdown shows the 20 most recent notifications. A dedicated `/notifications` page with pagination and filtering (by type) would be useful for users with high activity.

## Session Time Tracking

Track time spent per Claude Code session and display it per-post alongside input/output tokens and cost.

Potential approach: [claude-code-time-tracking](https://github.com/gkastanis/claude-code-time-tracking) — a script that tracks session durations and could feed into the `daily_usage` pipeline.

Requires:
- New `duration_seconds` (or similar) column on `daily_usage`
- Corresponding field in `CcusageDailyEntry` type
- CLI integration to capture and submit duration data
- UI updates to display time per post
