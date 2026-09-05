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

- Node 18+
- Local session data from any source supported by ccusage.

Straude invokes its installed [`ccusage`](https://github.com/ccusage/ccusage) dependency directly. The compatible `ccusage@^20.0.20` range owns source parsing, model recognition, token accounting, and pricing. No separate collector installation or source flag is needed.

## Supported coding agents

The bundled ccusage 20.0.20 release detects all 16 sources by default: **Claude Code, Codex, OpenCode, Amp, Droid, Codebuff, Hermes Agent, pi-agent, Goose, OpenClaw, Kilo, Kimi, Qwen, GitHub Copilot CLI, Gemini CLI, and Grok Build CLI**. You can sync any one source or combine several on the same day. Claude Code and Codex are optional.

For example, Gemini CLI sessions under `~/.gemini/tmp`, Qwen chats under `~/.qwen/projects`, and Grok sessions under `~/.grok/sessions` are collected automatically. ccusage also respects `GEMINI_DATA_DIR`, `QWEN_DATA_DIR`, and `GROK_HOME` overrides. Run `npx straude@latest --dry-run` to inspect collected totals before submitting them.

Straude preserves source IDs emitted by ccusage, including compatible custom IDs and sources added by later compatible releases. This does not add parsers for unsupported agents: **Mistral Vibe is not a built-in source in ccusage 20.0.20**. Support follows the installed collector release, not unreleased upstream documentation. See the [ccusage 20.0.20 source adapters](https://github.com/ccusage/ccusage/tree/v20.0.20/rust/adapters).

## Commands

### Default (smart sync)

```sh
straude
```

- First run: opens a browser tab to authenticate, then pushes today's usage.
- First run after the ccusage v20 migration: backfills the last 30 days once.
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
| `--date YYYY-MM-DD` | Push a specific date (must be within the last 30 days) |
| `--days N` | Push the last N days (max 30) |
| `--dry-run` | Collect usage without submitting it |

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

# Collect usage without submitting it
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

The CLI sends anonymous usage events (command name, CLI version, success/failure outcomes, aggregate counts like `days_pushed` and `total_cost_usd`) to Straude's PostHog project so we can prioritise features and catch regressions. We never send prompts, code, conversation content, file paths, or ccusage rows — home directory paths are scrubbed from any free-form payload before transmission.

To opt out, set either env var:

```sh
export STRAUDE_TELEMETRY_DISABLED=1
# or the unix-standard:
export DO_NOT_TRACK=1
```
