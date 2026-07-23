# API Reference

Straude exposes 36 API route files with 49 HTTP method handlers, organized by category below. All routes live under `apps/web/app/api/`.

## Authentication Models

| Model | Description |
|-------|-------------|
| **Public** | No authentication required |
| **Session** | Supabase session cookie (authenticated user) |
| **CLI JWT** | `Authorization: Bearer <token>` from CLI login |
| **Admin** | Supabase session + user ID in `ADMIN_USER_IDS` env var |
| **Cron** | `Authorization: Bearer <CRON_SECRET>` |

## Rate Limiting

Best-effort in-process sliding window limiter, keyed by user ID or IP. Returns `429` with `Retry-After` header when exceeded, but it is not a shared/distributed abuse-control layer across multiple runtime instances.

| Bucket | Limit | Applied To |
|--------|-------|------------|
| `upload` | 10/min per user | `POST /upload` |
| `usage-submit` | 20/min per user | `POST /usage/submit` |
| `social` | 30/min per user | Comments, follows, kudos, reactions, messages |
| CLI init | 5/min per IP | `POST /auth/cli/init` |

---

## Auth

### `POST /api/auth/cli/init`

Start a CLI login flow. Returns a one-time code and browser verify URL.

- **Auth**: Public (rate limited 5/min per IP)
- **Request body**: None
- **Response**: `{ code: string, verify_url: string }`
- **Notes**: Code expires after 10 minutes.

### `POST /api/auth/cli/poll`

Poll for CLI login completion.

- **Auth**: Public
- **Request body**: `{ code: string }`
- **Response**: `{ status: "pending" | "completed" | "expired", token?: string, username?: string }`

---

## Feed & Discovery

### `GET /api/feed`

Paginated feed of posts with usage data, enriched with kudos and comment previews.

- **Auth**: Public for `type=global`; Session required for `type=following`
- **Query params**:
  - `type` — `global` (default), `following`
  - `cursor` — composite `"date|created_at"` for pagination
  - `limit` — 1–50, default 20
- **Response**: `{ posts: Post[], next_cursor?: string, pending_posts: Post[] }`
- **Notes**: `pending_posts` only included for authenticated users on the first page.

### `GET /api/leaderboard`

Ranked leaderboard entries with streaks.

- **Auth**: Public
- **Query params**:
  - `period` — `day`, `week` (default), `month`, `all_time`
  - `region` — optional region filter
  - `cursor` — cost threshold for pagination
  - `limit` — 1–100, default 50
- **Response**: `{ entries: LeaderEntry[], user_rank?: number, next_cursor?: string }`

### `GET /api/search`

Search public user profiles by username, display name, or GitHub username.

- **Auth**: Public (only returns public profiles)
- **Query params**:
  - `q` — search term, min 2 characters (sanitized for PostgREST safety)
  - `limit` — 1–50, default 20
- **Response**: `{ users: User[] }`
- **Notes**: Email-shaped queries are treated like normal search strings; there is no privileged exact-email fallback.

### `GET /api/mentions`

Autocomplete for @mentions — returns followed users matching a search term.

- **Auth**: Session
- **Query params**:
  - `q` — optional search term (lowercased, sanitized)
- **Response**: `{ users: User[] }` (max 8 results)

---

## Posts

### `GET /api/posts/[id]`

Fetch a single post with user, usage data, kudos status, and comment count.

- **Auth**: Public
- **Response**: Full post object with `kudos_count`, `kudos_users`, `comment_count`, `has_kudosed`

### `PATCH /api/posts/[id]`

Update a post's title, description, or images. Owner only.

- **Auth**: Session (owner)
- **Request body** (all optional):
  - `title` — string (max 100 chars) or `null`
  - `description` — string (max 5000 chars) or `null`
  - `images` — array of URLs (max 10)
- **Response**: Updated post object
- **Side effects** (deferred): Photo achievement check, streak freeze for enriching bare posts, mention notifications and emails.

### `DELETE /api/posts/[id]`

Delete a post. Owner only.

- **Auth**: Session (owner)
- **Response**: `{ success: true }`

### `GET /api/posts/[id]/comments`

Paginated comment thread for a post.

- **Auth**: Public
- **Query params**:
  - `cursor` — pagination cursor
  - `limit` — 1–200, default 100
- **Response**: `{ comments: Comment[], next_cursor?: string }`

### `POST /api/posts/[id]/comments`

Add a comment to a post. Supports threaded replies.

- **Auth**: Session
- **Rate limit**: `social` (30/min)
- **Request body**:
  - `content` — string, 1–500 chars (required)
  - `parent_comment_id` — string (optional, for replies)
- **Response**: Comment object (status 201)
- **Side effects** (deferred): Comment notification + email, mention notifications + emails, achievement checks.

### `GET /api/posts/[id]/kudos`

Paginated list of users who gave kudos to a post.

- **Auth**: Public
- **Query params**:
  - `cursor` — pagination cursor
  - `limit` — 1–50, default 20
- **Response**: `{ users: User[], next_cursor?: string }`

### `POST /api/posts/[id]/kudos`

Give kudos to a post. Idempotent (duplicate insert ignored via unique constraint).

- **Auth**: Session
- **Rate limit**: `social` (30/min)
- **Response**: `{ kudosed: true, count: number }`
- **Side effects** (deferred): Kudos notification, achievement checks for giver and receiver.

### `DELETE /api/posts/[id]/kudos`

Remove kudos from a post.

- **Auth**: Session
- **Response**: `{ kudosed: false, count: number }`

### `GET /api/posts/[id]/share-image`

Generate a 1080x1080 PNG share card for a post.

- **Auth**: Public
- **Query params**:
  - `theme` — `light`, `dark`, or `accent`
- **Response**: PNG image with `Content-Disposition: attachment` header

---

## Comments

### `PATCH /api/comments/[id]`

Edit a comment. Owner only.

- **Auth**: Session (owner)
- **Rate limit**: `social` (30/min)
- **Request body**: `{ content: string }` (1–500 chars)
- **Response**: Updated comment object

### `DELETE /api/comments/[id]`

Delete a comment. Owner only.

- **Auth**: Session (owner)
- **Response**: `{ success: true }`

### `POST /api/comments/[id]/reactions`

React to a comment. Idempotent.

- **Auth**: Session
- **Rate limit**: `social` (30/min)
- **Response**: `{ reacted: true, count: number }`

### `DELETE /api/comments/[id]/reactions`

Remove a reaction from a comment.

- **Auth**: Session
- **Response**: `{ reacted: false, count: number }`

---

## Follow

### `POST /api/follow/[username]`

Follow a user.

- **Auth**: Session
- **Rate limit**: `social` (30/min)
- **Response**: `{ following: true }`
- **Side effects** (deferred): Follow notification.

### `DELETE /api/follow/[username]`

Unfollow a user.

- **Auth**: Session
- **Response**: `{ following: false }`

---

## Users

### `GET /api/users/me`

Fetch the authenticated user's full profile.

- **Auth**: Session
- **Response**: Full user profile object

### `PATCH /api/users/me`

Update the authenticated user's profile.

- **Auth**: Session
- **Request body** (all optional):
  - `username` — 3–20 chars, alphanumeric + underscores
  - `display_name` — string
  - `bio` — string (max 160 chars)
  - `heard_about` — string (max 500 chars) or `null`
  - `country` — ISO country code (auto-derives `region`)
  - `link` — string
  - `is_public` — boolean
  - `timezone` — string
  - `avatar_url` — string
  - `github_username` — string
  - `onboarding_completed` — boolean
  - `email_notifications` — boolean
  - `email_mention_notifications` — boolean
  - `email_dm_notifications` — boolean
- **Response**: Updated profile object
- **Side effects**: Welcome email on first onboarding completion, auto-follow top 3 users, referral attribution from cookie.
- **Errors**: `409` if username already taken.

### `GET /api/users/[username]`

Fetch a public user profile with stats.

- **Auth**: Public
- **Response**: Profile with `followers_count`, `following_count`, `posts_count`, `streak`, `total_cost`, `global_rank`, `regional_rank`, `is_following`

### `GET /api/users/[username]/contributions`

Last 52 weeks of daily usage data for a user's contribution graph.

- **Auth**: Public for public profiles; private profiles require owner or follower
- **Response**: `{ data: { date, cost_usd, has_post }[], streak: number }`

### `GET /api/consistency/[username]/image`

Generate a 1200x630 PNG consistency card for a profile.

- **Auth**: Public for public profiles; private profiles require the owner session
- **Query params**:
  - `download=1` — optional; adds `Content-Disposition: attachment`
- **Response**: PNG image suitable for preview, download, and sharing

### `GET /api/users/check-username`

Check if a username is available.

- **Auth**: Public (excludes current user's own row if authenticated)
- **Query params**: `username` — must match `/^[a-zA-Z0-9_]{3,20}$/`
- **Response**: `{ available: boolean, reason?: string }`

---

## Usage

### `POST /api/usage/submit`

Submit daily usage data. Protocol v2 is the primary CLI contract; legacy web
imports are adapted server-side during the migration.

- **Auth**: CLI JWT or Session
- **Rate limit**: `usage-submit` (20/min)
- **Protocol v2 request body**:
  ```json
  {
    "protocol_version": 2,
    "request_id": "019f8f0b-08ee-78d3-8063-19a0485cc61f",
    "source": "cli",
    "timezone": "America/Vancouver",
    "installation": {
      "id": "6e3d74e2-c82b-4ed4-81e3-96a76ce39d11",
      "name": "work-laptop"
    },
    "collector": {
      "name": "ccusage",
      "version": "20.0.18",
      "pricing_mode": "online"
    },
    "entries": [
      {
        "date": "YYYY-MM-DD",
        "content_hash": "0000000000000000000000000000000000000000000000000000000000000000",
        "agents": [{
          "agent": "codex",
          "models": ["gpt-5.6"],
          "input_tokens": 150000,
          "output_tokens": 50000,
          "reasoning_output_tokens": 0,
          "cache_creation_tokens": 0,
          "cache_read_tokens": 10000,
          "total_tokens": 210000,
          "cost_usd": 4.82,
          "model_breakdown": [{
            "model": "gpt-5.6",
            "input_tokens": 150000,
            "output_tokens": 50000,
            "reasoning_output_tokens": 0,
            "cache_creation_tokens": 0,
            "cache_read_tokens": 10000,
            "total_tokens": 210000,
            "cost_usd": 4.82
          }]
        }]
      }
    ]
  }
  ```
- **Validation**: Body size is capped at 256 KiB. Requests contain 1–32 unique
  dates inside the 30-day backfill window; token totals must equal their
  components; costs must be finite and non-negative; installation IDs are
  UUIDs; and every entry has a content hash.
- **Protocol v2 response**:
  `{ request_id, outcomes: [{ date, status, result?, error? }] }`. Status is one
  of `committed`, `unchanged`, `retryable_error`, `permanent_error`, or
  `identity_conflict`. Successful results include `usage_id`, `post_id`,
  `post_url`, and `action`.
- **Status codes**: `200` success, `207` mixed outcomes, `400` invalid request
  or permanent failure, `401` unauthorized, `403` authenticated-source
  mismatch, `409` installation identity conflict, `413` oversized body, `429`
  rate limited, `426` legacy protocol expired, and `503` retryable failure.
- **Side effects**: Reconciles installation-scoped daily usage transactionally,
  creates or updates posts, and schedules achievements and analytics after
  committed outcomes. Stable request IDs and entry hashes make retries
  idempotent.
- **Legacy cutoff**: Protocol v1 is routed through the same transactional
  function until `2026-08-06` by default (override with
  `STRAUDE_USAGE_V1_CUTOFF`). After the cutoff it receives `426` with the exact
  update command `npx straude@latest`.

### `GET /api/usage/devices`

List unresolved installation identity candidates for the authenticated user.

- **Auth**: CLI JWT or Session
- **Response**:
  `{ candidates: [{ id, device_id_a, device_id_b, normalized_hostname, overlap_dates, status, created_at }] }`
- **Notes**: Candidates remain quarantined from new aggregation until resolved.

### `POST /api/usage/devices/resolve`

Resolve an installation identity candidate.

- **Auth**: CLI JWT or Session
- **Request body**:
  `{ candidate_id: string, decision: "merge" | "keep_separate" }`
- **Response**:
  `{ candidate: { id, status, decision, canonical_device_id? } }`
- **Errors**: `400` invalid decision/UUID, `401` unauthorized, `404` candidate
  not found, `500` resolution failed.

### `GET /api/usage/status`

Aggregated usage stats for the authenticated user.

- **Auth**: Session
- **Response**: `{ has_data: boolean, cost_usd?: number, total_tokens?: number, session_count?: number, top_model?: string }`

### `GET /api/cli/dashboard`

Return the scorecard rendered by `straude status` and after a successful push.

- **Auth**: CLI JWT
- **Response**: Username, level, streak, 28 days of daily cost, current and previous week cost, leaderboard neighbors, model breakdown, and total output tokens.

---

## Notifications

### `GET /api/notifications`

Paginated notifications for the authenticated user.

- **Auth**: Session
- **Query params**:
  - `limit` — 1–50, default 20
  - `offset` — default 0
  - `type` — optional filter: `follow`, `kudos`, `comment`, `mention`, `referral`
- **Response**: `{ notifications: Notification[], unread_count: number }`
- **Notes**: Excludes `type=message` notifications (those are DM-specific).

### `PATCH /api/notifications`

Mark notifications as read.

- **Auth**: Session
- **Request body**: `{ all: true }` or `{ ids: string[] }`
- **Response**: `{ success: true }`

---

## Messages

### `GET /api/messages`

Fetch messages in a conversation with a specific user.

- **Auth**: Session
- **Query params**:
  - `with` — recipient username (must match `/^[a-zA-Z0-9_]{3,20}$/`)
  - `limit` — 1–200, default 100
- **Response**: `{ counterpart: User, current_user_id: string, messages: Message[] }`
- **Notes**: Private users only accessible if a conversation thread already exists.

### `POST /api/messages`

Send a direct message.

- **Auth**: Session
- **Rate limit**: `social` (30/min)
- **Request body**:
  - `recipientUsername` — string (required)
  - `content` — string (max 1000 chars, optional if attachments present)
  - `attachments` — array of `{ url, name, type, size }` (max 10, optional)
- **Response**: Message object (status 201)
- **Side effects** (deferred): DM notification email.

### `PATCH /api/messages`

Mark a conversation as read.

- **Auth**: Session
- **Request body**: `{ with: string }` (recipient username)
- **Response**: `{ success: true }`

### `GET /api/messages/threads`

List all DM conversation threads for the authenticated user.

- **Auth**: Session
- **Query params**:
  - `limit` — 1–100, default 50
- **Response**: `{ threads: Thread[], unread_count: number }`

---

## Upload

### `POST /api/upload`

Upload a file to Supabase storage. Supports images and DM file attachments.

- **Auth**: Session
- **Rate limit**: `upload` (10/min)
- **Content-Type**: `multipart/form-data`
- **Query params**:
  - `bucket` — `post-images` (default) or `dm-attachments`
- **Form fields**: `file` — the file to upload
- **Bucket limits**:

  | Bucket | Max size | Allowed types |
  |--------|----------|---------------|
  | `post-images` | 20 MB | JPEG, PNG, WebP, GIF, HEIC/HEIF |
  | `dm-attachments` | 10 MB | All image types + PDF, plain text, Markdown, CSV, JSON, ZIP |

- **Response**: `{ url: string, name: string, type: string, size: number }`
- **Notes**: HEIC/HEIF files auto-converted to JPEG. Magic-byte detection handles iOS MIME mislabeling.

---

## AI

### `POST /api/ai/generate-caption`

Generate a post title and description from screenshots using Claude.

- **Auth**: Session
- **Request body**:
  - `images` — array of URLs (1–10, must be hosted on Straude's Supabase storage)
  - `usage` — optional object with `costUSD`, `totalTokens`, `inputTokens`, `outputTokens`, `models`, `sessionCount`
- **Response**: `{ title: string, description: string }`
- **Notes**: Uses `claude-sonnet-4-6`. Image origins validated to prevent SSRF. Returns `503` if `ANTHROPIC_API_KEY` not configured or API unavailable.

---

## Prompts

### `GET /api/prompts`

List public prompt submissions.

- **Auth**: Session
- **Query params**:
  - `limit` — 1–50, default 20
  - `offset` — default 0
- **Response**: `{ prompts: Prompt[] }`

### `POST /api/prompts`

Submit a prompt.

- **Auth**: Session
- **Request body**:
  - `prompt` — string, 10–2000 chars (required)
  - `anonymous` — boolean (optional, default false)
- **Response**: Submission object (status 201)
- **Limits**: Max 10 submissions per 24 hours per user.

---

## Recap

### `GET /api/recap`

Fetch recap data for the authenticated user's usage summary card.

- **Auth**: Session
- **Query params**:
  - `period` — `week` (default) or `month`
- **Response**: Recap data object (spend, tokens, streak, models, contribution strip, etc.)

### `GET /api/recap/image`

Generate a 1200x630 PNG recap card image.

- **Auth**: Session
- **Query params**:
  - `period` — `week` or `month`
  - `bg` — background ID (selects from preset gradient backgrounds)
- **Response**: PNG image with `Content-Disposition: attachment` header

---

## Unsubscribe

### `GET /api/unsubscribe`

Render the unsubscribe confirmation page.

- **Auth**: Token-based (signed unsubscribe token in query param)
- **Query params**:
  - `token` — signed unsubscribe token (required)
  - `kind` — `comment` (default) or `dm`
- **Response**: HTML page confirming the unsubscribe

### `POST /api/unsubscribe`

One-click email unsubscribe. Disables the specified notification type without rendering the HTML confirmation page.

- **Auth**: Token-based (signed unsubscribe token in query param)
- **Query params**:
  - `token` — signed unsubscribe token (required)
  - `kind` — `comment` (default) or `dm`
- **Response**: `{ success: true }`
- **Errors**:
  - `400` — `{ error: "Missing token" }` or `{ error: "Invalid token" }`
  - `500` — `{ error: "Failed to update notification preferences" }`

---

## Admin

All admin routes require Supabase session authentication with a user ID present in the `ADMIN_USER_IDS` environment variable.

### `GET /api/admin/cohort-retention`

Weekly signup cohort retention grid (weeks 0–4).

- **Response**: Array of `{ cohort_week, cohort_size, week_0, week_1, week_2, week_3, week_4 }`

### `GET /api/admin/prompts`

List all prompt submissions with status counts.

- **Query params**:
  - `limit` — 1–200, default 50
  - `offset` — default 0
  - `status` — filter: `new`, `accepted`, `in_progress`, `rejected`, `shipped`, or `all`
- **Response**: `{ prompts: Prompt[], counts: { all, new, accepted, in_progress, rejected, shipped, hidden } }`

### `PATCH /api/admin/prompts/[id]`

Update a prompt submission's status or admin metadata.

- **Request body** (at least one required):
  - `status` — `new`, `accepted`, `in_progress`, `rejected`, `shipped`
  - `is_hidden` — boolean
  - `admin_notes` — string (max 2000 chars)
  - `pr_url` — string (max 500 chars)
- **Response**: `{ prompt: Prompt }`

### `GET /api/admin/revenue-concentration`

Revenue concentration by user segment (top 1/5/10 user spend share).

- **Response**: Array of `{ segment, user_count, total_spend, pct_of_total }`

### `GET /api/admin/time-to-first-sync`

Distribution histogram of time from signup to first CLI sync.

- **Response**: Array of `{ bucket, bucket_order, user_count }`

---

## Cron

All cron routes are protected by `Authorization: Bearer <CRON_SECRET>`.

### `GET /api/cron/nudge-inactive`

Send nudge emails to users who signed up ~24 hours ago but never pushed usage data. Runs hourly.

- **Response**: `{ sent: number, skipped: number, errors?: string[] }`

### `GET /api/cron/nudge-empty-profile`

One-shot endpoint: send "empty profile" nudge emails to onboarded users with no usage data.

- **Query params**:
  - `send` — `true` to actually send (default: dry-run)
- **Response (dry-run)**: `{ dry_run: true, would_send: number, users: { id, username }[] }`
- **Response (send)**: `{ sent: number, skipped: number, errors?: string[] }`

### `GET /api/cron/weekly-digest`

One-time manual endpoint to send weekly digest activation emails to unactivated users.

- **Query params**:
  - `send` — `true` to actually send (default: dry-run)
- **Response**: Digest send report
