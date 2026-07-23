# CLI Reference

The `straude` CLI pushes AI coding-agent usage data to Straude. Published on npm as [`straude`](https://www.npmjs.com/package/straude).

## Installation

```bash
# Run directly (no install needed)
npx straude@latest

# Or with bun
bunx straude

# Or install globally
npm install -g straude
```

**Requirements**: Node.js >= 20

## Quick Start

```bash
# First run: authenticates via browser, then syncs the last 3 days
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
| `--non-interactive` | Never open a browser or wait for login |

**Date range logic:**

| Condition | Range pushed |
|-----------|-------------|
| `--date` specified | That single date |
| `--days N` specified | Last N days (capped at 30) |
| Previously pushed today | Today only (re-sync) |
| Previously pushed before today | Next uncommitted date through at most 7 contiguous days |
| No previous push | Last 3 days |

The CLI does not automatically run a 30-day migration backfill. Use
`straude push --days 30` when you deliberately want the full server window.
When more than seven dates are pending, repeated normal runs advance the
committed watermark in contiguous chunks instead of skipping ahead.

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

**Note:** This command calls the CLI-authenticated `GET /api/cli/dashboard` endpoint.

### `straude devices`

List unresolved installation-identity candidates, or resolve one explicitly:

```bash
straude devices
straude devices merge <candidate-uuid>
straude devices keep-separate <candidate-uuid>
```

Straude only auto-merges installations when their normalized hostnames match,
at least two overlapping dates have identical source-level accounting, and no
overlap diverges. Ambiguous candidates are quarantined from new accounting until
you choose whether to merge them or keep them separate.

### Automatic sync

```bash
straude --auto                 # Install a daily launchd/cron job
straude --auto --time 14:30    # Choose a local run time
straude --auto hooks           # Install a Claude Code SessionEnd hook
straude --no-auto              # Disable the configured mechanism
straude auto                   # Show current configuration
straude auto logs              # Print scheduler logs
```

The OS scheduler uses launchd on macOS and cron on Linux. It is not available
on Windows. Claude Code hooks are independent of the OS scheduler.

## Global Options

| Flag | Description |
|------|-------------|
| `--api-url URL` | Override the API URL (useful for local development) |
| `--timeout N` | Set the ccusage subprocess timeout in seconds (default 240) |
| `--debug` | Write diagnostic detail to stderr |
| `--help`, `-h` | Show help text |
| `--version`, `-v` | Show CLI version |

## Data Sources

Straude invokes its installed `ccusage` native binary once per sync. Supported
collector versions are stable releases `>=20.0.18`:

```bash
ccusage daily --json --since YYYYMMDD --until YYYYMMDD --no-offline --by-agent --timezone IANA_TIMEZONE
```

The unified report automatically detects and combines every source ccusage supports. Source and model IDs are preserved as generic strings, so later stable releases can add them without a Straude allowlist change.

ccusage owns local path discovery, source-format parsing, deduplication, token accounting, model aliases, and per-model cost calculation. Straude validates the unified daily JSON, preserves each row's `metadata.agents`, and submits the aggregate token buckets, models, and model cost breakdown. The raw local logs and paths are never uploaded.

Online LiteLLM pricing is required, so model prices can change independently of
the installed collector code. If ccusage reports missing prices, falls back to
its embedded snapshot, or emits nonzero-token Claude/Codex usage at zero cost,
Straude retries within a bounded 60-second recovery budget and submits nothing
unless live pricing becomes complete. Other sources may legitimately be free.

A SHA-256 hash of the ccusage version, detected sources, date range, and raw unified JSON is sent for deduplication.

## Configuration

Auth tokens and sync state are stored in `~/.straude/config.json` with `0o600` permissions (owner read/write only).

```json
{
  "token": "eyJhbG...",
  "username": "ohong",
  "api_url": "https://straude.com",
  "last_push_date": "2026-03-11",
  "usage_protocol_v2_migration_completed_at": "2026-07-23T18:00:00.000Z"
}
```

| Field | Description |
|-------|-------------|
| `token` | CLI JWT token from login |
| `username` | Username at time of login |
| `api_url` | API base URL (default: `https://straude.com`) |
| `last_push_date` | Last contiguous committed date (the smart-sync watermark) |
| `usage_protocol_v2_migration_completed_at` | Marks completion of the bounded v2 migration sync |

## Multi-Device Support

Each installation has a durable UUID in `~/.straude/machine_id`, created with
`0o600` permissions. Usage is reconciled per installation and aggregated into
`daily_usage`, so multiple machines add to the same day without overwriting one
another. Installation aliases are user-scoped, so switching Straude accounts on
one machine does not transfer or collide with the first account's usage. Legacy
`device_id` values in the config are sent once as
`previous_device_id` so existing rows can be reassigned safely.

Pending v2 requests are durably stored in `~/.straude/pending-sync.json` before
submission. A sync lock prevents overlapping writers, and dates requested by a
second automatic run are queued for the lock holder. Committed outcomes advance
the watermark; retryable or unresolved dates remain in the outbox with the same
request ID and content hash. Permanently rejected dates are removed from the
retry queue, while the contiguous watermark stays behind the failed date.

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

### "No usage data found"

ccusage did not detect local activity in the selected date range. Confirm the coding agent has created local usage logs and check that source's path or environment-variable setup in the [ccusage data-source guide](https://ccusage.com/guide/).

## Platform support

The packaged CLI is tested on Linux, macOS, and Windows under Node 20 and 22.
Straude resolves ccusage's platform-specific native package directly. The
Windows config path is `%USERPROFILE%\.straude\config.json`; macOS and Linux use
`~/.straude/config.json`.

Automatic OS scheduling is limited to launchd on macOS and cron on Linux.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Command completed successfully, including `--help` and `--version` |
| `1` | Permanent input, configuration, collection, or identity error |
| `2` | A non-interactive command requires authentication |
| `75` | Retryable network, service, pricing, lock, or unresolved partial failure |

When output is piped to a reader that closes early, an `EPIPE` exits cleanly and
preserves an error status already set by the command.

## Telemetry

The CLI sends operational events to Straude's PostHog project: command and CLI
version, success/failure outcome, stage timings, collector version and detected
source IDs, and aggregate counts such as days, tokens, and cost. It does not send
prompts, code, conversation content, or raw ccusage rows. Before transmission,
the configured home-directory prefix is replaced with `~` in free-form values.

Disable telemetry with either environment variable:

```bash
export STRAUDE_TELEMETRY_DISABLED=1
# or
export DO_NOT_TRACK=1
```

## Package and release verification

```bash
bun install --frozen-lockfile
bun run --cwd packages/cli typecheck
bun run --cwd packages/cli test
bun run --cwd packages/cli test:packaged
```

`test:packaged` performs a clean build through `npm pack`, installs the tarball
in a temporary project, checks the declared dependency range and actual
compatible collector version, runs that binary against the GPT-5.6 fixture,
submits to a local HTTP server, and
waits for the scorecard render. CI repeats the installed-tarball check on Linux,
macOS, and Windows with Node 20 and 22.

The normal gate remains frozen to `bun.lock`. A separate weekly/manual
`ccusage compatibility` workflow installs `ccusage@latest` in isolation and
runs the real fixture through the production parser. A new major is accepted
when its output passes; schema drift, missing paid-model pricing, or a run
beyond the 60-second budget fails.
The product runtime never invokes `npx ccusage@latest`.

The published `>=20.0.18` range affects dependency resolution on fresh installs.
An existing installation keeps its installed collector until Straude is
reinstalled or upgraded.

Tags of the form `straude@<package-version>` trigger the release workflow. It
publishes the exact matrix-tested tarball to npm with provenance and creates a
matching GitHub release containing the tarball and its `SHA256SUMS` digest.
Source maps are not shipped to npm or attached to the
release; they are retained as GitHub Actions artifacts. The workflow validates tags but never
creates them. Before the first release, configure `ohong/straude` and
`release-cli.yml` as the trusted publisher for the `straude` package on npm;
the workflow intentionally has no long-lived npm publish token.

## Benchmark

```bash
bun run --cwd packages/cli benchmark
bun run --cwd packages/cli benchmark:collector
```

The first harness packs and installs the CLI in isolation, warms filesystem
caches, then prints JSON with median and p95 `--version` process latency.
Override its default 15 samples with `STRAUDE_BENCH_ITERATIONS`.

The collector harness creates deterministic 1, 3, 7, and 30-day Codex fixture
sets and records the first process plus warm median/p95 for the lockfile-resolved ccusage
binary. Override its default seven warm samples with
`STRAUDE_COLLECTOR_BENCH_ITERATIONS`. It uses offline fixture pricing to isolate
local scan cost from network availability. CI archives these measurements;
accuracy tests gate the release, while benchmark thresholds are compared only
between runs on the same class of machine.

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_BACKFILL_DAYS` | 30 | Maximum days that can be pushed via `--days` flag |
| `DEFAULT_SYNC_DAYS` | 7 | Days synced automatically without `--days` flag |
| `POLL_INTERVAL_MS` | 2000 | Login poll interval (2s) |
| `POLL_TIMEOUT_MS` | 300000 | Login timeout (5 min) |
| `DEFAULT_API_URL` | `https://straude.com` | Default API base URL |
