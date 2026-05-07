# AgentsView CLI 1.0 Migration Plan

**Status:** implementation plan for the `agentsview-migration-cli-1.0` PR  
**Date:** 2026-05-01  
**Decision:** ship a safe hybrid migration in CLI 1.0: agentsview for Claude Code collection when supported, Straude native Codex collection for Codex until upstream parity proves safe.

## Executive Summary

The original exploration correctly identified agentsview as the right long-term consolidation target, but the 2026-05-01 verification pass found one blocking accuracy gap: agentsview v0.26.1 does not appear to preserve Straude's native Codex fork/session dedup behavior that fixed issue #87. Because issue #87 involved order-of-magnitude inflated spend for fork-heavy Codex users, CLI 1.0 must not replace `codex-native.ts` yet.

The 1.0 PR should still move forward, but as a hybrid:

- `STRAUDE_COLLECTOR=auto` probes agentsview quickly and uses it for Claude Code if agentsview >= 0.26.1 is installed.
- Codex stays on `straude-codex-native-v1`, including the one-time 30-day repair path and trusted server-side lowering behavior.
- If a Codex repair is pending, `auto` keeps the legacy ccusage + native Codex path for that run to minimize moving parts during repair.
- `STRAUDE_COLLECTOR=legacy` keeps today's ccusage + native Codex behavior.
- `STRAUDE_COLLECTOR=agentsview` requires agentsview >= 0.26.1 and uses agentsview for Claude Code plus native Codex for Codex.

This gives Straude a CLI 1.0 migration that improves maintainability without weakening the accuracy guarantees created after #87.

## Gaps Found In The Exploration

1. **Codex parity is not proven.** Agentsview v0.26.1 does not appear to read Codex `forked_from_id` or apply Straude's ancestor-signature dedup. It also appears centered on `last_token_usage`, while Straude native handles cumulative `total_token_usage` deltas. Native Codex stays.

2. **Offline pricing is narrower than the strategic claim.** `--offline` keeps the CLI deterministic and snappy, but it does not guarantee broad LiteLLM coverage on a fresh agentsview database. Online pricing improves coverage but adds a network fetch and timeout risk. CLI 1.0 should default to offline and document this tradeoff.

3. **Agentsview has no npm package.** The docs currently show pip, uvx, shell, PowerShell, and desktop installers, but `npm view agentsview` is still 404. `npx straude@latest` cannot assume npm-native installation.

4. **PATH is not enough.** A local machine can have agentsview v0.25.0 on PATH while v0.26.1 is current. CLI 1.0 must version-probe and require a minimum version before using the adapter.

5. **No schema version is advertised.** `usage daily --json` is ccusage-like but unversioned. The parser must be tolerant of extra fields and strict about required fields, finite costs, and nonnegative tokens.

6. **`--no-sync` is not a default perf win.** It can return stale data. The default should let agentsview sync; `--no-sync` belongs only in a future diagnostic mode after user-facing semantics are defined.

7. **Timezone correctness depends on source of truth.** Passing the local system timezone is better than nothing, but the ideal source is the user's Straude profile timezone. That requires a lightweight profile/config read or API response and should be follow-up work.

8. **Operational prerequisites need canary detail.** A post-deploy `/api/usage/submit` smoke test needs a canary CLI token/user, a stable canary `device_id`, and exclusion from leaderboards/open stats or cleanup logic. Otherwise the smoke test pollutes usage data.

9. **Manual import can double count.** The import page submits as a fixed `web-import` device. A later CLI push from the same real device sums with that web import. Import should become an override/replacement path or warn on dates that already have verified device rows.

10. **Some docs are stale.** `docs/API.md` still describes a 7-day backfill and optional `device_id`; the route now enforces a 30-day window and requires `device_id`.

## CLI 1.0 Implementation Scope

### Collector Selection

Default selection:

| Condition | Collector behavior |
|---|---|
| `STRAUDE_COLLECTOR=legacy` | ccusage for Claude, native Codex for Codex |
| `STRAUDE_COLLECTOR=agentsview` | agentsview for Claude, native Codex for Codex; fail if agentsview < 0.26.1 |
| `auto`, Codex repair pending | legacy path for that run |
| `auto`, agentsview >= 0.26.1 installed | agentsview for Claude, native Codex for Codex |
| `auto`, no supported agentsview | legacy fallback |

Agentsview invocation:

```bash
agentsview usage daily \
  --json \
  --breakdown \
  --agent claude \
  --offline \
  --since YYYY-MM-DD \
  --until YYYY-MM-DD \
  --timezone <local IANA timezone>
```

The version probe uses `agentsview version` with a short timeout so a broken agentsview install does not make `straude push` feel hung.

### Accuracy Rules

- Keep `packages/cli/src/lib/codex-native.ts` in CLI 1.0.
- Keep `collector.codex = "straude-codex-native-v1"` as the only trusted lowering collector on the server.
- Do not treat `collector.unified = "agentsview-v1"` as trusted for corrections.
- Do not mark `codex_native_repair_completed_at` from an agentsview-only Codex path.
- Keep unresolved Codex normalization rows blocked, exactly as today.

### Metadata

Submissions may contain:

```json
{
  "collector": {
    "claude": "agentsview-v1",
    "codex": "straude-codex-native-v1"
  }
}
```

Server behavior:

- Accept `claude: "ccusage-v18" | "agentsview-v1"`.
- Accept `codex: "straude-codex-native-v1"`.
- Accept `unified: "agentsview-v1"` for future compatibility but do not trust it for lowering totals.
- Reject unknown collector keys, non-string values, oversized metadata, and unknown collector values.
- Only allow trusted native Codex lowering when auth resolved through the CLI token path.

### Tests

Required test coverage:

- Agentsview parser accepts `{ daily, totals }`, computes missing `totalTokens`, preserves model breakdown costs, rejects bad JSON/shape.
- Agentsview adapter passes dashed dates, `--agent claude`, `--offline`, and `--timezone`.
- Version parser accepts v0.26.1+ and rejects v0.25.0.
- `auto` uses agentsview Claude + native Codex when supported and repair is complete.
- `auto` stays legacy when the native Codex repair is pending.
- Legacy collector behavior remains unchanged.
- `/api/usage/submit` accepts agentsview metadata.
- `/api/usage/submit` rejects unknown collector metadata.
- Native Codex correction remains the only lowering path.

## Follow-Up Consolidation Plan

Full consolidation can remove `codex-native.ts` only after these gates pass:

1. Upstream agentsview explicitly handles Codex `forked_from_id` ancestry or an equivalent dedup strategy.
2. A fork-heavy fixture based on #87 produces parity between native Codex and agentsview within $0.01/user-day.
3. Agentsview exposes enough source/agent attribution to avoid replacing mixed same-device Claude+Codex rows incorrectly.
4. A two-week dogfood parity soak shows median and 95p cost deltas under threshold.
5. `/api/usage/submit` 5xx alerting and a canary smoke test are live.

Only then should a follow-up PR remove `codex-native.ts` and move `collector.unified = "agentsview-v1"` into the trusted correction set.

## Upload And Stats Flow Improvements

These should be tracked as adjacent work because they improve the core "upload and see token usage + spend" loop:

1. **Make dry-run local-first.** `straude push --dry-run` should always show the local entries that would be submitted before it tries to fetch the dashboard. Today a successful dashboard fetch can hide the actual payload preview.

2. **Return post-submit dashboard data from `/api/usage/submit`.** The CLI currently submits, then performs a second dashboard fetch. Returning a compact dashboard snapshot in the submit response would make the perceived sync faster and avoid a second network round trip.

3. **Move lifetime stats to RPCs.** `/api/cli/dashboard`, `/api/usage/status`, profile pages, and share-card data still reduce broad row sets in application code. Use SQL/RPC totals for lifetime spend/tokens and keep row reads constrained to chart windows.

4. **Fix manual import semantics.** Web import should warn or reject dates that already have verified device rows, or intentionally replace a known device row. It should not silently add a synthetic `web-import` device that can double count later.

5. **Align verified copy and leaderboard semantics.** Manual import copy says unverified uploads do not count toward leaderboards, but leaderboard views currently aggregate spend without an `is_verified` filter. Either filter leaderboard queries or fix the copy.

6. **Fix upload-activity discovery.** The upload page looks for posts with `title IS NULL`, but usage submit now creates auto-titles. Query by empty description/images plus auto-title detection, or add an explicit `is_auto_title` marker.

7. **Expose collector provenance in debug/status output.** `straude push --debug` should show which collector path ran, agentsview version, pricing mode, timezone, and whether native Codex repair was active.

8. **Add an operational canary.** Create a non-public canary user/device for `/api/usage/submit` smoke tests. The smoke test should be excluded from public stats or clean up after itself.
