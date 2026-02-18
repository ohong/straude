# Roadmap

## Create Post Page

Add a dedicated `/post/new` page for composing posts directly in the app (title, description, images, model selection). Currently the "Create Post" button in the header dropdown links to `/settings/import` as a placeholder.

## Notifications System

The bell icon in the top header links to `/notifications` but there's no notifications page or backend yet. Build a notifications system for follows, kudos, and comments.

## Session Time Tracking

Track time spent per Claude Code session and display it per-post alongside input/output tokens and cost.

Potential approach: [claude-code-time-tracking](https://github.com/gkastanis/claude-code-time-tracking) — a script that tracks session durations and could feed into the `daily_usage` pipeline.

Requires:
- New `duration_seconds` (or similar) column on `daily_usage`
- Corresponding field in `CcusageDailyEntry` type
- CLI integration to capture and submit duration data
- UI updates to display time per post
