# UX Design Critique — Straude

**Date:** 2026-03-27
**Pages reviewed:** Landing (light/dark), Feed (desktop/mobile), Leaderboard, Profile (`/u/ohong`)

---

## Anti-Patterns Verdict: PASS

No gradient text, glassmorphism, glowing neon accents, or identical-card hero metric grids. The orange `#DF561F` accent is distinctive. The halftone texture in the hero adds personality. Contribution heatmap, radar chart, and leaderboard table feel intentional.

**Minor tells to watch:**
- Numbered feature grid (01, 02...) with icon+title+description is a well-trodden pattern. Executed cleanly but doesn't surprise.
- Landing page is always-dark regardless of system preference.

---

## What's Working

1. **Contribution heatmap** — Instantly recognizable from GitHub. Creates a visceral "this person is active" signal. Orange heat tones match the brand perfectly. Most distinctive UI element on the site.

2. **Leaderboard information density** — Period tabs + region filters + clean table with rank/avatar/username/level/cost/output/streak. Everything needed, nothing extra. Fire emoji streaks reinforce the athletic metaphor.

3. **Typography discipline** — Inter for body, JetBrains Mono for numbers. No decorative fonts. Clear type hierarchy: big numbers for stats, small uppercase labels, medium-weight headings. Feels like a tool for serious developers.

---

## Priority Issues

### 1. Feed cards are visually flat

Every card has the same visual weight. Avatar, date, model tag, cost/input/output stats, and kudos/comments row are all rendered at similar levels. No entry point draws the eye.

**Why it matters:** Users scrolling the feed can't quickly scan for interesting posts. A $297 session looks the same as a $0.45 session at a glance.

**Fix:** Make the cost number larger or bolder — it's the key metric. Consider subtle visual differentiation for high-spend sessions. De-emphasize the model tag (smaller, muted).

---

### 2. Profile header has too much competing information

The profile packs name, username, bio, location, link, GitHub, recruited-by, following/followers/activities, streak, output tokens, total spend, crew count, achievement badges, contribution graph, share panel, AND radar chart above the fold. Every element has roughly equal visual weight.

**Why it matters:** A new visitor can't form a quick impression. The hierarchy should be: identity (name + avatar) -> key metric (spend or streak) -> everything else.

**Fix:** Establish a clear primary stat — probably total spend or streak, rendered significantly larger. Push secondary stats into a more compact presentation. Consider collapsing achievements below the fold.

---

### 3. Landing page lacks visual breathing room

Hero -> feature grid -> feed preview -> footer flows with minimal visual separation. Dark-on-dark sections blur together. The CTA competes with the navigation and feature grid below.

**Why it matters:** First-time visitors need to orient quickly. Without clear section breaks, the page feels like one long dark scroll.

**Fix:** Add more whitespace between major sections. Consider a lighter or contrasting background for alternate sections (even subtle `#111` vs `#0a0a0a`). Make the hero CTA button larger with more surrounding whitespace.

---

### 4. Mobile bottom nav label "Prometheus" is confusing

Bottom nav shows: Home, Leaderboard, Prometheus. "Prometheus List" is an internal product name that means nothing to a new user.

**Why it matters:** Bottom nav is primary navigation on mobile. Every label should be instantly understood.

**Fix:** Rename to "Companies" or "AI Budgets" in the nav. Use "Prometheus" as the page title if brand matters, not the nav label.

---

### 5. Guest feed has no contextual sign-up prompt

The guest feed shows posts with only a top-right "Get Started" button. No in-context CTA near the content. A guest scrolling through interesting posts has no contextual prompt to sign up.

**Why it matters:** The feed is the top-of-funnel discovery page. Every interesting post is a missed conversion opportunity.

**Fix:** Add a sticky or inline CTA after the 3rd-5th post in the guest feed: "Track your own Claude Code sessions — Get Started." Keep it minimal and non-intrusive.

---

## Minor Observations

- **Verified badge noise:** Green "Verified" pill appears on almost every post, making it visual noise rather than a differentiator. If most posts are verified, consider marking unverified ones instead.
- **Leaderboard level badges:** Small `L4`, `L5` badges are subtle but their meaning isn't discoverable without clicking. A tooltip on hover would help.
- **Radar chart size:** Labels ("Output", "Intensity", etc.) crowd each other at the current small size on the profile page.
- **Share button:** "Share" text link on every card row competes with "0 kudos / 0 comments". Consider an icon-only share button.
- **"Edit Profile" button:** Rendered as a small bordered text link rather than a button. Reads as navigation rather than an action.

---

## Questions to Consider

- **What if the feed had a "biggest sessions this week" highlight at the top?** A standout post could anchor the feed experience.
- **What if cost was the visual hero of each card?** Like Strava makes distance/pace the giant number on an activity.
- **Does the profile need to show everything above the fold?** What if radar chart and achievements loaded as tabs or expandable sections?
- **What would a "proud to share" profile look like?** The current profile is information-dense but not emotionally resonant. Athletes share Strava screenshots because the big number feels like a flex. What's the equivalent here?
