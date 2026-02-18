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
