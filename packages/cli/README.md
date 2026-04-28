# straude CLI

Push your Claude Code usage stats to [Straude](https://straude.com).

## Quick start

```sh
npx straude@latest
# or
bunx straude
```

Running with no arguments performs a smart sync: logs you in if needed, then pushes any usage since your last sync.

## Requirements

- Node 18+
- [Claude Code](https://claude.ai/code) installed (provides the `ccusage` binary)

## Commands

### Default (smart sync)

```sh
straude
```

- First run: opens a browser tab to authenticate, then pushes today's usage.
- Subsequent runs: pushes all days since the last sync (up to 7 days).
- Already synced today: prints today's stats and exits.

### `login`

```sh
straude login
```

Authenticate with Straude via browser OAuth. Saves a token to `~/.straude/config.json`.

### `push`

```sh
straude push [options]
```

Push usage data to Straude.

| Flag | Description |
|---|---|
| `--date YYYY-MM-DD` | Push a specific date (must be within the last 7 days) |
| `--days N` | Push the last N days (max 7) |
| `--dry-run` | Preview what would be submitted without posting |

### `status`

```sh
straude status
```

Show your current streak, weekly spend, token usage, and global rank.

## Examples

```sh
# First-time setup
npx straude@latest

# Daily sync (run this from a cron job or shell startup)
straude

# See what would be pushed without posting
straude push --dry-run

# Backfill the last 3 days
straude push --days 3

# Push a specific date
straude push --date 2026-02-15

# Check your stats
straude status
```

## Config

Credentials are stored in `~/.straude/config.json` (mode `0600`, owner-only).

## Debug mode

Pass `--debug` (or export `STRAUDE_DEBUG=1`) to surface diagnostic detail
that's hidden by default — for example, per-row token-normalization
anomalies. Most of the time you don't need it; reach for it when something
in the output looks off and you want to know why.

```sh
straude push --debug
# or, persistent across invocations:
export STRAUDE_DEBUG=1
straude
```

Debug output is written to `stderr` so it doesn't interfere with piping the
normal output.

## Telemetry

The CLI sends anonymous usage events (command name, CLI version, success/failure outcomes, aggregate counts like `days_pushed` and `total_cost_usd`) to Straude's PostHog project so we can prioritise features and catch regressions. We never send prompts, code, conversation content, file paths, or ccusage rows — home directory paths are scrubbed from any free-form payload before transmission.

To opt out, set either env var:

```sh
export STRAUDE_TELEMETRY_DISABLED=1
# or the unix-standard:
export DO_NOT_TRACK=1
```
