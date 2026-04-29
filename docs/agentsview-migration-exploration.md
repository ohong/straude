# Migrating Straude from `ccusage` to `agentsview` — Exploration Report

**Status:** Exploration only. No code changes.
**Date:** 2026-04-28
**Author:** Claude (research pass)

## TL;DR

`agentsview` (https://www.agentsview.io, MIT, https://github.com/wesm/agentsview)
is a local-first SQLite-backed analytics tool for AI coding agents. Its
`agentsview usage daily --json` output is **near-schema-compatible** with
`ccusage daily --json` — same field names (`inputTokens`, `outputTokens`,
`cacheCreationTokens`, `cacheReadTokens`, `totalCost`, `modelsUsed`,
`modelBreakdowns[].modelName`/`cost`). It also natively covers Codex and ~18
other agents from a single binary, and claims 80–220× faster reporting on large
session histories.

For Straude the migration is **technically small but strategically meaningful**:

- **Drop-in replacement of `runCcusage` is realistic** — `parseCcusageOutput`
  already understands the v18 shape that agentsview emits.
- It would let us **retire our custom `codex-native` JSONL collector**
  (`packages/cli/src/lib/codex-native.ts`, ~500+ lines of file-walking, hashing,
  pricing, normalization) in favor of one external binary that handles both
  Claude Code and Codex.
- It opens the door to supporting Cursor / Copilot / Gemini / Warp users with
  no per-agent collector code on our side — directly relevant to GTM and
  ROADMAP items.
- **Risk:** we'd be swapping one external CLI dependency we don't control
  (ccusage) for another (agentsview) with a younger track record. The schema
  match is reassuring but not guaranteed across versions.

**Recommendation:** Worth doing, but as an *additive* collector first
(`agentsview` as a third option alongside ccusage + codex-native), promoted to
default once we trust it. Estimated lift: **2–4 agent-days of focused work**
for a clean cutover, **5–7 agent-days** if we use the migration as a chance to
refactor the collector layer into a pluggable adapter (recommended).

---

## 1. Where Straude touches ccusage today

### Code (CLI package)

- `packages/cli/src/lib/ccusage.ts` (276 lines) — resolves the `ccusage` binary
  on PATH, runs `ccusage daily --json --breakdown --since … --until …`, parses
  the v18 output into our canonical `CcusageDailyEntry`, runs token
  normalization, surfaces anomalies.
- `packages/cli/src/lib/token-normalization.ts` — has a `source: "ccusage"`
  branch that assumes "separate" cache semantics (cache tokens *not* included
  in `totalTokens`), versus `source: "codex"` which treats them as included.
- `packages/cli/src/lib/codex-native.ts` — separate native collector that walks
  `~/.codex/sessions/`, parses JSONL, applies LiteLLM-style pricing, and
  produces the same `CcusageDailyEntry` shape. **Exists precisely because
  ccusage is Claude-only.**
- `packages/cli/src/commands/push.ts` — runs ccusage + codex-native in
  parallel, merges entries by date, hashes the raw payload, tags the
  submission with `collector.claude = "ccusage-v18"` /
  `collector.codex = "straude-codex-native-v1"`.
- `packages/cli/__tests__/ccusage.test.ts`, `commands/push.test.ts`,
  `flows/cli-sync-flow.test.ts` — coverage that pins the v18 shape.

### Code (web app)

- `apps/web/types/index.ts` — `CcusageDailyEntry`, `CcusageOutput`,
  `UsageCollectorMeta` (string-typed but with `"ccusage-v18"` /
  `"straude-codex-native-v1"` literals).
- `apps/web/app/api/usage/submit/route.ts` — server-side validator; mostly
  field-level, with one comment about ccusage log rotation.
- `apps/web/app/(app)/settings/import/page.tsx`,
  `apps/web/app/(app)/post/new/page.tsx` — UX copy telling users to paste
  `ccusage daily --json` output for manual imports. **The schema check at
  `import/page.tsx:46` requires `{ "type": "daily", "data": [...] }` — that's
  Straude's *normalized* shape, not raw ccusage v18, so this is unaffected.**

### User-facing copy / docs

- `apps/web/app/(landing)/cli/page.tsx` — install instructions naming
  `ccusage` and `@ccusage/codex` as upstream dependencies.
- `apps/web/app/(landing)/privacy/page.tsx`,
  `apps/web/components/landing/PrivacyPledge.tsx` — links to
  github.com/ryoppippi/ccusage and deepwiki/ryoppippi/ccusage as the
  "we don't read your prompts" anchor.
- `README.md`, `packages/cli/README.md`, `docs/CLI.md`, `docs/CHANGELOG.md`,
  `docs/DECISIONS.md`, `docs/straude-specs-v1.md` — historical references.

### Storage / DB

- `daily_usage` table fields (`cost_usd`, `input_tokens`, `output_tokens`,
  `cache_creation_tokens`, `cache_read_tokens`, `total_tokens`, `models`,
  `model_breakdown`, `collector_meta`) are **collector-agnostic**. Nothing in
  the schema needs migration.

---

## 2. What `agentsview` provides

Sourced from agentsview.io (CLI ref + Token Usage docs) and
github.com/wesm/agentsview.

### Install + invocation
- `pip install agentsview` / `uvx agentsview` / desktop `.dmg`/`.exe`/`.AppImage`.
- Local data lives in `~/.agentsview/` (SQLite + FTS5).
- Optional Postgres for team sync.

### `agentsview usage daily --json` output
```json
{
  "daily": [{
    "date": "2026-04-12",
    "inputTokens": 33410,
    "outputTokens": 142805,
    "cacheCreationTokens": 301223,
    "cacheReadTokens": 2984511,
    "totalCost": 9.6052,
    "modelsUsed": ["claude-opus-4-6", "gpt-5.1"],
    "modelBreakdowns": [{
      "modelName": "claude-opus-4-6",
      "inputTokens": 28102, "outputTokens": 124901,
      "cacheCreationTokens": 287441, "cacheReadTokens": 2812004,
      "cost": 8.4123
    }]
  }],
  "totals": { /* summed buckets */ }
}
```

### Schema diff vs ccusage v18 (what `parseCcusageOutput` already consumes)

| Field | ccusage v18 | agentsview | Compatible? |
|---|---|---|---|
| Top-level wrapper | `{ daily, totals }` | `{ daily, totals }` | ✅ identical |
| `daily[].date` | `YYYY-MM-DD` | `YYYY-MM-DD` (ISO 8601) | ✅ |
| Token bucket fields | `inputTokens`, `outputTokens`, `cacheCreationTokens`, `cacheReadTokens` | same | ✅ |
| `daily[].totalCost` | present | present | ✅ |
| `daily[].modelsUsed` | present | present | ✅ |
| `daily[].modelBreakdowns[].modelName` | present | present | ✅ |
| `daily[].modelBreakdowns[].cost` | present | present | ✅ |
| `daily[].totalTokens` | present | **not documented** | ⚠️ may need fallback (`input + output + cacheCreation + cacheRead`). Our normalizer already fills this when missing. |
| `reasoningOutputTokens` | absent | absent | ➖ Codex-only field; lives in our codex-native collector. agentsview docs don't surface it per-day, may need verification on Codex rows. |
| Per-model bucket-level token fields | absent | **present** (`inputTokens` etc inside `modelBreakdowns[]`) | 🎁 bonus precision we don't currently use |

### Useful flags
- `--since YYYY-MM-DD --until YYYY-MM-DD` (note: **dashed** dates, vs ccusage's
  `YYYYMMDD`). One-line change in `runCcusage`.
- `--breakdown` — same semantics.
- `--agent claude` / `--agent codex` — lets us call the binary once per agent
  *or* once for everything and split client-side by `modelsUsed`.
- `--all` — full history scan.
- `--offline` — skip LiteLLM pricing fetch (good for CI / airgapped).
- `--no-sync` — skip on-demand sync pre-query (perf lever).
- `--timezone <IANA>` — solves a class of midnight-bucketing bugs we currently
  punt on.

### Speed claim
Marketing says 80–220× faster than ccusage on large dbs, plausible because
agentsview pre-ingests JSONL into SQLite once and queries it indexed, while
ccusage rescans `~/.claude/projects` on every call. Worth measuring on
real user data before relying on it in copy.

---

## 3. Migration options (ranked)

### Option A — In-place swap of the `ccusage` binary call *(minimal)*
- Rename `lib/ccusage.ts` → keep, but add a resolver that prefers `agentsview`
  on PATH and falls back to `ccusage`.
- Change date format `YYYYMMDD` → `YYYY-MM-DD` for the agentsview branch.
- Change argv to `agentsview usage daily --json --breakdown --agent claude
  --since … --until …`.
- Keep `parseCcusageOutput` essentially unchanged; only add a `totalTokens`
  fallback when missing.
- **Lift:** ~0.5 agent-day. **Wins:** none beyond install ergonomics.
- **Loses:** doesn't retire codex-native, doesn't expand agent coverage.

### Option B — Single-collector cutover *(recommended baseline)*
- Replace **both** ccusage and codex-native with one `agentsview` invocation.
- Run `agentsview usage daily --json --breakdown --since … --until …` (no
  `--agent` filter). Split the rows into Claude vs Codex client-side from
  `modelsUsed` if we want to keep separate collector tags, or drop the per-
  vendor split entirely and just record `collector.unified = "agentsview-v1"`.
- Remove `codex-native.ts` (~500 lines), simplify `push.ts`'s parallel branch
  + merge logic, prune the `source: "codex"` branch in
  `token-normalization.ts` *if* we trust agentsview's normalization.
- Update tests, fixtures, types, and landing copy.
- **Lift:** 2–3 agent-days. **Wins:** less code we own, broader agent
  support comes "for free" the moment we whitelist more `modelsUsed` values.

### Option C — Pluggable collector adapter *(strategic)*
- Define a `Collector` interface in the CLI: `{ name, isAvailable(),
  collect(since, until): Promise<CollectorResult> }`.
- Adapters: `AgentsViewCollector`, `CcusageCollector` (compat),
  `CodexNativeCollector` (legacy fallback for users without agentsview
  installed).
- `push.ts` picks the highest-priority available collector or unions outputs
  with deterministic precedence + dedupe.
- Lets us A/B agentsview vs ccusage on the same machine for one release cycle
  to validate parity on real usage data.
- **Lift:** 5–7 agent-days. **Wins:** clean swap-out path for the *next*
  upstream change too; safer rollout; supports the GTM angle of "we work
  with whatever telemetry tool you have."

---

## 4. Concrete migration steps (Option B/C blended plan)

Each step is sized for a single Opus 4.7 agent unless noted. They are
parallelizable where marked **‖**.

1. **Spike & parity test (0.5d).** Install agentsview locally, run
   `agentsview usage daily --json --since 2026-03-01 --until 2026-04-28`,
   diff against `ccusage daily --json` for the same window on a real
   straude developer machine. Capture the diff in `docs/incidents/` as the
   parity baseline. *Critical: this de-risks everything below.*

2. **Adapter scaffolding (1d).** Introduce
   `packages/cli/src/lib/collectors/{types,agentsview,ccusage,codex-native}.ts`.
   Move existing logic in. Don't change behavior.

3. **AgentsView adapter (1d).** Implement
   `agentsview usage daily --json --breakdown --since YYYY-MM-DD --until
   YYYY-MM-DD --offline` execution (`--offline` for determinism in tests).
   Reuse 90% of `parseCcusageOutput`; add a `totalTokens` fallback and a
   `source: "agentsview"` branch in `token-normalization.ts` matching
   ccusage's "separate cache" semantics.

4. **Wire into `push.ts` (0.5d).** Resolver order:
   `agentsview` → `ccusage` + `codex-native` (legacy combo) → error. Tag
   submissions with `collector.unified = "agentsview-v1"` (new literal in
   `UsageCollectorMeta`).

5. **Tests ‖ (1d).** Fixture file from step 1 becomes the golden parser
   input. Mirror `ccusage.test.ts` for `agentsview.test.ts`. Update
   `commands/push.test.ts` to cover both resolver branches.

6. **Server-side acceptance ‖ (0.25d).** Extend
   `UsageCollectorMeta` and the validator in
   `apps/web/app/api/usage/submit/route.ts` to accept the new collector
   string. No DB migration needed.

7. **Landing + docs copy ‖ (0.5d).** Update
   `apps/web/app/(landing)/cli/page.tsx` install instructions,
   `apps/web/app/(landing)/privacy/page.tsx` and
   `apps/web/components/landing/PrivacyPledge.tsx` to mention agentsview as
   the recommended collector (link to MIT repo). Keep the ccusage link as
   "also supported." Update `README.md`, `packages/cli/README.md`,
   `docs/CLI.md`. Add a `docs/DECISIONS.md` entry per CLAUDE.md.

8. **Manual import path (0.25d).** `apps/web/app/(app)/settings/import/page.tsx`
   currently expects our normalized `{ "type": "daily", "data": [...] }`
   shape, not raw ccusage. Decide whether to *also* accept raw agentsview
   output here (small parser branch) — recommended for parity with the
   raw-ccusage paste flow we already implicitly support. Update copy
   accordingly.

9. **Soft launch (0.5d).** Ship behind an env flag
   (`STRAUDE_COLLECTOR=agentsview|legacy|auto`, default `auto` which prefers
   agentsview when present). Watch error rate on `/api/usage/submit` and the
   `daily_usage` cumulative-spend metric (north star) for a week.

10. **Retire codex-native (1d, deferred).** Once agentsview covers ≥95% of
    Codex submissions cleanly for two weeks, delete `codex-native.ts` and
    its tests. Keep the `source: "codex"` token-normalization branch around
    one extra release for backfill safety, then remove.

**Total: 5–6 agent-days for the additive rollout, +1 day cleanup.**
Option B (no adapter layer, hard cutover) trims ~2 days but skips the
parity-A/B-on-same-machine safety net.

---

## 5. Risks and open questions

- **Reasoning tokens for Codex.** Our codex-native collector tracks
  `reasoning_output_tokens` from the JSONL events. agentsview's documented
  schema doesn't surface this per-day. We need to grep the agentsview source
  (or `--help` output) to confirm whether it's bucketed into `outputTokens` or
  available under a separate flag. If lost, we degrade Codex precision —
  acceptable for cost (cost is correct because pricing is applied upstream)
  but visible in any "reasoning tokens" UI we add later.
- **`totalTokens` field.** Not in the documented agentsview JSON example. Our
  normalizer can compute it, but worth confirming on real output to avoid a
  silent zero.
- **`--since` date format mismatch.** ccusage takes `YYYYMMDD`, agentsview
  takes `YYYY-MM-DD`. Trivial, but a known footgun if any callers reuse the
  date string.
- **Pricing source.** agentsview uses LiteLLM pricing data with an offline
  fallback. Numbers may differ from ccusage's at the cent level for the same
  underlying tokens. North-star metric (cumulative `cost_usd`) could exhibit
  a one-time discontinuity at cutover. Mitigation: do not retroactively
  rewrite historical rows; let the discontinuity be a clean delineation.
- **Install friction.** ccusage is `npm install -g`, which our users already
  have. agentsview is `pip` / `uvx` / desktop installers. For npm-native
  users this is a worse onboarding step. Counter: keep ccusage as the
  fallback; agentsview becomes the upgrade path.
- **Upstream stability.** github.com/wesm/agentsview is single-maintainer
  (Wes McKinney). MIT license is fine. Versioning + release cadence
  unknown; the `agentsview-docs` repo split suggests it's still maturing.
  Pin a minimum CLI version in our resolver.
- **Hashing for dedupe.** `push.ts` SHA-256s the raw ccusage JSON for
  idempotency. agentsview output is byte-for-byte different even for the
  same logical day, so post-cutover hashes won't collide with pre-cutover
  ones. Not a correctness bug (the API upserts by `(user, date)`), just
  worth noting.

---

## 6. Engineering lift estimate (Opus 4.7 coding agents)

Assuming agents working in isolated worktrees with parallelism where marked:

| Path | Wall-clock with one agent | Wall-clock with team-of-3 ‖ |
|---|---|---|
| A. Binary swap only | 0.5d | 0.5d |
| B. Single-collector cutover | 2–3d | ~1.5d |
| C. Pluggable adapter (recommended) | 5–7d | 2.5–3d |
| C + retire codex-native | 6–8d | 3–4d |

The bottleneck isn't code volume — it's the **parity verification step**
(agentsview vs ccusage vs codex-native on real session histories) and the
**soft-launch monitoring window** before cutting over the default. Those
are calendar-bound, not agent-bound: throwing more agents at them doesn't
help.

---

## 7. Recommendation

Pursue **Option C** in additive mode. Concretely:

1. Spike + parity test next.
2. Land the adapter scaffolding and AgentsView adapter behind
   `STRAUDE_COLLECTOR=auto` (prefer agentsview when on PATH).
3. Update landing/privacy copy to credit both projects.
4. Watch the north-star metric and `/api/usage/submit` error rate for
   2 weeks.
5. Retire `codex-native.ts` once parity holds.

This buys us: one external binary instead of two collector code paths,
broader agent coverage essentially for free, and a credible "100× faster"
data point we can quote in landing copy after we measure it ourselves.
The main thing we give up is full ownership of Codex parsing — acceptable
given how much code that costs us today.

## Sources

- AgentsView marketing site: https://www.agentsview.io/
- AgentsView usage guide: https://www.agentsview.io/usage/
- AgentsView CLI commands: https://www.agentsview.io/commands/
- AgentsView token usage doc: https://www.agentsview.io/token-usage/
- Repo: https://github.com/wesm/agentsview (MIT, single-maintainer)
- Docs repo: https://github.com/wesm/agentsview-docs
- ccusage (current): https://github.com/ryoppippi/ccusage
