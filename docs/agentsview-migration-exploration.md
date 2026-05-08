# Migrating Straude's Local Usage Collector to AgentsView

**Audience:** engineering and product
**Status:** target end-state for the active agentsview migration branch
**Last updated:** 2026-05-08
**Decision:** make agentsview Straude CLI's single routed local collector for all supported coding agents, while retaining the old collector modules as dormant revert code for now.

## Recommendation

Proceed with the agentsview-only runtime migration and pin the branch to agentsview v0.28.0, the latest stable upstream release as of 2026-05-08.

The older hybrid plan, agentsview for Claude plus Straude-native Codex plus ccusage fallback, solved the wrong problem. It reduced a little surface area while preserving most of the maintenance burden. If Straude still owns Codex parsing, Claude fallback behavior, model pricing exceptions, and merge semantics, then agentsview is not really the boundary. It is just another moving part.

The new boundary is simpler:

- Agentsview owns session discovery, token parsing, model mapping, and estimated spend.
- Straude owns auth, upload, social product behavior, and display.
- The CLI calls agentsview once for the requested date range.
- The server records `collector.unified = "agentsview-v1"` as the default collector provenance.

## Version Pin

Use agentsview v0.28.0 as the minimum supported version:

```ts
export const MIN_AGENTSVIEW_VERSION = "0.28.0";
```

The CLI should reject missing or older agentsview binaries with a clear install/upgrade message. There is no npm package for agentsview, so `npx straude@latest` cannot bring the collector along as an npm dependency. The operational requirement is "agentsview v0.28.0+ on PATH."

## Why This Is Worth Doing

### 1. It Removes Local Accounting Ownership

Straude currently carries collector logic in multiple places:

- `ccusage` subprocess and install/fallback handling for Claude Code.
- `codex-native.ts` for Codex JSONL scanning, fork/session deduplication, token-bucket normalization, and OpenAI model pricing.
- Merge logic in `push.ts` that combines different collector outputs into one daily row.
- Server trust carve-outs that know which collector may lower existing totals.

That is exactly the surface area this migration is meant to stop owning. Agents and model pricing change too quickly for Straude to be in the accounting business.

### 2. It Expands Straude Beyond Claude And Codex

Agentsview auto-discovers sessions across a broader set of coding agents. Current docs list:

| Agent | Session Directory |
|---|---|
| Claude Code | `~/.claude/projects/` |
| Codex | `~/.codex/sessions/` |
| Copilot CLI | `~/.copilot/` |
| Gemini CLI | `~/.gemini/` |
| OpenCode | `~/.local/share/opencode/` |
| OpenHands CLI | `~/.openhands/conversations/` |
| Cursor | `~/.cursor/projects/` |
| Amp | `~/.local/share/amp/threads/` |
| iFlow | `~/.iflow/projects/` |
| Zencoder | `~/.zencoder/sessions/` |
| VSCode Copilot | `~/Library/Application Support/Code/User/` on macOS |
| Pi | `~/.pi/agent/sessions/` |
| OpenClaw | `~/.openclaw/agents/` |
| Kimi | `~/.kimi/sessions/` |
| Kiro CLI | `~/.kiro/sessions/cli/` |
| Kiro IDE | `~/Library/Application Support/Kiro/` on macOS |
| Cortex Code | `~/.snowflake/cortex/conversations/` |
| Hermes Agent | `~/.hermes/sessions/` |
| Forge | `~/.forge/` |
| Warp | `~/.warp/` platform-dependent |
| Positron Assistant | `~/Library/Application Support/Positron/User/` on macOS |

Straude should not mirror this list in code. The list is product context; agentsview remains the implementation boundary.

### 3. It Makes Failure Modes Cleaner

The old plan had three local collectors and a selector:

- ccusage
- agentsview
- native Codex

Each could fail differently, produce different pricing, or require different trust rules. The new plan has one local collector failure mode: agentsview is missing, outdated, times out, or returns invalid JSON. That is boring in the best possible way.

## Updated Implementation Direction

### CLI

- Require agentsview v0.28.0+.
- Run `agentsview usage daily --json --breakdown --offline --since YYYY-MM-DD --until YYYY-MM-DD --timezone <local IANA timezone>`.
- Do not pass `--agent`; collect all supported agents by default.
- Remove `STRAUDE_COLLECTOR=auto|agentsview|legacy` from the routed CLI path.
- Stop calling ccusage install prompts and subprocess wrappers.
- Stop calling native Codex scanning, pricing, repair flags, and merge logic.
- Keep the ccusage and native Codex modules in the repo temporarily as dormant revert code.
- Submit only `collector.unified = "agentsview-v1"`.

### Server

- Treat CLI-authenticated `collector.unified = "agentsview-v1"` as trusted collector provenance for the new CLI.
- Keep older `ccusage-v18` and `straude-codex-native-v1` metadata valid only for backward compatibility with already-released CLI versions.
- Keep date validation, device aggregation, backfill limits, and post creation unchanged.

### Docs And Product

- Position the CLI as tracking "AI coding agents supported by agentsview", not just Claude Code and Codex.
- Replace ccusage default-path copy with agentsview copy.
- Keep claims precise: Straude receives daily aggregate totals, not prompts, code, file contents, or transcripts.

## Known Upstream Items To Watch

The latest stable pin does not mean upstream is frozen or perfect. Known items as of 2026-05-08:

- `wesm/agentsview#477`: Codex archived sessions are not counted.
- `wesm/agentsview#479`: open PR to import archived Codex sessions.
- `wesm/agentsview#307`: cross-file message deduplication for continued sessions.

These are exactly the kind of issues that should live upstream. Straude should monitor them and bump the minimum agentsview version when fixes land, rather than re-adding local collector branches.

## Work Scope

| Workstream | Change |
|---|---|
| Version pin | Set `MIN_AGENTSVIEW_VERSION` to `0.28.0`; update tests. |
| CLI collector | Replace ccusage/native Codex orchestration with one agentsview call. |
| Types | Prefer generic usage-entry names over ccusage-specific names where touched. |
| API | Trust `collector.unified = "agentsview-v1"` for CLI submissions; keep old metadata accepted for compatibility. |
| Tests | Replace hybrid collector tests with agentsview-only push, parser, version, and API tests. |
| Docs/copy | Update README, CLI docs, privacy, landing, and changelog text. |

## Non-Goals

- Do not build a Straude model-pricing table.
- Do not maintain per-agent parsers.
- Do not route to ccusage as a fallback.
- Do not route to native Codex as a fallback.
- Do not require Straude code changes when agentsview adds another supported agent.

## Decision Aid

This migration is blocked only if one of these becomes true:

| Signal | Response |
|---|---|
| agentsview v0.28.0 cannot produce daily JSON for normal Claude/Codex usage on dogfood machines | pause the cutover and contribute/fix upstream |
| agentsview install friction is unacceptable for first-run users | improve install guidance or installer detection, not local collectors |
| an upstream bug materially affects Straude users | pin to a fixed agentsview release when available, or contribute the fix upstream |
| `/api/usage/submit` rejects valid unified metadata | fix server validation before release |

The default answer should not be "bring back local accounting." That is the maintenance trap this migration is meant to escape.
