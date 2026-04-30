# Migrating Straude's Local Usage Collector to `agentsview`

**Audience:** Engineering leadership (decision: greenlight or shelve)
**Status:** Exploration. No code changes. Awaiting decision.
**Last updated:** 2026-04-30
**Decision owner:** TBD
**Authors:** Claude (research pass 2026-04-28; deeper analysis 2026-04-30)

---

## 1. The ask, in one paragraph

Straude's CLI reads users' local Claude Code and Codex usage with two collectors we maintain ourselves (`ccusage` for Claude — an external npm binary we shell out to; `codex-native` for Codex — 577 lines of bespoke JSONL parsing, pricing, and dedup we wrote in-house). [`agentsview`](https://github.com/wesm/agentsview) is a third-party local-first telemetry tool, MIT-licensed, by Wes McKinney (creator of pandas), that does both jobs from one binary, plus 13 other agents (Cursor, Copilot, Gemini, Warp, etc.). Its `usage daily --json` output is schema-compatible with ccusage v18 — the format our parser already consumes. **Should we migrate?**

---

## 2. Recommendation

**Greenlight a phased, additive migration. Hold the rollout until a `/api/usage/submit` 5xx alert is in place.**

Concretely:

- **Phase 0 (prereq, 1 day):** Ship the `/api/usage/submit` 5xx alert tracked in `docs/incidents/2026-04-28-collector-meta-schema-drift.md` §3. **This is non-negotiable** — migrating the collector layer without observability on the only endpoint that matters would re-create the conditions that froze our north-star metric for 4 days last week.
- **Phase 1 (3–4 days):** Add `agentsview` as a third collector adapter behind `STRAUDE_COLLECTOR=auto|agentsview|legacy`. `auto` (default) prefers agentsview when present on PATH, otherwise falls back to today's ccusage + codex-native combo. **Zero behavior change for users who don't have agentsview installed.**
- **Phase 2 (calendar 2 weeks, ~0.5 day eng):** A/B parity check — both collectors run on every push from a small group of opted-in dev machines, diff their outputs, alert if cumulative cost diverges by >1¢/user-day.
- **Phase 3 (1 day, gated on Phase 2 passing):** Retire `codex-native.ts` (−577 lines), keep `ccusage` as a permanent fallback. Update privacy/landing copy.

**Total eng cost: 5–6 days, spread across ~3 calendar weeks.**

**Kill switch:** if Phase 2 parity check exceeds the 1¢ threshold or `/api/usage/submit` 5xx rate climbs, revert the default to `legacy` (one env-var flip — no rollback deploy needed) and write up findings.

---

## 3. Why this is worth doing — three reasons, ranked by load-bearingness

### 3.1 It unlocks a north-star metric leak we already have a roadmap item for

Our north star is cumulative `cost_usd` in `daily_usage`. Today, anything a user runs through Claude Code that isn't an Anthropic-priced model — DeepSeek, Qwen, Kimi, GLM, custom routes — lands in our database with `cost_usd = 0`, because that's all `ccusage` knows how to price. This is openly documented in `docs/ROADMAP.md` ("Cost Tracking for Non-Claude/GPT Models") and surfaced in the UI as "Pricing soon" / em-dash. The roadmap proposes building a server-side LiteLLM pricing table to fix it — a self-estimated ~5 day project with ongoing maintenance.

`agentsview` already uses LiteLLM rates with an offline fallback. Adopting it ships the LiteLLM coverage as a side effect of the migration. **Two roadmap items get checked off by one project**, and the larger of the two (multi-agent coverage) is the one we're not actively scoping yet.

### 3.2 It retires ~600 lines of high-context code we own

Concrete code retirement, line-counted from the actual files:

| File | Lines today | Post-migration | Delta |
|---|---|---|---|
| `packages/cli/src/lib/codex-native.ts` | 577 | 0 (retired) | **−577** |
| `packages/cli/__tests__/codex.test.ts` | 190 | 0 (retired) | **−190** |
| `packages/cli/src/commands/push.ts` (parallel-and-merge orchestration) | ~80 lines of merge logic | ~10 lines (single collector call) | **−70** |
| `packages/cli/src/lib/token-normalization.ts` (`source: "codex"` branch) | ~30 lines of inferred-cache logic | unchanged or simplified | **0 to −30** |
| `packages/cli/src/lib/agentsview.ts` (new) | 0 | ~150–200 (mirrors ccusage.ts) | **+150 to +200** |
| `packages/cli/__tests__/agentsview.test.ts` (new) | 0 | ~150 | **+150** |
| **Net production code** | | | **≈ −500 lines** |
| **Net test code** | | | **≈ −40 lines** |

The retired code is not boilerplate. `codex-native.ts` includes session forking dedup (`forked_from_id` ancestor signature tracking), inclusive-vs-separate cache semantics inference, and a hand-maintained `CODEX_PRICING` table for ~17 GPT-5.x SKUs. Every model launch from OpenAI lands as a maintenance ticket on us today. Post-migration, that ticket lands on Wes McKinney's repo instead.

### 3.3 The strategic option value is real and currently un-priced

agentsview supports 15+ agents out of the box. The moment we trust it as a collector, **anyone running Cursor / Copilot CLI / Gemini CLI / Warp / OpenHands / Amp / Kimi / Hermes / Cortex Code / Kiro / Zencoder / OpenClaw / Pi / iFlow / Positron** can be a Straude user with no per-agent code on our side — only a UI/copy update.

Today our positioning is "the Strava for Claude Code (and Codex)." The migration converts that to "the Strava for AI coding agents," at the unit cost of a copy refresh. Whether we *want* to broaden positioning is a strategy question, but the migration creates the option. **Today we don't have it — adding Cursor would mean cloning the codex-native pattern again.**

---

## 4. The cost-benefit table

| Dimension | Status quo | Post-migration (with fallback retained) | Verdict |
|---|---|---|---|
| Code we own (collectors) | 853 lines (ccusage shim 276 + codex-native 577) | 426 lines (ccusage 276 + agentsview 150) | **−50% code** |
| Pricing coverage | Anthropic + hand-curated GPT-5 only | LiteLLM (broad: DeepSeek, Qwen, Kimi, GLM, all OpenAI/Anthropic/Google) | **Net win, fixes a known leak** |
| Agent coverage | Claude Code, Codex | + 13 more, no per-agent code | **Strategic option created** |
| `--timezone` bucketing correctness | Punt-class (we use machine-local dates) | Native IANA flag | Latent bug class fixed |
| Install ergonomics | `npm install -g ccusage` (one line, npm-native) | `curl \| bash` or desktop installer for agentsview; ccusage stays as fallback | **Worse, but mitigated by fallback** |
| Privacy trust narrative | "ccusage is the anchor" — linked from `PrivacyPledge.tsx` and `/privacy` | Needs additive copy: "ccusage and/or agentsview, both MIT, both local-only" | Marketing cost, not eng cost |
| External dependencies we don't control | 1 (`ryoppippi/ccusage`) | 2 (`ryoppippi/ccusage` + `wesm/agentsview`) | More surface, but McKinney is a stronger long-term bet (see §5.4) |
| Blast radius if collector returns bad data | Limited to 1¢/user/day rounding; cumulative metric drifts silently | Same blast radius, *unless* observability gap remains → re-creates collector_meta-incident pattern | **Hard prerequisite: 5xx alert lands first** |
| Eng days to ship | n/a | 5–6 eng days + 1 day prereq | Cheap relative to upside |
| Wall-clock | n/a | ~3 weeks (driven by the parity soak window, not eng time) | Acceptable |

The tension is between two genuinely-good things:

- **Pro:** code retirement + LiteLLM pricing + multi-agent option, all bundled.
- **Con:** install friction for npm-native users, plus an external dependency added to a critical-path system.

The fallback resolves the tension. Users who already have ccusage installed pay nothing. Users who install agentsview (or already have it from non-Straude use) get the broader pricing coverage automatically. We never force the install regression on anyone.

---

## 5. Risks and what we're betting on

### 5.1 Codex session-forking dedup (medium risk, parity-testable)

Our `codex-native.ts` does explicit ancestor-signature deduplication when a Codex session is forked (`forked_from_id` in the JSONL — see `codex-native.ts:359–395`). I could not confirm from the agentsview docs whether agentsview replicates this. **If it doesn't, users who fork sessions could see double-counting on Codex.** Phase 2 parity check catches this — it's exactly the kind of cumulative drift the 1¢/user-day threshold is designed to flag.

**Mitigation:** parity-soak window before cutover. If agentsview's Codex dedup is weaker, we either contribute a fix upstream or keep `codex-native` as an opt-in for power users.

### 5.2 `reasoningOutputTokens` lost on Codex (low risk, accepted)

agentsview's documented schema does not include `reasoningOutputTokens` at any level. We track this today via `codex-native`. **Cost is unaffected** (LiteLLM applies pricing pre-emit, so the dollar value is right). The only loss is a token-class field we don't currently surface in any UI. Accept.

### 5.3 Install friction for npm-native users (medium risk, fallback-mitigated)

Our magic command is `npx straude@latest`. agentsview's documented install paths are now `curl | bash` (Unix) or PowerShell + desktop app (Windows) — note the existing 2026-04-28 doc said `pip` / `uvx`; that was pre-v0.26 and is now wrong. **No npm path.** This is genuinely worse onboarding for our target user. Resolved by keeping ccusage as the auto-fallback so users never have to install agentsview to use Straude — they only see the upside if they happen to have it.

### 5.4 Upstream dependency stability (low risk, signal is good)

The 2026-04-28 version of this doc flagged the `wesm/agentsview` repo as "single-maintainer with unknown release cadence." Updated read (2026-04-30):

- 869 stars, 409 commits, MIT license
- Latest release **v0.26.0 dated 2026-04-29** (yesterday)
- 58 open issues — healthy for an active project
- Maintainer is Wes McKinney (creator of pandas, Apache Arrow). High reputational stake in long-term maintenance.

This is meaningfully stronger than the prior characterization. We pin a minimum version in our resolver and treat schema breakage as a kill-switch trigger.

### 5.5 Hard prerequisite: collector_meta-incident class of bug (P0 if we skip it)

Per `docs/incidents/2026-04-28-collector-meta-schema-drift.md`, `/api/usage/submit` had **zero observability** during a 4-day P0 outage that froze the north-star metric. The remediation list includes a `>1% 5xx rate over 5 minutes` alert — *proposed but not yet implemented*. **Migrating the collector that feeds this endpoint without that alert in place would be malpractice.** Phase 0 of the rollout is non-skippable for this reason.

---

## 6. What we are explicitly *not* doing

- **Not removing ccusage.** It stays as the auto-fallback for users without agentsview. The privacy narrative anchor remains intact.
- **Not changing the database schema.** `daily_usage` is collector-agnostic. No migration risk.
- **Not changing the API contract.** `/api/usage/submit` accepts the same `CcusageDailyEntry` shape post-migration; the only field that grows is the `collector` metadata literal set.
- **Not pursuing an in-place binary swap (Option A in the prior version of this doc).** That option saves 0.5 days of eng work but inherits all the risk with none of the strategic upside.
- **Not committing to multi-agent positioning.** The migration creates the option; the GTM call is separate.

---

## 7. Phased plan with gates

Each phase has a measurable gate that must pass before the next starts. Phases 1–3 are designed so that **stopping after any one of them leaves the system in a strictly-improved state versus today.**

### Phase 0 — Observability prerequisite (1 day, blocks everything else)

| Step | Owner | Definition of done |
|---|---|---|
| Add Vercel/Sentry alert on `/api/usage/submit` 5xx rate >1% over 5 min | TBD | Alert routes to on-call channel; tested with synthetic 500 |
| Add post-deploy smoke test that POSTs a valid usage entry against live schema | TBD | Failing migrations break the deploy, not the next user push |

**Gate to Phase 1:** alert verified to fire on a synthetic failure.

### Phase 1 — Additive collector adapter (3–4 days)

Mostly mirrors §4 of the 2026-04-28 doc, restated here for completeness.

| Step | Eng-days | Parallelizable | Definition of done |
|---|---|---|---|
| 1a. Spike: install agentsview locally, capture diff vs ccusage on a real dev machine; commit fixture to `docs/incidents/parity-baseline-agentsview-v0.26.md` | 0.5 | — | Diff captured; known mismatches documented |
| 1b. Scaffold `packages/cli/src/lib/collectors/{types,agentsview,ccusage,codex-native}.ts` | 1 | — | Existing logic moved, no behavior change, all tests still pass |
| 1c. Implement `AgentsViewCollector` (date format `YYYY-MM-DD`, `--breakdown --offline`, `totalTokens` fallback, `source: "agentsview"` branch in `token-normalization.ts`) | 1 | ‖ with 1d | Unit tests green; can produce `CcusageDailyEntry[]` from real agentsview output |
| 1d. Wire resolver into `push.ts`: `agentsview` → ccusage+codex-native → error; tag with `collector.unified = "agentsview-v1"` (new literal in `UsageCollectorMeta`) | 0.5 | ‖ with 1c | `STRAUDE_COLLECTOR=auto` selects correctly; existing flow unaffected when env var unset |
| 1e. Server-side `UsageCollectorMeta` accepts the new literal (`apps/web/types/index.ts:192`, `apps/web/app/api/usage/submit/route.ts`) | 0.25 | ‖ | Validator passes; tests green |
| 1f. Tests: golden parser fixture from 1a; mirror `ccusage.test.ts` as `agentsview.test.ts`; update `commands/push.test.ts` to cover both resolver branches | 1 | ‖ | Coverage matches existing collectors |

**Gate to Phase 2:** all CI passes; can run `STRAUDE_COLLECTOR=agentsview straude push --dry-run` end-to-end.

### Phase 2 — Parity soak (2 calendar weeks, ~0.5 eng-day total)

| Step | Definition of done |
|---|---|
| Recruit 3–5 dev/dogfood users with both ccusage *and* agentsview installed; have them set `STRAUDE_COLLECTOR=both` (a special mode that runs both, submits ccusage results, and logs the agentsview diff to PostHog) | Diffs flowing into PostHog with `collector_diff` event |
| Define alerting threshold: cumulative `cost_usd` diff > $0.01/user/day → page; per-day diff > 5% → flag for inspection | Threshold lives in PostHog dashboard; documented in `docs/CHANGELOG.md` |
| At end of week 2, evaluate: median diff, 95p diff, count of users with any non-zero diff | Decision artifact: green-light, hold, or revert |

**Gate to Phase 3:** parity check stays under threshold for 14 consecutive days. Any regression in `/api/usage/submit` 5xx rate also stops the gate.

### Phase 3 — Default flip + codex-native retirement (1 day, optional)

| Step | Definition of done |
|---|---|
| Flip `STRAUDE_COLLECTOR=auto` to prefer agentsview as default-when-available | Default behavior change; release notes |
| Delete `codex-native.ts`, `codex.test.ts`, `CODEX_PRICING` table, `source: "codex"` branch in token-normalization | All tests pass; npm package shrinks |
| Update `apps/web/components/landing/PrivacyPledge.tsx`, `apps/web/app/(landing)/privacy/page.tsx`, `apps/web/app/(landing)/cli/page.tsx`, `README.md`, `packages/cli/README.md`, `docs/CLI.md` to credit both projects | Privacy narrative survives the swap |
| Add `docs/DECISIONS.md` entry per CLAUDE.md convention | Decision recorded |

**This phase is optional.** If we like the additive setup and don't want to retire codex-native, we can sit on Phase 2 indefinitely with no harm.

---

## 8. Decision aid: what would change my recommendation?

| If we learn… | …recommendation becomes |
|---|---|
| The 5xx alert prerequisite slips >1 sprint | **Hold migration entirely** until it lands. The collector_meta incident pattern is a P0 we won't repeat. |
| agentsview's Codex parsing fails the 1¢/user-day parity check | **Phase 1 only.** Ship agentsview as the Claude collector; keep codex-native indefinitely. |
| Wes McKinney archives the repo or releases stop for >90 days | **Hold Phase 3.** Keep codex-native as the supported path; agentsview becomes opt-in only. |
| A user-research signal shows the curl-bash install is a deal-breaker | **Phase 1 only, with reduced rollout intensity.** Don't promote agentsview in landing copy; keep it as a power-user opt-in. |
| Multi-agent coverage (Cursor, Copilot) shows up as a top-3 user request | **Accelerate Phase 3** and pair with a copy/positioning update. The strategic option becomes urgent. |

---

## Appendix A — Where Straude touches the collector layer today

### CLI package

- `packages/cli/src/lib/ccusage.ts` (276 lines) — resolves the `ccusage` binary on PATH, runs `ccusage daily --json --breakdown --since … --until …`, parses v18 output into our canonical `CcusageDailyEntry`, runs token normalization, surfaces anomalies.
- `packages/cli/src/lib/codex-native.ts` (577 lines) — separate native collector that walks `~/.codex/sessions/`, parses JSONL, applies `CODEX_PRICING` (LiteLLM-style), deduplicates forked sessions via `forked_from_id` ancestor signatures, produces the same `CcusageDailyEntry` shape.
- `packages/cli/src/lib/token-normalization.ts` (300 lines) — has `source: "ccusage"` and `source: "codex"` branches that differ in how cache semantics ("separate" vs "subset_of_input") are inferred.
- `packages/cli/src/commands/push.ts` (501 lines) — runs ccusage + codex-native in parallel (`Promise.all`), merges entries by date (`mergeEntries`), hashes the raw payload, tags submissions with `collector.claude = "ccusage-v18"` / `collector.codex = "straude-codex-native-v1"`.
- Tests: `ccusage.test.ts` (267), `codex.test.ts` (190), `commands/push.test.ts` (925), `flows/cli-sync-flow.test.ts` (795), `token-normalization.test.ts` (112).

### Web app

- `apps/web/types/index.ts:140–208` — `CcusageDailyEntry`, `CcusageOutput`, `UsageCollectorMeta` (string-typed with `"ccusage-v18"` / `"straude-codex-native-v1"` literals), `UsageSubmitRequest`, `UsageSubmitResponse`.
- `apps/web/app/api/usage/submit/route.ts` (491 lines) — server validator + per-date upsert into `device_usage` and aggregation into `daily_usage`. Has `TRUSTED_CODEX_COLLECTOR = "straude-codex-native-v1"` literal at line 11 used for the cost-monotonicity carve-out (codex-native is allowed to *lower* totals because it repairs inflated upstream values).
- `apps/web/app/(app)/settings/import/page.tsx` and `apps/web/app/(app)/post/new/page.tsx` — paste-import UX. **Schema check requires Straude's normalized shape (`{ "type": "daily", "data": [...] }`), not raw collector output → unaffected by migration.**

### User-facing copy

- `apps/web/app/(landing)/cli/page.tsx` — install instructions naming `ccusage` and `@ccusage/codex` as upstream dependencies.
- `apps/web/app/(landing)/privacy/page.tsx` and `apps/web/components/landing/PrivacyPledge.tsx` — link to `github.com/ryoppippi/ccusage` and `deepwiki.com/ryoppippi/ccusage` as the "we don't read your prompts" anchor.
- `README.md`, `packages/cli/README.md`, `docs/CLI.md`, `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/straude-specs-v1.md` — historical references.

### Database

`daily_usage`'s `cost_usd`, `input_tokens`, `output_tokens`, `cache_creation_tokens`, `cache_read_tokens`, `total_tokens`, `models`, `model_breakdown`, `collector_meta` columns are collector-agnostic. **No migration needed.**

---

## Appendix B — What `agentsview` provides

Sources verified against agentsview.io (CLI ref, Token Usage docs, repo README) on 2026-04-30.

### Install + invocation
- Shell installer (macOS/Linux): `curl -fsSL https://agentsview.io/install.sh | bash`
- PowerShell (Windows): `powershell -ExecutionPolicy ByPass -c "irm https://agentsview.io/install.ps1 | iex"`
- Desktop app: `.dmg` / `.exe` via GitHub Releases
- **Note:** the prior version of this doc claimed `pip install agentsview` and `uvx agentsview` install paths. Those have been removed as of v0.26 (2026-04-29). Verified absent from the README.
- Local data: SQLite database (path not explicitly documented; previously `~/.agentsview/`)
- Optional Postgres for team sync.

### `agentsview usage daily --json` output (verified 2026-04-30)

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
  "totals": { /* summed buckets, no totalTokens */ }
}
```

### Schema compatibility with our `parseCcusageOutput`

| Field | ccusage v18 | agentsview v0.26 | Compatible? |
|---|---|---|---|
| Top-level wrapper | `{ daily, totals }` | `{ daily, totals }` | ✅ identical |
| `daily[].date` | `YYYY-MM-DD` | `YYYY-MM-DD` | ✅ |
| `daily[].{inputTokens,outputTokens,cacheCreationTokens,cacheReadTokens}` | present | present | ✅ |
| `daily[].totalCost` | present | present | ✅ |
| `daily[].modelsUsed` | present | present | ✅ |
| `daily[].modelBreakdowns[].{modelName,cost}` | present | present | ✅ |
| `daily[].modelBreakdowns[].{inputTokens,outputTokens,...}` | absent | **present** | 🎁 bonus per-model token precision |
| `daily[].totalTokens` | present | **absent** | ⚠️ our normalizer fills it from `input + output + cacheCreation + cacheRead` (`token-normalization.ts:251`) |
| `reasoningOutputTokens` | absent | absent | ➖ Codex-only field — currently lives in our codex-native collector. Lost on migration; cost unaffected. |

### Useful flags
- `--since YYYY-MM-DD --until YYYY-MM-DD` (note: agentsview uses dashed dates; ccusage uses `YYYYMMDD` — one-line change in our resolver).
- `--breakdown` — same semantics.
- `--agent claude` / `--agent codex` / etc. — filter; can also call without filter and split on `modelsUsed` client-side.
- `--all` — full history scan.
- `--offline` — skip LiteLLM pricing fetch (deterministic, good for tests/airgapped environments).
- `--no-sync` — skip on-demand sync pre-query (perf lever).
- `--timezone <IANA>` — solves a class of midnight-bucketing bugs we currently punt on.

### Performance claim
README (2026-04-30) states: **"over 100x faster than tools that re-parse raw session files on every run"** due to SQLite indexing. (The 80–220× figure in the prior version of this doc was from marketing copy that has since been updated to the more conservative "100×.") Plausible: agentsview pre-ingests JSONL once and queries it indexed; ccusage rescans `~/.claude/projects` on every call. We should measure on real user data before quoting it ourselves.

### Pricing
LiteLLM rates with offline fallback. **Same source as our hand-curated `CODEX_PRICING` table — but broader.** This is the primary GTM unlock for non-Anthropic/non-OpenAI models (DeepSeek, Qwen, Kimi, GLM, etc.).

### Supported agents (v0.26)

Claude Code, Codex, Cursor, Copilot, Gemini, Warp, OpenHands, Amp, Positron, OpenClaw, Pi, iFlow, Zencoder, Kimi, Hermes Agent, Cortex Code, Kiro (CLI + IDE) — 16+ agents auto-discovered from native session directories.

---

## Appendix C — Migration options scored (for archive)

| Option | Lift (eng-days) | Code retired | Strategic upside | Risk profile | Recommendation |
|---|---|---|---|---|---|
| **A.** In-place binary swap (replace `ccusage` argv with `agentsview` argv) | 0.5 | 0 | None | Low | **Don't do this.** All risk, no upside. |
| **B.** Single-collector hard cutover (replace ccusage *and* codex-native) | 2–3 | ~600 lines | Medium | Medium-high (no fallback, no parity window) | **Don't do this.** Skips the safety net. |
| **C.** Pluggable adapter, additive rollout, ccusage retained as fallback | 5–6 | ~600 lines if Phase 3 ships | High | Low (kill switch is one env-var flip) | **Recommended.** |

Option C is the only one that preserves a clean rollback at every gate.

---

## Appendix D — Sources (last verified 2026-04-30)

- AgentsView site: https://www.agentsview.io/
- Usage guide: https://www.agentsview.io/usage/
- CLI commands: https://www.agentsview.io/commands/
- Token usage doc: https://www.agentsview.io/token-usage/
- Repo: https://github.com/wesm/agentsview (MIT, 869 stars, latest release v0.26.0 dated 2026-04-29)
- Docs repo: https://github.com/wesm/agentsview-docs
- ccusage (current): https://github.com/ryoppippi/ccusage
- Related internal docs: `docs/incidents/2026-04-28-collector-meta-schema-drift.md`, `docs/ROADMAP.md` ("Cost Tracking for Non-Claude/GPT Models")
