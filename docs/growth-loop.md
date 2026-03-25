# Growth Loop Model

Internal reference mapping Straude's features to its growth loop. Use this to evaluate whether a feature compounds (loop) or gives a one-time bump (funnel).

---

## Core Loop

```
         ┌──────────────────────────────────────────────────┐
         │                                                  │
         ▼                                                  │
      CODE ──→ PUSH ──→ SHARE ──→ DISCOVER ──→ JOIN ──→ CODE
       │        │         │          │            │
    Use AI    straude   Screenshot  Non-user    Signup via
    tools     push /    scorecard,  sees OG     /join/[user],
    (Claude,  auto-     post card,  preview,    onboarding,
    Codex)    push      referral    landing     first push
                        link        feed
```

**Code → Push → Share → Discover → Join** — this mirrors Strava's **Activity → Record → Share → Acquire** loop. Each node in the cycle is a product surface. The loop compounds: every new user who shares creates more acquisition surface for the next cohort.

---

## Straude vs. Strava

| Strava | Straude | Mechanism |
|--------|---------|-----------|
| Complete a run | Code with Claude / Codex | The atomic activity users track |
| Open Strava / auto-sync from GPS watch | `straude push` / auto-push via launchd/cron/hooks | Data capture — must be zero-friction |
| Share activity to Instagram / feed | Screenshot CLI scorecard, share post card, send referral link | Product IS distribution — every share is an acquisition event |
| Non-runner sees friend's activity on Stories | Non-user sees OG image on Twitter/LinkedIn, visits `/join/[username]` | Zero-friction preview — browser-first, no install needed to view |
| "If it's not on Strava, it didn't happen" | "Log your sessions like athletes log miles" | Cultural meme that creates social pressure to join |
| Segment leaderboards, kudos, personal records | Weekly leaderboard, kudos, streaks, levels, achievements | Gamification drives retention AND creates shareable moments |
| Challenges (monthly distance goals) | Global challenges (planned) | Community goals create collective engagement |
| Clubs and groups | Team / Org Workspaces (planned) | B2B wedge: 1 manager → 10 users |
| Device integrations (every GPS watch syncs to Strava) | CLI integrations (Claude Code today, Codex today, potentially Cursor/Copilot later) | Being the hub everything syncs to is the moat |

**Figma parallel.** Every Straude URL — `/post/[id]`, `/u/[username]`, `/consistency/[username]`, `/join/[username]`, `/recap/[username]` — renders a rich OG preview and works without authentication. Like Figma links, the product is the distribution. No download required to view. Each shared link is an acquisition event.

---

## The Two Load-Bearing Loops

Per Reforge: the fastest-growing products are powered by 1–2 major loops, not dozens of weak ones.

### Loop 1 (Primary): User-Generated Content Distribution

```
User codes with AI → pushes via CLI → post is created →
  user shares post card / CLI scorecard / consistency card →
    non-user discovers on social media →
      visits Straude URL with rich OG image →
        signs up → installs CLI → pushes → cycle repeats
```

**Load-bearing features:**
- CLI push (the capture step)
- Post share panel with 3 themes: Paper, Graphite, Solar
- CLI scorecard (compacted to 19 lines for screenshotting)
- OG image generation (posts, profiles, consistency, join pages, recaps)
- Public profiles and public leaderboard
- Referral join pages with competitive stats

This is the loop that compounds. Initiative B (10% WoW growth in shared artifacts) will always beat Initiative A (one-time Show HN bump). Every new user who shares creates more acquisition surface.

### Loop 2 (Secondary): Direct Referral

```
User shares /join/[username] link →
  30-day cookie attribution →
    new user signs up →
      mutual follow created →
        referrer gets notification + email + achievement progress →
          referrer is incentivized to refer more
```

**Load-bearing features:**
- Referral system (`/join/[username]`, 30-day cookie, mutual follow)
- Referral achievements (First Recruit, Crew of 5, Pace Group, Coach)
- Crew stats on profile (referral count + crew total spend)
- Invite button on profile + "Grow Your Crew" sidebar CTA

This loop is high-intent (referred users arrive with a social connection) but more linear than exponential. Its strength is activation quality — referred users have a built-in follow graph on day one.

### What is NOT a loop

These features are valuable but do not compound:
- **Prometheus List** — one-time SEO/content play that drives impressions, not a self-reinforcing cycle
- **Wall of Love** — social proof that aids conversion on the landing page
- **Admin dashboard** — internal analytics
- **Account deletion / security hardening** — table stakes, not growth

---

## Shipped Features by Loop Role

| Role | Feature | How it feeds the loop |
|------|---------|----------------------|
| **Generate** | Claude Code / Codex usage | Prerequisite — no coding activity, no loop |
| **Capture** | CLI `straude push` | Gateway into the system — frictionless single command |
| **Capture** | Auto-push via launchd / cron / SessionEnd hook | Removes manual step; capture becomes passive |
| **Capture** | First-push 3-day backfill | New users have content immediately; no empty-profile dead zone |
| **Share** | CLI post-push scorecard (19 lines, ANSI-colored) | Primary terminal share artifact — bar chart, leaderboard, percentile |
| **Share** | Post share panel (Paper / Graphite / Solar themes) | Web share artifact with copy-image, download PNG, X intent, starter caption |
| **Share** | Consistency cards (`/consistency/[username]`) | 52-week heatmap PNG for social sharing |
| **Share** | Recap cards (`/recap/[username]`) | Periodic branded summary images (weekly/monthly) with 10 background options |
| **Share** | Referral links (`/join/[username]`) | Direct user-to-user acquisition with competitive framing |
| **Share** | Invite button + "Grow Your Crew" sidebar CTA | Low-friction referral link copy from profile and feed |
| **Discover** | OG images (posts, profiles, consistency, join pages, recaps, landing) | Every URL is a rich preview card on Twitter/LinkedIn/Slack/Discord |
| **Discover** | Global feed on landing page | Top 3 posts from last 7 days visible to unauthenticated visitors |
| **Discover** | Public leaderboard (weekly / monthly / all-time / daily) | Rankings visible to guests; regional filtering |
| **Discover** | Public profiles (`/u/[username]`) | Searchable, linkable portfolio pages with level, streak, achievements |
| **Discover** | Prometheus List (`/token-rich`) | SEO content magnet; sign-in gated at 20 companies |
| **Discover** | Wall of Love (8 influencer quotes) | Social proof from Garry Tan, DHH, Jesse Pollak, Howie Liu, etc. |
| **Discover** | Prometheus preview section on landing page | Top 5 companies shown to visitors before the global feed |
| **Convert** | Join pages with competitive stats | Provocative copy: "Think you can keep up?" with referrer's spend/streak |
| **Convert** | Onboarding flow (3 steps with usage polling) | Reduces signup-to-first-push friction |
| **Convert** | Ship Week achievement | Urgency in first 7 days to establish habit |
| **Retain** | Streaks (consecutive days) + streak freezes | Daily habit loop — loss aversion keeps users pushing |
| **Retain** | Levels (L1–L8, sticky best-window) | Identity marker that rewards consistent output, not one-time spikes |
| **Retain** | Achievements (44 badges across usage, social, referral, media) | Progressive milestones; display on public profiles |
| **Retain** | Kudos, comments, threaded replies, comment reactions | Social engagement that creates notification pull |
| **Retain** | Leaderboard competition | Competitive motivation; rank context in CLI scorecard |
| **Retain** | Empty-profile nudge email | Re-engagement for users who onboarded but never pushed |

---

## Roadmap Features by Loop Role

Features from `ROADMAP.md` ranked by their contribution to the primary loop.

| Priority | Feature | Role | Why |
|----------|---------|------|-----|
| **High** | Daily Digest Email | Retain | The missing **trigger** in the habit loop — "Your streak is at risk, push today." Cheapest re-engagement mechanism. |
| **High** | Team / Org Workspaces | Convert | New B2B loop: 1 manager invites 10 engineers. Bypasses viral requirement entirely. |
| **High** | Ship Week Countdown Banner | Convert | Targets the highest-leverage moment (first 7 days) with urgency: "4 days left — 3/5 synced." |
| **Medium** | AI Matchup Narratives | Share | Head-to-head comparisons create shareable competitive content between users. |
| **Medium** | Global Challenges | Retain | Community-wide goals ("Race to 1B Output Tokens") create shared narrative + share moments. |
| **Medium** | Healthy Streaks (5-of-7) + Achievement Chains | Retain | Reduces streak-break churn; progress bars add visibility to next milestone. |
| **Medium** | CLI Recap (`straude recap`) | Share | New terminal share artifact — AI-generated narrative of recent activity. |
| **Lower** | AI Leaderboard Commentary | Share | Adds narrative flavor but doesn't create new share surfaces. |
| **Lower** | Personal Analytics Dashboard | Retain | Utility feature; creates "banking app" check-in behavior but no loop contribution. |
| **Lower** | Efficiency Score + Cost Forecast | Retain | Daily check-in driver, but doesn't generate shareable output. |
| **Lower** | Per-Device Breakdown UI | Retain | Infrastructure polish; no growth impact. |

**Team / Org Workspaces** represents a fundamentally different loop (manager-driven, not viral). If built, it deserves its own loop diagram: **Manager signs up → invites team → team competes internally → manager sees ROI dashboard → renews / expands → repeat.** This is the monetization path (free individual, paid team).

---

## What's Missing

Gaps in the loop identified from codebase and roadmap analysis:

1. **No re-engagement trigger for active users.** The empty-profile nudge targets users who never pushed. The daily digest email (planned) would close this gap for users who have pushed before but went quiet. This is the single highest-leverage unbuilt feature for loop velocity.

2. **No share-to-conversion tracking.** There is no analytics on how many non-users view OG images or shared cards before converting. Without this, the team cannot measure loop efficiency (shares → signups) or know which share surfaces perform best.

3. **No in-product share prompt after milestones.** Achievements are awarded silently (notification only). A "Share this achievement" modal after earning a badge would convert retention moments into share moments, directly feeding Loop 1.

4. **CLI scorecard requires manual screenshotting.** The scorecard is designed for screenshots (19 lines, ANSI-colored) but requires users to manually take the screenshot. A `straude push --copy` flag that auto-copies a PNG to clipboard would reduce friction to near-zero.

---

## References

1. **Brian Balfour, "Growth Loops Are the New Funnels"** — Reforge, 2018. Framework for understanding compound growth systems vs. one-time acquisition tactics. Key insight: the fastest-growing products are powered by 1–2 major loops where the output of one cycle feeds the input of the next.
   https://www.reforge.com/blog/growth-loops

2. **Kevin Kwok, "Why Figma Wins"** — kwokchain.com, June 2020. Details Figma's cross-side network effect: designers pull in non-designers by sharing links, non-designers evangelize to other designers on different teams. The product (browser-based, multiplayer) IS the distribution — every shared link is an acquisition event.
   https://kwokchain.com/2020/06/19/why-figma-wins/

3. **Contrary Research, "Strava"** — contrary.com, 2025. Comprehensive analysis of Strava's growth loop: Activity → Share → Acquire. Covers segment leaderboards, challenges, kudos, clubs, sponsored challenges, and the cultural meme "if it's not on Strava, it didn't happen." 180M registered users, approaching $500M ARR.
   https://research.contrary.com/company/strava
