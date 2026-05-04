# Mission: improve Straude activation

**Started:** 2026-05-04
**Goal:** Drive CLI activation (% of users who push at least once) from ~47% toward ~75% by removing the four error classes surfaced in PostHog, plus add tracking, plus a scheduled 7-day check-in.

## Context

PostHog analysis (last 7 days, 103 CLI users):

- 53% of users (55) install Straude and never push once
- `$exception` is the #1 event with 1,723 occurrences across 73 users
- Three errors explain almost all failures:
  - `ccusage is not installed or not on PATH` — 1,627 events / 14 users
  - `write EPIPE` — 48 events / 48 users (every active user once)
  - `Session expired or invalid` — 33 events / 9 users
  - `Date X is outside the 30-day backfill window` — 13 events
- Among activated users, retention is strong: 69% pushed 2+ days, 17% pushed 6 of 7 days

## Out of scope

- Re-engaging the 55 stuck users (deferred)
- Any non-CLI / non-web code
- New features unrelated to activation

## Verification commands

- `bun run typecheck` (monorepo)
- `bun run test` (monorepo)
- `bun run build` (monorepo)
- `bun run --cwd packages/cli test` (CLI vitest)

## Milestones

### 1. CLI resilience + activation tracking — M (~25–35 min)

**Goal:** Stop swallowing EPIPE on every active user; add events needed to measure activation.

**Changes:**
- `packages/cli/src/index.ts` `main()`: register `process.stdout.on('error', …)` and stderr handlers — exit 0 on EPIPE.
- `packages/cli/src/lib/auth.ts`: add `installed_at` to `StraudeConfig`. If config doesn't exist yet at first run, write a separate marker (`~/.straude/.first-run`) so we don't lose the signal pre-login.
- `packages/cli/src/index.ts`: capture `cli_first_run` once per machine (gated by marker). Capture `cli_authenticated` on every invocation where a valid config loads.
- Tests in `packages/cli/__tests__/` for first-run gating and EPIPE handler.

**Acceptance:**
- `bun run --cwd packages/cli test` passes.
- Manual: `node packages/cli/dist/index.js --help | head -1` exits 0.
- Manual: deleting `~/.straude/` and running CLI captures exactly one `cli_first_run`; subsequent runs capture zero additional first-run events.

### 2. ccusage detect & install on first run — M (~30–45 min)

**Goal:** Replace the hard throw at `ccusage.ts:49-51` with a one-time interactive install prompt.

**Changes:**
- `packages/cli/src/lib/ccusage.ts`: when `isOnPath('ccusage')` is false, prompt user (TTY-only). On consent, run `npm install -g ccusage` (prefer `bun add -g` if bun present). Capture `ccusage_install_attempted` and `ccusage_install_succeeded`/`_failed`.
- Non-TTY (auto-push, CI): keep current throw with improved message.
- Tests for TTY/non-TTY branches, install success/failure, declined prompt.

**Acceptance:**
- `bun run --cwd packages/cli test` passes.
- Manual on a system without ccusage: `npx straude@latest` prompts; accepting installs ccusage; push proceeds.
- Manual non-TTY: `npx straude@latest push < /dev/null` throws cleanly with the install command.

### 3. Filter out-of-window backfill dates client-side — S (~10–15 min)

**Goal:** Stop submitting dates the server will reject.

**Changes:**
- `packages/cli/src/commands/push.ts`: after merging entries (~line 342), filter out entries older than `MAX_BACKFILL_DAYS`. If any dropped, log a single warning listing the dates. Do NOT throw.

**Acceptance:**
- New unit test: 60-day input → only last 30 days reach submit body.
- Existing push tests still pass.

### 4. Silent re-auth on 401 + sliding token refresh — L (~60–90 min)

**Goal:** Eliminate "Session expired" failures.

**Changes:**
- **Server** (`apps/web/app/api/usage/submit/route.ts` and `/api/cli/dashboard`): if JWT is older than 7 days, mint a fresh one via `createCliToken` and set `X-Straude-Refreshed-Token` response header.
- **Server helper** (`apps/web/lib/api/cli-auth.ts`): export `tokenAgeDays(token)`.
- **Client** (`packages/cli/src/lib/api.ts`):
  - On every successful response, read `X-Straude-Refreshed-Token`; persist via `saveConfig` and update in-memory config.
  - On 401: run `loginCommand(config.api_url)`, reload config, retry the request once. If retry also 401s, throw existing message.
  - Skip auto-relogin when stdin is non-TTY OR `process.env.STRAUDE_AUTO === '1'`.
- Tests: refresh-header path, 401-retry path, 401-then-401-throws path.

**Acceptance:**
- `bun run --cwd packages/cli test` and any web tests pass.
- `bun run typecheck` passes.
- Manual: token with `iat` >7 days old gets refreshed in `~/.straude/config.json` after a push.
- Manual: invalidated token triggers browser login automatically and push completes.

### 5. Schedule weekly activation check-in via PostHog — S (~15–20 min)

**Goal:** Auto-deliver an activation snapshot 7 days post-merge.

**Changes (PostHog only, via MCP):**
- Create a saved insight: activation funnel `cli_first_run` → `usage_pushed` (filtered to `cli_version >= 0.1.24`).
- Create a weekly subscription delivered to `oscar.hong7@gmail.com`.
- Test delivery via `subscriptions-test-delivery-create`.
- Note the insight URL + baseline values in the PR description.

**Acceptance:**
- Insight URL included in PR description.
- Test delivery succeeds.

### 6. Integration, verification & PR — S (~15–20 min)

**Goal:** Full sweep + open the PR.

**Changes:**
- Run from repo root: `bun run typecheck && bun run test && bun run build`.
- Smoke-test: full login → push → simulate 401 → confirm auto-reauth.
- Update `docs/CHANGELOG.md` under `## Unreleased` (Added/Changed/Fixed).
- Update `docs/DECISIONS.md`: (a) ccusage auto-install reverses prior security stance — note trade-off; (b) sliding token refresh design.
- Bump `packages/cli/package.json` version → `0.1.24`.
- Open PR titled `fix(cli): unblock activation — ccusage install, EPIPE, silent reauth, backfill filter`.

**Acceptance:**
- All three commands above exit 0.
- PR open with green CI.
- PR description includes activation baseline + scheduled-insight link + before/after summary per error class.

## Risk register

- **R1**: `npm install -g ccusage` requires sudo on some setups. → On EACCES, fall through to manual instruction. Don't escalate.
- **R2**: Server-side token refresh changes auth contract. → Header-based refresh is purely additive; older clients ignore it.
- **R3**: Auto-relogin opens browser unexpectedly during `--auto` background push. → Skip when stdin is non-TTY OR `STRAUDE_AUTO=1`.
- **R4**: PostHog scheduled subscription requires email integration. → Confirm via MCP; if unavailable, fall back to a notebook + manual reminder.
