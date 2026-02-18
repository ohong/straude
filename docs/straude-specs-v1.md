# Straude v1 — Product Requirements Document

**Version:** 1.0  
**Date:** 16 Feb 2026  
**Author:** @ohong  
**Status:** Draft  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technical Stack & Architecture](#2-technical-stack--architecture)
3. [Workstream Structure](#3-workstream-structure)
4. [Shared Foundations](#4-shared-foundations)
5. [Workstream A: Landing Page](#5-workstream-a-landing-page)
6. [Workstream B: CLI Package](#6-workstream-b-cli-package)
7. [Workstream C: Core Web App](#7-workstream-c-core-web-app)
8. [Data Model](#8-data-model)
9. [API Specification](#9-api-specification)
10. [Design System — Core App](#10-design-system--core-app)
11. [Design System — Landing Page](#11-design-system--landing-page)
12. [File Upload & Storage](#12-file-upload--storage)
13. [AI Integration (Claude Sonnet 4.5)](#13-ai-integration-claude-sonnet-45)
14. [Privacy & Visibility](#14-privacy--visibility)
15. [UI Quality Standards](#15-ui-quality-standards)
16. [Out of Scope (v1)](#16-out-of-scope-v1)
17. [Analytics](#17-analytics)
18. [Appendices](#18-appendices)

---

## 1. Overview

### 1.1 Product Summary

Straude is a social platform for tracking and sharing Claude Code usage. Users import their daily usage statistics via a zero-install CLI command (`npx straude@latest`), share their coding sessions with followers, and compete on a global leaderboard.

### 1.2 Tagline

*Strava for Claude Code*

### 1.3 Target Users

- Claude Code power users (professional software engineers, indie hackers, agentic engineers)
- Developers who want social accountability and visibility for their AI-assisted coding

### 1.4 Core Value Proposition

- Transform solitary AI-assisted coding into a social, competitive experience
- Provide bragging rights and social proof for Claude Code usage
- Create community around the emerging "agentic engineering" movement

---

## 2. Technical Stack & Architecture

### 2.1 Stack Overview

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15+ (App Router) |
| Language | TypeScript (.tsx) |
| JS Toolkit | Bun (all dev, build, and package management) |
| Authentication | Supabase Auth (magic link email + GitHub OAuth) |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| UI Components | Base UI (`@base-ui/react`) |
| Styling | Tailwind CSS 4+ with CSS Modules for complex components |
| Fonts | Inter (UI) + JetBrains Mono (stats/code) via Google Fonts |
| Icons | Lucide React |
| Animation | `motion/react` (only when explicitly needed) |
| AI | Anthropic API (Claude Sonnet 4.5 — `claude-sonnet-4-5-20250929`) |
| Image Generation | Black Forest Labs FLUX.2 (visual assets: hero images, graphics) |
| Hosting | Vercel (single project) |
| Monorepo | Turborepo |
| CLI Distribution | npm + bunx (zero-install via `npx straude@latest` / `bunx straude`) |

### 2.2 Repository Structure

```
straude/
├── turbo.json
├── package.json                    # Workspace root (bun workspaces)
├── apps/
│   └── web/                        # Next.js application (landing + core app)
│       ├── app/
│       │   ├── (landing)/          # Landing page routes (public, different style)
│       │   │   └── page.tsx        # Single-page scroll landing
│       │   ├── (auth)/             # Auth routes (sign-in, sign-up, callback)
│       │   │   ├── login/
│       │   │   ├── signup/
│       │   │   └── callback/
│       │   ├── (app)/              # Authenticated app routes (core app style)
│       │   │   ├── feed/
│       │   │   │   └── page.tsx
│       │   │   ├── post/
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx
│       │   │   ├── u/
│       │   │   │   └── [username]/
│       │   │   │       └── page.tsx
│       │   │   ├── leaderboard/
│       │   │   │   └── page.tsx
│       │   │   ├── search/
│       │   │   │   └── page.tsx
│       │   │   ├── settings/
│       │   │   │   ├── page.tsx
│       │   │   │   └── import/
│       │   │   │       └── page.tsx
│       │   │   └── layout.tsx      # App shell: sidebar + main + aside
│       │   ├── cli/
│       │   │   └── verify/
│       │   │       └── page.tsx    # CLI auth verification page
│       │   ├── api/
│       │   │   ├── auth/
│       │   │   │   └── cli/
│       │   │   ├── usage/
│       │   │   ├── posts/
│       │   │   ├── social/
│       │   │   ├── leaderboard/
│       │   │   ├── search/
│       │   │   ├── upload/
│       │   │   └── ai/
│       │   └── layout.tsx          # Root layout
│       ├── components/
│       │   ├── landing/            # Landing-specific components
│       │   ├── app/                # Core app components
│       │   │   ├── feed/
│       │   │   ├── post/
│       │   │   ├── profile/
│       │   │   ├── leaderboard/
│       │   │   └── shared/
│       │   └── ui/                 # Shared primitives (Base UI wrappers)
│       ├── lib/
│       │   ├── supabase/
│       │   │   ├── client.ts       # Browser client
│       │   │   ├── server.ts       # Server client
│       │   │   └── middleware.ts    # Auth middleware
│       │   ├── api/
│       │   ├── utils/
│       │   │   └── cn.ts           # clsx + tailwind-merge
│       │   └── constants/
│       ├── content/
│       │   └── wall-of-love.md     # X post links for landing page
│       ├── public/
│       │   └── images/             # FLUX-generated assets
│       └── types/
├── packages/
│   └── cli/                        # Straude CLI tool (npx-able)
│       ├── src/
│       │   ├── index.ts            # Entry point (bin)
│       │   ├── commands/
│       │   │   ├── login.ts        # Browser-based OAuth flow
│       │   │   ├── push.ts         # Submit usage data
│       │   │   └── status.ts       # Check streak, rank
│       │   ├── lib/
│       │   │   ├── ccusage.ts      # ccusage library wrapper
│       │   │   ├── auth.ts         # Token management
│       │   │   └── api.ts          # API client
│       │   └── config.ts           # ~/.straude/config.json
│       ├── package.json
│       └── tsconfig.json
└── supabase/
    └── migrations/
```

### 2.3 Key Architecture Decisions

- **Single Next.js app**: Landing page and core app live in the same Next.js project, using route groups `(landing)` and `(app)` with separate layouts and styles. This simplifies Supabase Auth callback handling and deployment.
- **Single Vercel project**: One deployment, one domain (`straude.com`).
- **Bun everywhere**: `bun install`, `bun run dev`, `bun run build`. CLI package uses bun for development but ships as a standard Node-compatible npm package.
- **Base UI + Tailwind**: Headless Base UI primitives styled with Tailwind CSS. No shadcn/ui, no Radix — Base UI is the sole primitive system.
- **`cn` utility**: All conditional class logic uses `cn()` (clsx + tailwind-merge).

---

## 3. Workstream Structure

The build is divided into three concurrent workstreams. Each workstream has clear boundaries, shared interfaces, and can be developed by a separate coding agent.

### 3.1 Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                  SHARED FOUNDATIONS                       │
│  Supabase schema · Auth config · Types · Design tokens   │
│  Base UI primitives · cn utility · API types              │
└──────────┬──────────────┬──────────────┬────────────────┘
           │              │              │
     ┌─────▼─────┐  ┌────▼────┐  ┌─────▼──────┐
     │ WORKSTREAM │  │WORKSTREAM│  │ WORKSTREAM  │
     │     A      │  │    B    │  │     C       │
     │  Landing   │  │   CLI   │  │  Core App   │
     │   Page     │  │ Package │  │  (Feed,     │
     │            │  │         │  │  Profiles,  │
     │            │  │         │  │  Leaderboard│
     │            │  │         │  │  etc.)      │
     └────────────┘  └─────────┘  └─────────────┘
```

### 3.2 Shared Foundations (Must Be Done First)

Before any workstream begins, the following must be in place:

1. **Supabase project setup**: Database schema, storage buckets, auth config (magic link + GitHub OAuth)
2. **Shared TypeScript types**: `types/` directory with interfaces for User, Post, DailyUsage, etc.
3. **Supabase client utilities**: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
4. **`cn` utility**: `lib/utils/cn.ts` — `clsx` + `tailwind-merge`
5. **Tailwind config**: Design tokens, font loading, custom properties
6. **Base UI setup**: Portal isolation (`isolation: isolate` on root), iOS 26+ body relative positioning
7. **API route types**: Shared request/response interfaces for all API endpoints

### 3.3 Workstream Interfaces

Each workstream depends on the others only through well-defined interfaces:

| Interface | Producer | Consumer |
|-----------|----------|----------|
| `/api/auth/cli/*` endpoints | Workstream C | Workstream B |
| `/api/usage/submit` endpoint | Workstream C | Workstream B |
| Supabase DB schema | Shared Foundations | All |
| Auth redirect to `/feed` | Workstream C | Workstream A |
| `/signup` and `/login` routes | Workstream C | Workstream A |
| TypeScript types | Shared Foundations | All |

---

## 4. Shared Foundations

### 4.1 Authentication (Supabase Auth)

**Methods:**
- **Email magic link**: User enters email → receives magic link → clicks to authenticate
- **GitHub OAuth**: One-click signup, auto-fills GitHub username

**Supabase Auth Configuration:**
```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**Auth Callback Route** (`app/(auth)/callback/route.ts`):
- Handles magic link and OAuth redirects
- Exchanges code for session
- Redirects new users to `/feed` (profile completion nudge shown in-app)
- Redirects existing users to `/feed`

**Profile Completion:**
- New users land directly in the feed after signup
- A persistent banner/nudge appears: "Complete your profile to appear on the leaderboard"
- Required for leaderboard: `username` (unique)
- Required for regional leaderboard: `country`
- Optional: `display_name`, `bio`, `avatar_url`, `link`, `github_username`

### 4.2 Onboarding Flow

```
1. Sign up (email magic link or GitHub OAuth)
2. Supabase Auth creates auth.users record
3. Database trigger creates public.users record with auth.uid
4. User lands in /feed
5. "Complete your profile" nudge shown
6. User can set:
   - Username (unique, alphanumeric + underscores, 3-20 chars) — REQUIRED for leaderboard
   - Country (ISO 3166-1 alpha-2) — REQUIRED for regional leaderboard
   - Display name, bio, avatar, link, github_username — OPTIONAL
7. User can dismiss nudge and browse feed immediately
```

### 4.3 Profile Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `username` | string | For leaderboard | Unique, 3-20 chars, alphanumeric + underscore |
| `display_name` | string | No | Shown if set, otherwise username |
| `bio` | string | No | Max 160 chars, single line |
| `avatar_url` | string | No | URL to uploaded image or GitHub avatar |
| `country` | string | For regional leaderboard | ISO 3166-1 alpha-2 code |
| `region` | enum | Auto | Derived from country (see 4.4) |
| `link` | string | No | Personal website, max 200 chars |
| `github_username` | string | No | Auto-filled if GitHub OAuth |
| `is_public` | boolean | Yes | Default: `true` |
| `timezone` | string | Yes | IANA timezone, auto-detected on signup |

### 4.4 Region Mapping

Countries map to regions for leaderboard filtering:

| Region | Countries |
|--------|-----------|
| `north_america` | US, CA, MX, + Caribbean, Central America |
| `south_america` | BR, AR, CL, CO, PE, etc. |
| `europe` | UK, DE, FR, ES, IT, NL, PL, etc. |
| `asia` | CN, JP, KR, IN, SG, ID, etc. |
| `africa` | NG, ZA, EG, KE, etc. |
| `oceania` | AU, NZ, FJ, etc. |

Store a `countries_to_regions` lookup table in the database. Country is optional — users without a country appear in the global leaderboard but not in any regional filter.

### 4.5 Environment Variables

```bash
# Next.js
NEXT_PUBLIC_APP_URL=https://straude.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic (for AI caption generation)
ANTHROPIC_API_KEY=

# CLI
CLI_JWT_SECRET=

# FLUX (for asset generation at build time)
BFL_API_KEY=
```

---

## 5. Workstream A: Landing Page

### 5.1 Overview

A single-page scroll landing page at `/` (the root route). Converts visitors into signups. Styled differently from the core app — inspired by [superpower.com](https://superpower.com/) with bold typography, large sections, and a strong CTA. Uses `#DF561F` (burnt orange) as the primary accent color.

**Route group:** `app/(landing)/page.tsx` with its own layout (`app/(landing)/layout.tsx`).

**Key behavior:** Authenticated users visiting `/` are redirected to `/feed`.

### 5.2 Page Sections (Scroll Order)

```
1. Navigation bar (sticky)
2. Hero section (bold headline + CTA + FLUX-generated static image)
3. Wall of Love (social proof — pre-rendered X post cards in masonry layout)
4. Features section (what Straude does)
5. How It Works (3-step flow: install CLI → push usage → share with community)
6. CTA section (final conversion push)
7. Footer
```

### 5.3 Navigation Bar

- **Left:** Bold text "STRAUDE" with geometric trapezoid mark (simple CSS/SVG, not a full logo)
- **Right:** "Log in" (text link) + "Get Started" (primary button)
- Sticky on scroll
- Transparent on hero, solid background after scroll
- Mobile: hamburger menu

### 5.4 Hero Section

- **Headline:** Large, bold. Example: "Track your Claude Code usage. Share your wins."
- **Subheadline:** One line. Example: "The social platform for AI-assisted coding."
- **CTA button:** "Get Started — It's Free" → links to `/signup`
- **Hero image:** Static image generated by FLUX.2 model at build time. The image should evoke **high-performance athlete** energy — think motion, power, determination, peak performance. Not nerdy or developer-centric. The visual metaphor is: coding with Claude is a competitive sport. Bold, graphic, warm tones with burnt orange accent.
- **Layout:** Text left, image right on desktop. Stacked on mobile.

### 5.5 Wall of Love

Social proof section showing real X (Twitter) posts from users praising Claude Code or the agentic engineering movement.

**Data source:** A markdown file at `content/wall-of-love.md` containing a list of X post URLs. This file is read at build time.

**Format of `wall-of-love.md`:**
```markdown
- https://x.com/username/status/123456789
- https://x.com/username/status/987654321
- ...
```

**Implementation:**
- At build time, the landing page reads the markdown file and renders pre-built static cards
- **No Twitter embed JS** — cards are static HTML/CSS
- Each card displays: user avatar (placeholder or fetched at build time), display name, @handle, post text (manually curated), and a relative timestamp
- Clicking a card opens the original X post in a new tab
- **Layout:** Masonry grid (CSS columns or CSS grid with `masonry` behavior via JS)
  - Desktop: 3-4 columns
  - Tablet: 2 columns
  - Mobile: 1 column
- Cards have subtle hover elevation
- Section title: "Loved by developers" or similar

**Card data structure** (in the markdown file or a companion JSON):
```typescript
interface WallOfLovePost {
  url: string;           // X post URL (click target)
  author_name: string;   // "Sarah Chen"
  author_handle: string; // "@sarahchen"
  author_avatar?: string;// URL to avatar image (optional, fallback to placeholder)
  text: string;          // Post text (manually curated, can be truncated)
  date: string;          // "Jan 15, 2026"
}
```

> **Note for agents:** The wall-of-love data will be provided separately. Build the component to accept an array of `WallOfLovePost` objects and render the masonry layout. Use placeholder data during development.

### 5.6 Features Section

3-4 feature cards in a grid. Each card has:
- An icon or small illustration
- A heading
- A short description (1-2 sentences)

**Features to highlight:**
1. **Track your usage** — "See exactly how much Claude Code you're using. Tokens, cost, models — all in one place."
2. **Share your wins** — "Post your daily coding sessions. Add screenshots, write about what you built."
3. **Compete on the leaderboard** — "See how you stack up globally and regionally. Daily, weekly, monthly rankings."
4. **Build your streak** — "Code with Claude every day. Your streak is your badge of honor."

### 5.7 How It Works Section

Three-step horizontal flow:

1. **Install & push** — `npx straude@latest push` — "One command. No install needed."
2. **Your post goes live** — "Usage stats are automatically shared with your followers."
3. **Climb the ranks** — "Track your streak, compete on the leaderboard, get kudos."

### 5.8 Final CTA Section

- Large heading: "Ready to show the world what you're building?"
- CTA button: "Create Your Account" → `/signup`
- Background: Accent color or dark

### 5.9 Footer

- Links: Privacy, Terms, GitHub (repo link)
- "Built with Claude Code" badge
- © 2026 Straude

### 5.10 FLUX Image Generation

The landing page workstream agent has access to the **Black Forest Labs FLUX.2** model for generating:
- **Hero image**: A bold, striking image that evokes **high-performance athlete** energy — motion, power, determination, peak performance. Think Strava/Nike aesthetic, not developer/hacker cliches. The metaphor: coding with Claude is a competitive sport. Warm tones with burnt orange accent.
- **Feature illustrations** (optional): Small icons or abstract graphics for each feature card. Same athlete/performance energy.
- **Background textures** (optional): Subtle patterns for section backgrounds.

Generated images should be saved to `public/images/` and committed. They are static assets, not generated at runtime.

---

## 6. Workstream B: CLI Package

### 6.1 Overview

A lightweight CLI tool that reads local ccusage data and pushes it to Straude. Designed for **zero-install usage** via `npx straude@latest` or `bunx straude`. Must have an extremely small bundle size.

### 6.2 Distribution

- **Published to npm** as `straude`
- **Runnable without installation:**
  - `npx straude@latest push` (npm/npx users)
  - `bunx straude push` (bun users)
- **Also installable globally** for users who prefer: `npm i -g straude` or `bun add -g straude`
- **Node-compatible**: Built with bun for development, but ships as a standard Node.js package (no bun runtime required on user machines)

### 6.3 Bundle Size Requirements

- **Target:** < 500KB unpacked
- **No heavy dependencies**: No framework dependencies, minimal npm packages
- Use native `fetch` (Node 18+) for HTTP
- Use native `crypto` for hashing
- Only essential dependency: `ccusage` as a library (or read its data files directly)

### 6.4 Commands

#### `straude login`

Opens a browser-based OAuth flow to authenticate with Straude.

```bash
$ npx straude@latest login

Opening browser for authentication...
Waiting for confirmation... ✓

Logged in as @username
Token saved to ~/.straude/config.json
```

**Flow:**
1. CLI calls `POST /api/auth/cli/init` → receives `{ code, verify_url }`
2. CLI opens browser to `https://straude.com/cli/verify?code=XXXX-YYYY`
3. User is already logged in (or logs in via Supabase Auth)
4. User clicks "Authorize CLI"
5. Server marks code as verified, generates JWT
6. CLI polls `POST /api/auth/cli/poll` → receives `{ token, status: "completed" }`
7. CLI saves token to `~/.straude/config.json`

**Token storage:**
```json
// ~/.straude/config.json
{
  "token": "eyJ...",
  "username": "ohong",
  "api_url": "https://straude.com"
}
```

#### `straude push`

Pushes usage data to Straude.

```bash
# Push today's usage
$ npx straude@latest push

Pushing usage for 2026-02-16...
  Cost: $47.82
  Tokens: 1,247,381 (input: 892k, output: 355k)
  Models: claude-sonnet-4-5-20250929, claude-opus-4-5-20250414
  Sessions: 3

✓ Posted! View at https://straude.com/post/abc123

# Push with options
$ npx straude@latest push --date 2026-02-15    # Specific recent date
$ npx straude@latest push --days 7             # Push last 7 days (first-run backfill)
$ npx straude@latest push --dry-run            # Preview without posting
```

**How it works:**
1. CLI uses ccusage as a library (or reads its local data files directly) to get usage data
2. Computes a SHA-256 hash of the raw usage data
3. POSTs to `/api/usage/submit` with data + hash + `source: "cli"`
4. Server stores `is_verified: true`
5. Server auto-creates a `post` record linked to the `daily_usage` record
6. CLI prints the post URL

**Date restrictions:**
- Default: today (in user's local timezone)
- `--date`: Any date within the last 7 days
- `--days N`: Push the last N days (max 7), useful for first-run cold start
- No backfilling beyond 7 days

#### `straude status`

Shows current user stats.

```bash
$ npx straude@latest status

@ohong
  Streak: 12 days 🔥
  This week: $187.23 · 4.2M tokens
  Global rank: #47
  
Last push: 2026-02-16 (today)
```

### 6.5 Package Structure

```
packages/cli/
├── src/
│   ├── index.ts           # Entry point (bin)
│   ├── commands/
│   │   ├── login.ts       # Browser OAuth flow
│   │   ├── push.ts        # Submit usage data
│   │   └── status.ts      # Check streak, rank
│   ├── lib/
│   │   ├── ccusage.ts     # ccusage data reader
│   │   ├── auth.ts        # Token management (~/.straude/config.json)
│   │   └── api.ts         # HTTP client for Straude API
│   └── config.ts          # Config file path, defaults
├── package.json
├── tsconfig.json
└── README.md
```

**`package.json` key fields:**
```json
{
  "name": "straude",
  "version": "1.0.0",
  "bin": {
    "straude": "./dist/index.js"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=18"
  }
}
```

### 6.6 ccusage Data Integration

The CLI reads data produced by the `ccusage` tool. Expected input from `ccusage daily --json`:

```typescript
interface CcusageOutput {
  type: "daily";
  data: DailyEntry[];
  summary: Summary;
}

interface DailyEntry {
  date: string;                    // "2026-01-28"
  models: string[];                // ["claude-sonnet-4-5-20250929"]
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUSD: number;
}

interface Summary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalTokens: number;
  totalCostUSD: number;
}
```

**Validation Rules:**
- `date` must be within the last 7 days (in user's timezone)
- `costUSD` must be >= 0
- All token counts must be >= 0
- `models` array must contain valid Claude model identifiers
- If entry for date already exists: **update** (upsert, not duplicate)

---

## 7. Workstream C: Core Web App

### 7.1 Overview

The main application behind authentication. Includes the feed, post detail view, user profiles, leaderboard, search, settings, and all social features. Uses the core app design system (Section 10).

**Route group:** `app/(app)/` with its own layout.

**Default view:** `/feed` — users land here after signup/login.

### 7.2 App Shell Layout

The core app uses a three-column layout on desktop, collapsing responsively:

```
┌─────────────────────────────────────────────────────┐
│ ┌──────────┬──────────────────┬───────────────────┐ │
│ │   LEFT   │      MAIN        │      RIGHT        │ │
│ │ SIDEBAR  │     CONTENT      │     SIDEBAR       │ │
│ │  240px   │    flexible      │      320px        │ │
│ │          │                  │                   │ │
│ │ • Logo   │  • Feed          │  • Your stats     │ │
│ │ • Nav    │  • Post detail   │  • Leaderboard    │ │
│ │ • Goal   │  • Profile       │    preview        │ │
│ │          │  • Leaderboard   │  • Suggested      │ │
│ │          │  • Search        │    users          │ │
│ │          │  • Settings      │                   │ │
│ └──────────┴──────────────────┴───────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Responsive behavior:**
- **Desktop XL (≥1440px):** 3-column, max-width 1600px, centered
- **Desktop (1200–1439px):** 3-column, sidebar collapsible to icons (80px)
- **Tablet (768–1199px):** 2-column (main + right sidebar), no left sidebar, top nav
- **Mobile (<768px):** Single column, bottom nav bar (fixed, 60px height)

**Left Sidebar:**
- Brand header: "STRAUDE" with geometric mark
- Nav items: Feed, Leaderboard, Profile, Settings
- Active item: left border accent (`4px solid #DF561F`)
- Bottom: "Current Goal" stat block (e.g., "420 lines optimized this week") — This is a placeholder for personal stats

**Right Sidebar:**
- "Your Week" stats card: total tokens, top percentage, cost
- Leaderboard preview: top 3-5 users with link to full leaderboard
- "Suggested Users" section: 3 users to follow (mutual followers, popular users)
- Footer: © 2026 Straude · Privacy · Terms

**Mobile Bottom Nav:**
- 4 items: Home (Feed), Leaderboard, Post (upload), Profile
- Fixed at bottom, 60px height, respects `safe-area-inset-bottom`

### 7.3 Feed

**Route:** `/feed`

The primary view. Displays posts from users the current user follows, ordered by `created_at DESC`.

**Feed Header (sticky):**
- Title: "Following"
- No filter tabs in v1

**Feed Items (Activity Cards):**

Each post in the feed is an activity card with:

1. **Header row:**
   - User avatar (40px circle)
   - Username (bold, clickable → profile)
   - Timestamp (relative: "2h ago")
   - Model used (e.g., "Claude Sonnet 4.5")
   - Verified badge (if CLI-submitted)

2. **Body:**
   - **Title** (if set by user, else generic placeholder like "Monday morning Claude coding")
   - **Description** (optional, max 500 chars, rendered as markdown — supports `code blocks`, **bold**, *italic*, and links)
   - **Images** (optional, 1-4 images in grid)
     - 1 image: full width
     - 2 images: 2 columns
     - 3 images: 2 columns, first spans 2 rows
     - 4 images: 2×2 grid

3. **Stats grid:**
   - 3 columns showing key metrics
   - Primary: **Cost** (e.g., "$47.82") in accent color
   - Secondary: **Tokens** (e.g., "1.2M")
   - Tertiary: **Sessions** or **Models used**
   - All stat values use `tabular-nums` and monospace font

4. **Actions row:**
   - ⚡ Kudos (count) — like button
   - 💬 Comment (count) — links to post detail
   - Share → (right-aligned) — copies post link

**Pagination:** Infinite scroll, 20 posts per page, cursor-based.

**Empty state:** "Follow some builders to see their posts here" with a link to search/suggested users. One clear next action (per baseline-ui rules).

### 7.4 Post Detail View

**Route:** `/post/[id]`

Full view of a single post with comments.

**Layout:** Same activity card as feed, but with:
- Full comment thread below
- Comment input at bottom

**Comments:**
- Flat list, ordered by `created_at ASC`
- Each comment: avatar (24px), username, content, timestamp
- Max 500 chars per comment
- Edit/delete own comments
- "Load more" pagination (20 per page)
- Comment input: text field + submit button

### 7.5 Posting Flow

Every usage upload (CLI or web) automatically creates a post that appears in followers' feeds.

**Flow:**
1. User submits usage data (via CLI `push` or web import at `/settings/import`)
2. `daily_usage` record created/updated (upsert on `user_id + date`)
3. `post` record auto-created, linked to `daily_usage_id`
4. Post immediately appears in followers' feeds with usage stats
5. User can optionally enhance the post:
   - Add/edit a **title** (max 100 chars)
   - Add/edit a **description** (max 500 chars, markdown supported)
   - Upload up to **4 images** (screenshots of what they were working on)
   - Use **"Generate caption"** button to have Claude draft a title + description based on uploaded images + usage stats

**Edit/Delete:**
- Users can edit title, description, and images at any time
- Users can delete their post (removes from feeds, retains `daily_usage` for leaderboard)
- If post is deleted, user can re-create from `/settings/import`

### 7.6 User Profile

**Route:** `/u/[username]`

**Sections:**

1. **Header:**
   - Avatar (80px on desktop, 64px mobile)
   - Username + display name
   - Bio (max 160 chars)
   - Country flag + name (if set)
   - External link (clickable)
   - GitHub link (if set)
   - Follow/Unfollow button
   - Stats row: Following count · Followers count · Activities count

2. **Stats Card:**
   - Global rank (if public and has username)
   - Regional rank (if public and has country)
   - Current streak (days) with 🔥 icon
   - Total spend (all-time)

3. **Contribution Graph:**
   - GitHub-style grid: 52 columns (weeks) × 7 rows (days)
   - Most recent week on right, Sunday at top
   - Cell size: 12×12px with 3px gap
   - Color intensity based on `cost_usd`:

   | Range | Color | Hex |
   |-------|-------|-----|
   | $0 (no usage) | Light gray | `#E5E5E5` |
   | $0.01 – $10 | Light orange | `#FDD0B1` |
   | $10.01 – $50 | Medium orange | `#F4945E` |
   | $50.01 – $100 | Burnt orange | `#DF561F` |
   | $100+ | Dark burnt orange | `#B8441A` |

   - Hover tooltip: date, cost, tokens (dark background, light text)
   - Click cell → navigate to that day's post (if exists)
   - Cells with posts have subtle border: `1px solid #999`
   - Horizontally scrollable on mobile

4. **Recent Posts:**
   - List of user's posts (same card format as feed)
   - Infinite scroll

### 7.7 Leaderboard

**Route:** `/leaderboard`

**Filters:**

| Filter | Options |
|--------|---------|
| Time period | Day, Week, Month, All-time |
| Region | Global, North America, South America, Europe, Asia, Africa, Oceania |

Region filter is only visible to users who have set a country. "Global" is the default for everyone.

**Table columns:**
- Rank (badge)
- Avatar (32px)
- Username (clickable → profile)
- Country flag (if set)
- Cost (USD) — **primary sort** (estimated Claude spend from ccusage)
- Tokens
- Streak (days)

**Rank badge styling:**
- #1: Gold gradient (`linear-gradient(135deg, #FFD700, #FFA500)`)
- #2: Silver gradient (`linear-gradient(135deg, #E8E8E8, #C0C0C0)`)
- #3: Bronze gradient (`linear-gradient(135deg, #DDA15E, #BC6C25)`)
- #4-10: Burnt orange solid (`#DF561F`, white text)
- #11+: Light gray (`#E5E5E5`, dark text)

**Behavior:**
- Click row → navigate to user profile
- Current user's row highlighted: `background: rgba(223, 86, 31, 0.12); border-left: 4px solid #DF561F;`
- Pagination: 50 per page
- Only public profiles shown (with username set)

**Mobile:** Leaderboard table becomes card list (stacked rows).

### 7.8 Social Features

#### Following
- Follow button on profile pages
- Following/followers lists on profile (paginated, 20 per page)
- Mutual follows indicated with a badge or text

#### Kudos (Likes)
- ⚡ icon on posts
- Click to kudos/un-kudos (toggle)
- Shows count
- Click count → modal with list of usernames who gave kudos
- Animation on kudos: scale pulse `1 → 1.2 → 1` on the icon, 200ms

#### Comments
- Flat list, ordered by `created_at ASC`
- Max 500 chars per comment
- Edit/delete own comments
- Load more pagination (20 per page)

### 7.9 Search

**Route:** `/search?q=`

- Search users by username
- Debounced input (300ms)
- Results show: avatar, username, bio snippet, follower count
- Click → navigate to profile
- Minimum 2 characters to search

### 7.10 Settings

**Route:** `/settings`

**Sections:**
- **Profile**: Edit all profile fields (username, display name, bio, avatar, country, link, github, visibility, timezone)
- **Import** (`/settings/import`): JSON paste form for web-based usage import (fallback for users who can't use CLI)

**JSON Import Flow:**
1. User runs: `ccusage daily --json --since YYYYMMDD --until YYYYMMDD`
2. Copies JSON output
3. Pastes into textarea at `/settings/import`
4. Server parses, validates schema, stores `is_verified: false`
5. Posts auto-created for each day's data

---

## 8. Data Model

### 8.1 Database Schema

```sql
-- Users (created via Supabase Auth trigger)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,                 -- NULL until user completes profile
  display_name TEXT,
  bio TEXT CHECK (char_length(bio) <= 160),
  avatar_url TEXT,
  country TEXT,                         -- ISO 3166-1 alpha-2, NULL until set
  region TEXT,                          -- Derived from country, NULL if no country
  link TEXT CHECK (char_length(link) <= 200),
  github_username TEXT,
  is_public BOOLEAN DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create user record on Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, github_username, avatar_url, timezone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'user_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(NEW.raw_user_meta_data ->> 'timezone', 'UTC')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Usage data (daily aggregates)
CREATE TABLE daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  cost_usd DECIMAL(10, 4) NOT NULL,
  input_tokens BIGINT NOT NULL,
  output_tokens BIGINT NOT NULL,
  cache_creation_tokens BIGINT DEFAULT 0,
  cache_read_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT NOT NULL,
  models JSONB DEFAULT '[]',           -- Array of model names used
  session_count INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT false,   -- true if submitted via CLI
  raw_hash TEXT,                       -- SHA-256 of raw ccusage data (CLI only)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Posts (user-facing content layer on top of daily_usage)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  daily_usage_id UUID REFERENCES daily_usage(id) ON DELETE CASCADE,
  title TEXT CHECK (char_length(title) <= 100),
  description TEXT CHECK (char_length(description) <= 500),
  images JSONB DEFAULT '[]',           -- Array of image URLs, max 4
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(daily_usage_id)               -- One post per day's usage
);

-- Follows
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Kudos (likes)
CREATE TABLE kudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Countries to regions lookup
CREATE TABLE countries_to_regions (
  country_code TEXT PRIMARY KEY,       -- ISO 3166-1 alpha-2
  country_name TEXT NOT NULL,
  region TEXT NOT NULL                  -- north_america, south_america, europe, asia, africa, oceania
);

-- CLI auth codes
CREATE TABLE cli_auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,           -- "XXXX-YYYY" format
  user_id UUID REFERENCES users(id),   -- Set when user verifies
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL       -- 10 minutes from creation
);

-- Indexes
CREATE INDEX idx_daily_usage_user_date ON daily_usage(user_id, date DESC);
CREATE INDEX idx_daily_usage_date ON daily_usage(date DESC);
CREATE INDEX idx_posts_user ON posts(user_id, created_at DESC);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_kudos_post ON kudos(post_id);
CREATE INDEX idx_comments_post ON comments(post_id, created_at ASC);
CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX idx_cli_auth_code ON cli_auth_codes(code) WHERE status = 'pending';
```

### 8.2 Row Level Security (RLS)

All tables must have RLS enabled. Key policies:

```sql
-- Users: public profiles readable by anyone, own profile editable
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON users FOR SELECT
  USING (is_public = true OR id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Posts: public users' posts readable by anyone, private users' posts by followers
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public posts are viewable by everyone"
  ON posts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = posts.user_id AND users.is_public = true)
    OR posts.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM follows WHERE follows.follower_id = auth.uid() AND follows.following_id = posts.user_id)
  );

CREATE POLICY "Users can manage own posts"
  ON posts FOR ALL
  USING (user_id = auth.uid());

-- Similar policies for kudos, comments, follows, daily_usage
```

### 8.3 Derived/Computed Data

**Streaks** — Computed on read. Consecutive days with usage data uploaded.

```sql
WITH ordered_dates AS (
  SELECT DISTINCT date
  FROM daily_usage
  WHERE user_id = $1
  ORDER BY date DESC
),
streak AS (
  SELECT date,
         date - (ROW_NUMBER() OVER (ORDER BY date DESC))::int AS grp
  FROM ordered_dates
)
SELECT COUNT(*) as streak_length
FROM streak
WHERE grp = (SELECT grp FROM streak ORDER BY date DESC LIMIT 1);
```

**Leaderboard aggregates** — Use materialized views refreshed periodically (every 15 minutes via Supabase cron or Vercel cron):

```sql
CREATE MATERIALIZED VIEW leaderboard_weekly AS
SELECT
  u.id as user_id,
  u.username,
  u.avatar_url,
  u.country,
  u.region,
  SUM(d.cost_usd) as total_cost,
  SUM(d.total_tokens) as total_tokens
FROM users u
JOIN daily_usage d ON d.user_id = u.id
WHERE u.is_public = true
  AND u.username IS NOT NULL
  AND d.date >= date_trunc('week', CURRENT_DATE)
GROUP BY u.id;

-- Similar views for daily, monthly, all_time
CREATE UNIQUE INDEX ON leaderboard_weekly (user_id);
```

---

## 9. API Specification

### 9.1 Authentication

**Web routes:** Supabase Auth handles session via cookies (SSR-compatible via `@supabase/ssr`).

**API routes:** Supabase session token in cookie (for web) or JWT in `Authorization: Bearer <token>` header (for CLI).

**CLI-specific routes** use a separate JWT issued by the Straude API (not a Supabase session).

### 9.2 Endpoints

#### CLI Authentication

```
POST /api/auth/cli/init
  Response: { code: string, verify_url: string }

POST /api/auth/cli/poll
  Body: { code: string }
  Response: { token?: string, status: "pending" | "completed" | "expired" }
```

#### Usage

```
POST /api/usage/submit
  Body: {
    entries: Array<{
      date: string,              // "2026-02-16"
      data: DailyEntry,          // ccusage data for that day
    }>,
    hash?: string,               // SHA-256 of raw data (CLI only)
    source: "cli" | "web"
  }
  Response: {
    results: Array<{
      date: string,
      usage_id: string,
      post_id: string,
      post_url: string
    }>
  }

GET /api/usage/today
  Response: DailyEntry | null
```

#### Posts

```
GET /api/feed
  Query: { cursor?: string, limit?: number }
  Response: { posts: Post[], next_cursor?: string }

GET /api/posts/[id]
  Response: Post (with user, kudos count, comment count, user's kudos status)

PATCH /api/posts/[id]
  Body: { title?, description?, images? }
  Response: Post

DELETE /api/posts/[id]
  Response: { success: true }
```

#### Social

```
POST /api/follow/[username]
  Response: { following: true }

DELETE /api/follow/[username]
  Response: { following: false }

GET /api/users/[username]/followers
  Query: { cursor?, limit? }
  Response: { users: User[], next_cursor? }

GET /api/users/[username]/following
  Query: { cursor?, limit? }
  Response: { users: User[], next_cursor? }

POST /api/posts/[id]/kudos
  Response: { kudosed: true, count: number }

DELETE /api/posts/[id]/kudos
  Response: { kudosed: false, count: number }

GET /api/posts/[id]/kudos
  Query: { cursor?, limit? }
  Response: { users: User[], next_cursor? }

POST /api/posts/[id]/comments
  Body: { content: string }
  Response: Comment

GET /api/posts/[id]/comments
  Query: { cursor?, limit? }
  Response: { comments: Comment[], next_cursor? }

PATCH /api/comments/[id]
  Body: { content: string }
  Response: Comment

DELETE /api/comments/[id]
  Response: { success: true }
```

#### Leaderboard

```
GET /api/leaderboard
  Query: {
    period: "day" | "week" | "month" | "all_time",
    region?: string,
    cursor?: string,
    limit?: number
  }
  Response: {
    entries: LeaderboardEntry[],
    user_rank?: number,
    next_cursor?: string
  }
```

#### Profile

```
GET /api/users/[username]
  Response: User with stats (streak, ranks, total_cost)

PATCH /api/users/me
  Body: { username?, display_name?, bio?, link?, country?, is_public?, timezone? }
  Response: User

GET /api/users/[username]/contributions
  Response: {
    data: Array<{ date: string, cost_usd: number, has_post: boolean }>,
    streak: number
  }
```

#### Search

```
GET /api/search
  Query: { q: string, limit?: number }
  Response: { users: User[] }
```

#### AI

```
POST /api/ai/generate-caption
  Body: { 
    images: string[],           // URLs of uploaded screenshots
    usage: DailyEntry           // Today's usage stats
  }
  Response: { title: string, description: string }
```

#### Upload

```
POST /api/upload
  Body: FormData (file)
  Response: { url: string }
```

---

## 10. Design System — Core App

The core app follows a **Swiss editorial** design language inspired by the HTML mockup: clean, structured, bold typography, black borders, minimal decoration. The accent color is `#DF561F` (burnt orange).

### 10.1 Color System

```css
:root {
  /* Core palette */
  --color-bg: #FFFFFF;
  --color-text: #000000;
  --color-accent: #DF561F;
  --color-secondary-blue: #7BD0E8;
  --color-secondary-yellow: #FDFFA4;
  --color-border: #000000;
  --color-muted: #666666;
  --color-subtle: #F5F5F5;
  --color-error: #C94A4A;
  
  /* Semantic */
  --color-highlight-row: rgba(223, 86, 31, 0.12);
  --color-hover: rgba(223, 86, 31, 0.05);
}
```

| Usage | Color |
|-------|-------|
| Page background | `#FFFFFF` (white) |
| Primary text | `#000000` (black) |
| Secondary/muted text | `#666666` |
| Borders (all structural) | `#000000` (1px solid) |
| Accent (CTAs, active states, stats) | `#DF561F` (burnt orange) |
| Hover states | `#F5F5F5` (subtle gray) or `rgba(223, 86, 31, 0.05)` |
| Highlight (current user row) | `rgba(223, 86, 31, 0.12)` with `4px solid #DF561F` left border |
| Error | `#C94A4A` |

### 10.2 Typography

**Font stack:**
```css
--font-main: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
```

**Font loading (Next.js):**
```typescript
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-main' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
```

**Type scale:**

| Element | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| Page title | Inter | 2.5rem (40px) | 500 | `letter-spacing: -0.03em`, `text-balance` |
| Section header | Inter | 1.25rem (20px) | 500 | `letter-spacing: -0.02em` |
| Post title | Inter | 1.25rem (20px) | 500 | |
| Body text | Inter | 1rem (16px) | 400 | `text-pretty` |
| Small body | Inter | 0.875rem (14px) | 400 | |
| Labels | Inter | 0.75rem (12px) | 600 | `text-transform: uppercase; letter-spacing: 0.05em` |
| Stat values | JetBrains Mono | 1.1rem (17.6px) | 500 | `tabular-nums` |
| Stat labels | Inter | 0.7rem (11.2px) | 400 | `text-transform: uppercase; color: #666` |
| Monospace/code | JetBrains Mono | 0.85rem (13.6px) | 400 | |
| Nav links | Inter | 1.1rem (17.6px) | 400 | |
| Button text | Inter | 0.875rem (14px) | 600 | |

### 10.3 Spacing

Use Tailwind's default spacing scale (multiples of 4px). No custom spacing tokens unless explicitly needed.

### 10.4 Borders & Dividers

- **Structural borders:** `1px solid #000000` — used on sidebar edges, card bottoms, section dividers
- **Action dividers:** `1px dashed #DDD` — used to separate action rows from content
- **No rounded corners on cards** — the editorial style uses sharp edges (`border-radius: 0`)
- **Exception:** Avatars are round (`border-radius: 50%`), buttons use `border-radius: 4px`

### 10.5 Component Specifications

#### Activity Card (Post)

```
┌─────────────────────────────────────────┐
│ [avatar] Username              2h ago   │
│          Claude Sonnet 4.5  ✓ Verified  │
│                                         │
│ Post Title Goes Here                    │
│                                         │
│ Description text in markdown...         │
│                                         │
│ ┌─────────────┬─────────────┐           │
│ │   image 1   │  image 2    │           │
│ └─────────────┴─────────────┘           │
│                                         │
│ ┌──────────┬──────────┬──────────┐      │
│ │ Cost     │ Tokens   │ Sessions │      │
│ │ $47.82   │ 1.2M     │ 3        │      │
│ └──────────┴──────────┴──────────┘      │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│ ⚡ Kudos (24)  💬 Comment (3)  Share → │
└─────────────────────────────────────────┘
```

- Container: `border-bottom: 1px solid #000; padding: 1.5rem`
- Header: flex row, avatar (40px circle) + user meta + timestamp
- Stats grid: `grid-template-columns: repeat(3, 1fr); gap: 1rem`
- Actions: flex row, dashed top border, `gap: 1.5rem`

#### Verified Badge

Small indicator next to model name on verified posts:
```css
display: inline-flex;
align-items: center;
gap: 4px;
font-size: 0.75rem;
font-weight: 600;
color: #DF561F;
```

Shows a checkmark icon (Lucide `CheckCircle`, 12px) + "Verified" text, or just the icon in compact views.

#### Buttons

**Primary (CTA):**
```css
background: #DF561F;
color: white;
padding: 0.5rem 1rem;
border-radius: 4px;
font-weight: 600;
font-size: 0.875rem;
border: none;
/* Hover: darken 10% */
/* Active: darken 15% */
/* Disabled: 50% opacity */
```

**Secondary:**
```css
background: transparent;
color: #000000;
border: 1px solid #000000;
padding: 0.5rem 1rem;
border-radius: 4px;
/* Hover: background #F5F5F5 */
```

**Ghost:**
```css
background: transparent;
color: #000000;
border: none;
padding: 0.5rem 1rem;
/* Hover: color #DF561F */
```

#### Input Fields

```css
background: #FFFFFF;
border: 1px solid #000000;
border-radius: 4px;
padding: 0.75rem 1rem;
font: 400 1rem/1.5 Inter;
color: #000000;

/* Placeholder */
color: #666666;

/* Focus */
border-color: #DF561F;
box-shadow: 0 0 0 3px rgba(223, 86, 31, 0.15);
outline: none;

/* Error */
border-color: #C94A4A;
```

#### Tabs (Leaderboard Filters)

```css
/* Tab container */
display: flex;
gap: 0;
border-bottom: 1px solid #000000;

/* Tab item */
padding: 0.75rem 1.25rem;
font: 600 0.875rem/1 Inter;
color: #666;
border-bottom: 2px solid transparent;
cursor: pointer;

/* Tab active */
color: #DF561F;
border-bottom-color: #DF561F;

/* Tab hover */
color: #000;
```

#### Avatar

Sizes:
- XS: 24px (comments)
- SM: 32px (leaderboard rows)
- MD: 40px (post headers, search results)
- LG: 80px (profile page)
- XL: 120px (own profile)

All avatars are **circles** (`border-radius: 50%`). No geometric shapes — the mockup's octagonal avatars were artistic variation, not functional.

### 10.6 Icons

Use **Lucide React** icons consistently:

| Icon | Usage |
|------|-------|
| `Zap` | Kudos button |
| `MessageCircle` | Comment button |
| `Share2` | Share button |
| `CheckCircle` | Verified badge |
| `Flame` | Streak indicator |
| `TrendingUp` / `TrendingDown` | Rank change |
| `Globe` | Global leaderboard |
| `MapPin` | Location |
| `Link` | External link |
| `Github` | GitHub profile |
| `Calendar` | Date/contribution graph |
| `DollarSign` | Cost |
| `Activity` | Tokens |
| `Clock` | Sessions/time |
| `Search` | Search |
| `Settings` | Settings |
| `Home` | Feed |
| `Trophy` | Leaderboard |
| `User` | Profile |

Icon sizes: 16px (inline), 20px (buttons/nav), 24px (mobile nav)

### 10.7 Animation

Follow baseline-ui rules strictly:
- **Never add animation unless explicitly needed**
- Only animate `transform` and `opacity`
- Max 200ms for interaction feedback
- Use `motion/react` for JS animations (e.g., kudos pulse)
- Use `tw-animate-css` for entrance animations if needed
- Respect `prefers-reduced-motion`

**Specific animations:**
- Kudos button click: scale `1 → 1.2 → 1`, 200ms
- Card hover: subtle `box-shadow` increase (paint property — allowed for small local UI)
- Tab switch: underline position, 150ms `ease-out`
- Skeleton loading: shimmer gradient, 1.5s infinite

### 10.8 Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Desktop XL | ≥1440px | 3-column (240px + flex + 320px), max-width 1600px |
| Desktop | 1200–1439px | 3-column, left sidebar collapses to 80px icons |
| Tablet | 768–1199px | Main + right sidebar, top nav bar |
| Mobile | <768px | Single column, bottom nav (60px), full-width cards |

**Mobile adaptations:**
- Bottom nav: Home, Leaderboard, + (post/upload), Profile — fixed, `safe-area-inset-bottom`
- Leaderboard: card list instead of table rows
- Contribution graph: horizontally scrollable
- Images: stack vertically (1 column)
- Sidebars hidden

---

## 11. Design System — Landing Page

The landing page has a **different** visual style from the core app, inspired by [superpower.com](https://superpower.com/). Bold, marketing-focused, with large sections and strong CTAs.

### 11.1 Color System

| Usage | Color |
|-------|-------|
| Background | `#FFFFFF` (primary sections), `#000000` (dark sections), `#F7F5F0` (muted sections) |
| Text | `#000000` on light, `#FFFFFF` on dark |
| Accent | `#DF561F` (burnt orange) — CTAs, highlights |
| Muted text | `#666666` |

### 11.2 Typography

Use **Inter** for all landing page text (same as core app, but with larger display sizes):

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Hero headline | 4rem–6rem (responsive) | 700 | `letter-spacing: -0.04em`, `text-balance` |
| Hero subheadline | 1.25rem | 400 | `text-pretty`, `color: #666` |
| Section headings | 2.5rem–3rem | 600 | `letter-spacing: -0.02em` |
| Body text | 1.125rem | 400 | |
| Button text | 1rem | 600 | |
| Wall of love post text | 0.9375rem | 400 | |
| Footer | 0.875rem | 400 | `color: #666` |

### 11.3 Sections Layout

- Full-width sections that alternate background colors
- Maximum content width: 1280px, centered
- Generous vertical padding: 80-120px per section (desktop), 48-64px (mobile)
- Sections separated by visual contrast (color) rather than borders

### 11.4 CTA Buttons (Landing)

```css
background: #DF561F;
color: white;
padding: 1rem 2rem;
border-radius: 8px;  /* Slightly more rounded than core app */
font: 700 1rem/1 Inter;
border: none;
/* Hover: darken 10% */
/* Large size variant: padding 1.25rem 2.5rem, font-size 1.125rem */
```

### 11.5 Wall of Love Cards

```css
background: #FFFFFF;
border: 1px solid #E5E5E5;
border-radius: 12px;
padding: 1.25rem;
cursor: pointer;
transition: box-shadow 200ms ease-out;

/* Hover */
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
```

Card content:
- Author row: small avatar (32px) + name + @handle
- Post text: 0.9375rem, up to ~280 chars
- Date: small, muted

---

## 12. File Upload & Storage

### 12.1 Image Uploads (Post Screenshots)

**Constraints:**
- Max 4 images per post
- Max file size: 5MB per image
- Accepted formats: JPEG, PNG, WebP, GIF
- Images resized server-side: max 1920px on longest edge
- Stored in Supabase Storage bucket: `post-images`

**Upload flow:**
1. Client sends file to `POST /api/upload`
2. Server validates file type and size
3. Server resizes if needed (using Sharp)
4. Server uploads to Supabase Storage
5. Returns public URL
6. Client includes URL(s) when updating the post

### 12.2 Avatar Uploads

- Max file size: 2MB
- Accepted formats: JPEG, PNG, WebP
- Resized to 400×400px, cropped square
- Stored in Supabase Storage bucket: `avatars`

### 12.3 Storage Structure

```
supabase-storage/
├── avatars/
│   └── [user_id]/
│       └── avatar.[ext]
└── post-images/
    └── [user_id]/
        └── [post_id]/
            └── [uuid].[ext]
```

---

## 13. AI Integration (Claude Sonnet 4.5)

### 13.1 Scope

AI is integrated in the **post creation flow only** for v1. Users can invoke it to generate a title and description based on their uploaded screenshots and usage stats.

### 13.2 Generate Caption Feature

**Trigger:** User clicks "✨ Generate caption" button in the post editor, after uploading at least one screenshot.

**Input:**
- 1-4 uploaded images (screenshots of what the user was coding)
- Today's usage stats (cost, tokens, models, session count)

**Output:**
- A suggested `title` (max 100 chars, short and punchy — like a Strava workout title)
- A suggested `description` (max 500 chars, casual tone — like a Strava workout caption)

**API call:**

```typescript
// POST /api/ai/generate-caption
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 300,
  messages: [{
    role: "user",
    content: [
      // Include each screenshot as an image
      ...images.map(img => ({
        type: "image" as const,
        source: { type: "url" as const, url: img }
      })),
      {
        type: "text",
        text: `You are writing a short social post caption for a developer sharing their Claude Code usage stats on Straude (like Strava for coding).

Usage stats for today:
- Cost: $${usage.costUSD}
- Tokens: ${usage.totalTokens.toLocaleString()} (input: ${usage.inputTokens.toLocaleString()}, output: ${usage.outputTokens.toLocaleString()})
- Models: ${usage.models.join(', ')}
- Sessions: ${usage.sessionCount}

Based on the screenshots of what they were working on and the usage stats, write:
1. A short title (max 100 chars) — like a Strava workout title. Examples: "Morning refactor session", "Migrating to TypeScript", "Bug hunting in the auth layer"
2. A short description (max 500 chars) — casual, developer-friendly. Mention what was accomplished based on the screenshots. Keep it brief like a Strava caption.

Return as JSON: { "title": "...", "description": "..." }`
      }
    ]
  }]
});
```

**UX:**
- Button shows loading state while generating
- Generated title + description are pre-filled in the form fields
- User can edit before saving
- User can re-generate (re-click button)
- Generation is optional — user can always write their own

### 13.3 Cost Management

- Each generation call costs ~$0.01-0.05 depending on image sizes
- No rate limiting in v1 (monitor usage)
- Server-side only (API key never exposed to client)

---

## 14. Privacy & Visibility

### 14.1 Public Profiles (default)

- Appear in global and regional leaderboards (if username is set)
- Posts visible to anyone (even logged out)
- Profile page publicly accessible
- Can be followed by anyone

### 14.2 Private Profiles

- Do NOT appear in any leaderboard
- Posts only visible to followers
- Profile page shows limited info to non-followers: username, avatar, bio, follower count
- Usage stats, contribution graph, and posts hidden from non-followers

### 14.3 Data Visibility Matrix

| Data | Public User | Private User (to follower) | Private User (to non-follower) |
|------|-------------|---------------------------|-------------------------------|
| Username | ✓ | ✓ | ✓ |
| Bio | ✓ | ✓ | ✓ |
| Avatar | ✓ | ✓ | ✓ |
| Follower count | ✓ | ✓ | ✓ |
| Posts | ✓ | ✓ | ✗ |
| Usage stats | ✓ | ✓ | ✗ |
| Leaderboard rank | ✓ | ✗ | ✗ |
| Contribution graph | ✓ | ✓ | ✗ |

---

## 15. UI Quality Standards

All agents building UI for Straude MUST install and follow the [baseline-ui](https://www.ui-skills.com/skills/baseline-ui/) skill from [ui-skills](https://github.com/ibelick/ui-skills). Install via `npx ui-skills add baseline-ui` and apply it to every UI component. This enforces accessible primitives, consistent Tailwind defaults, safe animation patterns, and prevents AI-generated interface slop.

---

## 16. Out of Scope (v1)

- **Notifications** — No in-app, email, or push notifications
- **Teams/Organizations** — Individual accounts only
- **Achievements/Badges** — Deferred to v2
- **Challenges** — Deferred to v2
- **Direct Messages** — No private messaging
- **Blocking/Muting** — Basic moderation only
- **Dark Mode** — Deferred (design tokens are structured for it)
- **Mobile apps** — Web only (responsive)
- **Webhooks** — No external integrations
- **Export data** — No user data export
- **Account deletion** — Manual process via support
- **Feed filters** — No category/type filtering (all posts shown)
- **Follow approval flow** — Private users' posts are just hidden, no request flow
- **Pro/paid tier** — Everything is free in v1

---

## 17. Analytics

Use [Vercel Analytics](https://vercel.com/docs/analytics) to track page views, usage patterns, sign-ups, and engagement. No custom analytics implementation needed for v1.

---

## 18. Appendices

### Appendix A: CLI Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  User Terminal                    Straude Web                       │
│  ─────────────                    ───────────                       │
│                                                                     │
│  $ npx straude@latest login                                         │
│       │                                                             │
│       ├──► POST /api/auth/cli/init                                  │
│       │         │                                                   │
│       │         ▼                                                   │
│       │    Generate code: "XXXX-YYYY"                               │
│       │    Store in cli_auth_codes table                            │
│       │    (expires in 10 minutes)                                  │
│       │         │                                                   │
│       │    ◄────┘ { code, verify_url }                              │
│       │                                                             │
│       ├──► Open browser: straude.com/cli/verify?code=XXXX-YYYY      │
│       │                           │                                 │
│       │                           ▼                                 │
│       │                    User logs in (Supabase Auth)             │
│       │                           │                                 │
│       │                           ▼                                 │
│       │                    Confirm CLI access                       │
│       │                           │                                 │
│       │                           ▼                                 │
│       │                    Mark code as verified                    │
│       │                    Store user_id on code record             │
│       │                                                             │
│       ├──► Poll: POST /api/auth/cli/poll { code }                   │
│       │         │                                                   │
│       │         ▼                                                   │
│       │    Generate JWT for CLI use                                 │
│       │    (signed with CLI_JWT_SECRET)                             │
│       │         │                                                   │
│       │    ◄────┘ { token, status: "completed" }                    │
│       │                                                             │
│       ▼                                                             │
│  Save token to ~/.straude/config.json                               │
│                                                                     │
│  ✓ Logged in as @username                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Appendix B: Contribution Graph Spec

**Layout:**
- 52 columns (weeks) × 7 rows (days)
- Most recent week on right
- Sunday at top
- Cell size: 12×12px with 3px gap
- On mobile: horizontally scrollable

**Color scale (cost_usd):**

| Range | Color | Hex |
|-------|-------|-----|
| $0 (no usage) | Light gray | `#E5E5E5` |
| $0.01 – $10 | Light orange | `#FDD0B1` |
| $10.01 – $50 | Medium orange | `#F4945E` |
| $50.01 – $100 | Burnt orange | `#DF561F` |
| $100+ | Dark burnt orange | `#B8441A` |

**Tooltip:**
```css
background: #000000;
color: #FFFFFF;
padding: 8px 12px;
border-radius: 4px;
font: 400 14px/1.4 Inter;
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
```

**Tooltip content example:**
```
January 15, 2026
$47.82 · 1.2M tokens
```

**Interactions:**
- Hover: tooltip with date, cost, tokens
- Click: navigate to that day's post (if exists)
- Cells with posts have subtle border: `1px solid #999`

### Appendix C: Markdown Rendering in Descriptions

Post descriptions support a limited subset of markdown:
- **Bold** (`**text**`)
- *Italic* (`*text*`)
- `Inline code` (`` `code` ``)
- Code blocks (``` ``` ```)
- Links (`[text](url)`)
- Line breaks (double newline)

**No support for:** headings, images, tables, lists, blockquotes, HTML.

Use a lightweight markdown renderer (e.g., `react-markdown` with a restricted plugin set) to prevent XSS and keep rendering simple.

### Appendix D: Agent Setup Instructions

Each coding agent working on a Straude workstream should:

1. **Install baseline-ui skill:**
   ```bash
   npx ui-skills add baseline-ui
   ```

2. **Read Base UI docs:**
   - Quick start: https://base-ui.com/react/overview/quick-start
   - Components: https://base-ui.com/react/components
   - Each docs page has a "View as Markdown" link for LLM context

3. **Use FLUX.2 for image generation** (Workstream A only):
   - Access the Black Forest Labs FLUX.2 model API
   - Generate hero images, feature illustrations, background textures
   - Save to `public/images/`
   - Images should evoke **high-performance athlete** energy — motion, power, peak performance. Think Strava/Nike aesthetic, not developer/hacker imagery. Warm tones with burnt orange (`#DF561F`) accent.

4. **Use Anthropic API** (Workstream C only, for AI caption feature):
   - Model: `claude-sonnet-4-5-20250929`
   - Server-side only
   - See Section 13 for the prompt and integration pattern

5. **Follow this spec exactly** — do not introduce additional UI libraries, design patterns, or features not specified here.
