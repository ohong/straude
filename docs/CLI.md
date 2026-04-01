# CLI Reference

The `straude` CLI pushes Claude Code and Codex usage data to Straude. Published on npm as [`straude`](https://www.npmjs.com/package/straude).

## Installation

```bash
# Run directly (no install needed)
npx straude@latest

# Or with bun
bunx straude

# Or install globally
npm install -g straude
```

**Requirements**: Node.js >= 18

## Quick Start

```bash
# First run: authenticates via browser, then pushes last 3 days of usage
npx straude@latest

# Subsequent runs: pushes only new data since last sync
npx straude@latest
```

## Commands

### `straude` (default)

With no command argument, runs the push flow: logs in if needed, then syncs usage data.

### `straude login`

Authenticate with Straude via browser.

1. Opens a browser to the Straude verification page
2. Polls for confirmation every 2 seconds (up to 5 minutes)
3. Saves the auth token to `~/.straude/config.json`

```bash
straude login
straude login --api-url http://localhost:3000
```

### `straude push`

Push usage data to Straude. Same as running `straude` with no command.

```bash
straude push                  # Smart sync (same as bare `straude`)
straude push --days 3         # Push last 3 days
straude push --date 2026-03-08  # Push a specific date
straude push --dry-run        # Preview without posting
```

**Options:**

| Flag | Description |
|------|-------------|
| `--date YYYY-MM-DD` | Push a specific date (must be within last 7 days) |
| `--days N` | Push last N days (max 7) |
| `--dry-run` | Preview what would be submitted without actually posting |

**Date range logic:**

| Condition | Range pushed |
|-----------|-------------|
| `--date` specified | That single date |
| `--days N` specified | Last N days (capped at 7) |
| Previously pushed today | Today only (re-sync) |
| Previously pushed before today | Days since last push (capped at 7) |
| Never pushed before | Last 3 days (first-run backfill) |

### `straude status`

Show current usage stats and leaderboard rank.

```bash
straude status
```

Output:

```
@username
  Streak: 12 days
  This week: $48.20 · 2.5M tokens
  Global rank: #7

Last push: 2026-03-11 (today)
```

**Note:** This command calls `GET /api/users/me/status` which is a CLI-specific endpoint.

## Global Options

| Flag | Description |
|------|-------------|
| `--api-url URL` | Override the API URL (useful for local development) |
| `--help`, `-h` | Show help text |
| `--version`, `-v` | Show CLI version |

## Data Sources

The CLI collects usage from two sources in parallel:

### Claude Code (via `ccusage`)

Reads local Claude Code session data using the `ccusage` binary. Resolution order:

1. Direct `ccusage` binary on PATH (fastest, ~0.3s)
2. `bunx --bun ccusage@17` if running under Bun
3. `npx --yes ccusage@17` fallback

Runs: `ccusage daily --json --breakdown --since YYYYMMDD --until YYYYMMDD`

If no local Claude Code data directories exist, this source is silently skipped (enabling Codex-only users).

### Codex (via `@ccusage/codex`)

Reads OpenAI Codex usage data using `@ccusage/codex@18`.

Runs: `@ccusage/codex daily --json --since YYYYMMDD --until YYYYMMDD`

Failures are silent — Codex data is optional. Both sources run concurrently via `Promise.all`.

### Merge Logic

When both sources return data for the same date:

- Tokens (input, output, cache) are summed
- Models are unioned
- Costs are summed
- Per-model cost breakdowns are merged (falls back to even distribution when per-model data is unavailable)

A SHA-256 hash of the concatenated raw JSON output is sent for dedup.

### Token Normalization

The CLI includes a normalization engine that handles differences in how ccusage and Codex report token counts (e.g., Codex includes cached tokens inside `inputTokens` rather than reporting them separately). Anomalies are detected and reported:

- **High confidence**: Data is reliable
- **Medium/low confidence**: Warning printed, data still submitted
- **Unresolved**: Codex rows for that date are skipped entirely

## Configuration

Auth tokens and sync state are stored in `~/.straude/config.json` with `0o600` permissions (owner read/write only).

```json
{
  "token": "eyJhbG...",
  "username": "ohong",
  "api_url": "https://straude.com",
  "last_push_date": "2026-03-11",
  "device_id": "a1b2c3d4-...",
  "device_name": "MacBook-Pro.local"
}
```

| Field | Description |
|-------|-------------|
| `token` | CLI JWT token from login |
| `username` | Username at time of login |
| `api_url` | API base URL (default: `https://straude.com`) |
| `last_push_date` | Last successfully pushed date (for smart sync) |
| `device_id` | Auto-generated UUID on first push (for multi-device support) |
| `device_name` | Machine hostname (informational) |

## Multi-Device Support

When `device_id` is present, usage data is stored per-device in a `device_usage` table and aggregated into `daily_usage`. This means users who code on multiple machines see summed totals rather than one device overwriting the other.

The `device_id` is auto-generated on first push and stored in the config file.

## Troubleshooting

### "Session expired or invalid"

Your CLI token has expired. Re-authenticate:

```bash
straude login
```

### "Endpoint not found" (404)

Your CLI version may be outdated. Update:

```bash
npx straude@latest
```

### "No valid Claude data directories found"

This is non-fatal. The CLI will sync Codex usage only. If you expected Claude data, ensure you've used Claude Code on this machine (it stores sessions in `~/.config/claude/` or `~/.claude/`).

### ccusage is slow

If you see slow startup times, install ccusage globally for faster resolution:

```bash
npm install -g ccusage
```

### Windows support

The CLI uses `shell: true` on Windows for child process calls to resolve `.cmd` shims. The config path resolves to `%USERPROFILE%\.straude\config.json`.

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_BACKFILL_DAYS` | 30 | Maximum days that can be pushed via `--days` flag |
| `DEFAULT_SYNC_DAYS` | 7 | Days synced automatically without `--days` flag |
| `POLL_INTERVAL_MS` | 2000 | Login poll interval (2s) |
| `POLL_TIMEOUT_MS` | 300000 | Login timeout (5 min) |
| `DEFAULT_API_URL` | `https://straude.com` | Default API base URL |
