# straude CLI

Push your AI coding-agent usage stats to [Straude](https://straude.com).

## Quick start

```sh
npx straude@latest
# or
bunx straude
```

Running with no arguments performs a smart sync: logs you in if needed, then pushes any usage since your last sync.

## Requirements

- Node 20+
- Local session data from any source supported by ccusage.

Straude invokes its installed [`ccusage`](https://github.com/ccusage/ccusage) dependency directly. It accepts any stable release `>=20.0.18`, while the repository lockfile keeps CI reproducible. Fresh Straude installs can therefore resolve newer collector support, including a future major whose output still satisfies Straude's strict schema and accounting checks; an existing installation keeps its current `node_modules` until the package is reinstalled or upgraded. Live LiteLLM pricing is required, and Straude fails closed when Claude or Codex usage has tokens but no price. Straude uses ccusage's unified per-agent report, so future source and model IDs do not need a Straude allowlist update.

## Commands

### Default (smart sync)

```sh
straude
```

- First run: opens a browser tab to authenticate, then pushes the last 3 days.
- Subsequent runs: resume after the last committed date and process up to 7 contiguous days per run.
- Explicit backfill: `straude push --days 30` reads the maximum 30-day window.
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
| `--date YYYY-MM-DD` | Push a specific date (must be within the last 30 days) |
| `--days N` | Push the last N days (max 30) |
| `--dry-run` | Preview what would be submitted without posting |
| `--timeout N` | Set the ccusage timeout in seconds (default 240) |
| `--api-url URL` | Use a different Straude API origin |
| `--debug` | Print diagnostic detail to stderr |
| `--non-interactive` | Never open a browser or wait for login |

### `status`

```sh
straude status
```

Show your current streak, weekly spend, token usage, and global rank.

### `devices`

```sh
straude devices
straude devices merge <candidate-uuid>
straude devices keep-separate <candidate-uuid>
```

List or resolve ambiguous installation identities. Automatic merging requires
matching hostnames, at least two identical source-level overlap dates, and no
divergent overlap; ambiguous candidates remain quarantined until resolved.

### Automatic sync

```sh
straude --auto                 # Daily launchd/cron job
straude --auto --time 14:30    # Choose the local run time
straude --auto hooks           # Claude Code SessionEnd hook
straude --no-auto              # Disable the configured mechanism
straude auto logs              # Inspect scheduler output
```

The OS scheduler is supported on macOS and Linux. Claude Code hooks work anywhere Claude Code supports `SessionEnd`; Windows does not support the OS scheduler.

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
The installation UUID is stored separately in `~/.straude/machine_id`, so
deleting the config does not create a second logical device. Server aliases are
scoped to the Straude account, so account switches on the same machine remain
independent. Pending validated requests are stored in
`~/.straude/pending-sync.json` until each date commits.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Complete, empty, or safely coalesced work |
| `1` | Permanent input, configuration, collection, or identity error |
| `2` | Non-interactive authentication required |
| `75` | Retryable network, service, pricing, lock, or partial failure |

## Debug mode

Pass `--debug` (or export `STRAUDE_DEBUG=1`) to surface diagnostic detail
that's hidden by default. Most of the time you don't need it; reach for it
when something in the output looks off and you want to know why.

```sh
straude push --debug
# or, persistent across invocations:
export STRAUDE_DEBUG=1
straude
```

Debug output is written to `stderr` so it doesn't interfere with piping the
normal output.

## Telemetry

The CLI sends operational events (command name, CLI version, success/failure outcomes, timings, and aggregate counts such as `days_pushed` and `total_cost_usd`) to Straude's PostHog project. It does not send prompts, code, conversation content, or raw ccusage rows. The configured home-directory prefix is replaced with `~` in free-form telemetry before transmission.

To opt out, set either env var:

```sh
export STRAUDE_TELEMETRY_DISABLED=1
# or the unix-standard:
export DO_NOT_TRACK=1
```
