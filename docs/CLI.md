# CLI Reference

The `straude` CLI pushes AI coding usage data to Straude. Published on npm as [`straude`](https://www.npmjs.com/package/straude).

## Installation

```bash
# Run directly (no install needed)
npx straude@latest

# Or with bun
bunx straude

# Or install globally
npm install -g straude
```

**Requirements**: Node.js >= 18 and agentsview >= 0.28.0 on PATH.

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
| `--date YYYY-MM-DD` | Push a specific date (must be within last 30 days) |
| `--days N` | Push last N days (max 30) |
| `--dry-run` | Preview what would be submitted without actually posting |

**Date range logic:**

| Condition | Range pushed |
|-----------|-------------|
| `--date` specified | That single date |
| `--days N` specified | Last N days (capped at 30) |
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

## Data Source

The CLI uses agentsview as its routed local collector for every coding agent agentsview supports. The old ccusage and native Codex collector modules remain in the package as dormant revert code, but `straude push` no longer routes to them.

Agentsview is invoked without an agent filter:

```bash
agentsview usage daily --json --breakdown --offline --since YYYY-MM-DD --until YYYY-MM-DD --timezone <IANA>
```

`--offline` keeps the CLI deterministic and avoids a network pricing fetch. A SHA-256 hash of the raw agentsview output is sent for dedup.

### Daily JSON Adaptation

The CLI only adapts agentsview's daily JSON into Straude's submit shape. Agentsview owns agent discovery, token accounting, model mapping, and estimated spend. Straude records normalization anomaly counts for debug/telemetry, but `straude push` does not maintain per-agent pricing or parsing branches.

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

### "agentsview 0.28.0 or newer is required"

Install or upgrade agentsview, then retry:

https://www.agentsview.io/

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
