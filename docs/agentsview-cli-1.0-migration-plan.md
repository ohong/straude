# AgentsView CLI 1.0 Migration Plan

**Status:** revised implementation plan for the agentsview migration branch
**Date:** 2026-05-08
**Decision:** pin Straude CLI usage collection to the latest stable agentsview release, v0.28.0, and make agentsview the default collector boundary for every agent it supports.

## Executive Summary

Straude should use agentsview as the single local usage collector. The CLI should stop maintaining two separate accounting paths, `ccusage` for Claude Code and `codex-native.ts` for Codex, and instead call agentsview once for the requested date range.

This is a product and architecture decision, not just a collector preference. Token parsing, session discovery, model pricing, and per-agent log-shape changes should belong to agentsview. Straude should own authentication, upload, profile/feed behavior, and presentation of the already-normalized daily totals.

The version pin for this branch is:

```ts
export const MIN_AGENTSVIEW_VERSION = "0.28.0";
```

v0.28.0 is the latest stable agentsview GitHub release as of 2026-05-08, published on 2026-05-06.

## Collector Boundary

Default CLI collection should become:

```bash
agentsview usage daily \
  --json \
  --breakdown \
  --offline \
  --since YYYY-MM-DD \
  --until YYYY-MM-DD \
  --timezone <local IANA timezone>
```

Important details:

- Do not pass `--agent`; the default collection path should include all agents agentsview auto-discovers.
- Keep `--breakdown` so Straude can persist per-model spend shares.
- Keep `--offline` for deterministic CLI behavior unless we later add an explicit online-pricing mode.
- Version-probe with `agentsview version` and fail clearly when the installed binary is missing or older than v0.28.0.
- Do not shell out to `ccusage`.
- Do not scan `~/.codex/sessions/` directly from Straude.
- Do not maintain a Straude-side model pricing table for local agent usage.

## Scope

### CLI

- Replace collector selection with a single agentsview path.
- Remove `STRAUDE_COLLECTOR=auto|agentsview|legacy` from the public interface.
- Remove `ccusage` install prompts, fallback logic, subprocess wrappers, and telemetry.
- Remove native Codex collection, repair flags, Codex pricing tables, fork/dedup code, and merge logic.
- Keep a generic parser for the agentsview daily JSON shape and rename ccusage-shaped types where practical.
- Submit all rows with `collector.unified = "agentsview-v1"`.
- Keep local date-range behavior: explicit `--date`, `--days`, smart sync from `last_push_date`, and max 30-day backfill.

### API

- Treat CLI-authenticated `collector.unified = "agentsview-v1"` as the trusted collector provenance for the new default CLI.
- Preserve validation for older `collector.claude = "ccusage-v18"` and `collector.codex = "straude-codex-native-v1"` only as backward compatibility for already-published CLI versions.
- Allow trusted agentsview rows to replace lower or higher same-device totals, because agentsview becomes the source of truth for that device/date.
- Keep the 30-day backfill window, `device_id` requirement, device aggregation, and post creation behavior unchanged.

### Product Copy And Docs

- Update CLI docs, privacy copy, and landing copy from "Claude Code and Codex" to "AI coding agents supported by agentsview."
- Replace ccusage privacy links with agentsview links where the copy describes the default CLI path.
- Keep manual import docs tolerant of old ccusage JSON only if the manual import page still supports it.

## Supported-Agent Surface

Straude should not encode a fixed allowlist in the CLI. Agentsview owns discovery. Current agentsview documentation lists support for:

- Claude Code
- Codex
- Copilot CLI
- Gemini CLI
- OpenCode
- OpenHands CLI
- Cursor
- Amp
- iFlow
- Zencoder
- VSCode Copilot
- Pi
- OpenClaw
- Kimi
- Kiro CLI
- Kiro IDE
- Cortex Code
- Hermes Agent
- Forge
- Warp
- Positron Assistant

If agentsview adds or removes support, Straude should pick that up through the dependency version, not through Straude code changes.

## Known Upstream Items

These are dependency risks to monitor, not reasons to keep local collectors:

- `wesm/agentsview#477` is open for archived Codex sessions not being counted.
- `wesm/agentsview#479` is an open PR to import archived Codex sessions.
- `wesm/agentsview#307` tracks cross-file message deduplication for continued sessions.

The migration still proceeds because the goal is to move collector correctness ownership upstream. If a blocker affects Straude users, the preferred fix is an agentsview version bump or upstream contribution, not reintroducing local Codex or Claude accounting logic.

## Tests

Required coverage for this branch:

- Agentsview parser accepts the `{ daily, totals }` JSON shape, computes missing `totalTokens`, preserves model breakdown costs, and rejects bad JSON/shape.
- Version parser accepts v0.28.0+ and rejects older stable versions.
- `push` fails clearly when agentsview is missing or outdated.
- `push` calls agentsview without `--agent`, with dashed dates, `--breakdown`, `--offline`, and local `--timezone`.
- `push` submits `collector.unified = "agentsview-v1"` and no `collector.claude` or `collector.codex`.
- Empty agentsview output exits without submitting.
- `/api/usage/submit` accepts trusted unified agentsview metadata from CLI auth.
- `/api/usage/submit` keeps rejecting unknown collector metadata.
- Backward compatibility tests cover older ccusage/native-Codex metadata until the minimum supported CLI version makes them safe to remove.

## Rollout

1. Land the version pin and planning-doc update.
2. Replace CLI collection with the agentsview-only path.
3. Update API trust semantics for `collector.unified = "agentsview-v1"`.
4. Remove dead collector files and tests.
5. Update user-facing docs and privacy copy.
6. Run CLI build/tests plus targeted `/api/usage/submit` tests.
7. Release with notes that users need agentsview v0.28.0 or newer on PATH.

## Explicit Non-Goals

- No Straude-maintained pricing table for agent usage.
- No fallback to ccusage.
- No fallback to native Codex parsing.
- No per-agent collection logic in Straude.
- No server-side recomputation of local collector costs.
