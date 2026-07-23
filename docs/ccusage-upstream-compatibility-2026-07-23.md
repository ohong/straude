# ccusage upstream compatibility review

Date: 2026-07-23

## Verdict

Straude `0.2.0` uses the ccusage native Rust collector and includes the relevant upstream runtime performance work, including the fix for the pricing bug reported in [ccusage issue #934](https://github.com/ccusage/ccusage/issues/934). It treats model and agent IDs as data rather than maintaining runtime allowlists, so an unfamiliar model such as `claude-opus-5` or `gpt-6-codex` can flow through without a Straude code change when the installed ccusage binary can parse and price it.

The review began with Straude pinned to and accepting exactly `20.0.16`, while npm `latest` was [`20.0.18`](https://github.com/ccusage/ccusage/releases/tag/v20.0.18). That missed Claude advisor-model accounting added in [`20.0.17`](https://github.com/ccusage/ccusage/releases/tag/v20.0.17) and the expanded embedded Moonshot/Kimi catalog in `20.0.18`.

Both `20.0.16` and `20.0.18` emit an unknown synthetic Codex `gpt-6` model with real tokens, `$0` cost, no stderr warning, and no serialized `missingPricing` marker. The implementation now closes that gap with a source-based guard, accepts any stable release above the accuracy floor, and keeps the repository lockfile exact. Fresh Straude installations can receive new collector support, including a later major whose output passes the production invariants, without a Straude model/source allowlist update. Existing `node_modules` does not update silently; that still requires reinstalling or upgrading Straude.

## Implementation outcome

- `packages/cli` now declares `ccusage: >=20.0.18`; `bun.lock` resolves the current `20.0.18` release.
- Runtime accepts any stable semantic version `>=20.0.18`, records the installed version, and rejects older, prerelease, and invalid versions.
- Nonzero-token Claude or Codex model breakdowns with zero cost raise `PricingUnavailableError` in the shared production parser. Other source IDs may legitimately report zero-cost usage.
- Focused tests preserve all 15 current source IDs, add `future-agent`, exercise future Claude/Codex model names, and cover the version boundaries.
- Packaged E2E checks the published range and actual installed compatible version. A weekly/manual canary installs `ccusage@latest` in isolation and runs the real fixture through the production parser with a 60-second budget.

## Version and feature status

| Area | Straude today | Latest upstream | Finding |
| --- | --- | --- | --- |
| Collector package | `>=20.0.18`, with `20.0.18` in `bun.lock` | `20.0.18` | Current; fresh installs may take later stable releases |
| Runtime gate | Stable `>=20.0.18` | v20 JSON remains compatible | New majors are accepted when production invariants pass |
| Issue #934 | Included | Included | Fixed before v20, with stronger exact/boundary matching in v20 |
| Native performance work | Included through `20.0.15` | No newer installed-CLI performance change in `20.0.17` or `20.0.18` | Straude has the relevant speedups |
| Claude advisor usage | Included through locked `20.0.18` | Added in `20.0.17` | Current |
| Kimi/Moonshot embedded models | Updated through locked `20.0.18` | Expanded in `20.0.18` | Current |
| Supported sources | 15 unified sources | Same 15 sources | Straude invokes the correct unified report |
| Unknown paid model pricing | Fails closed for nonzero-token Claude/Codex usage | Upstream can emit `$0` without provenance | Straude guard prevents silent submission |

## Accuracy issue #934 is fixed

Issue #934 showed `gpt-5.4-mini` falling through to a first-match substring lookup and receiving `gpt-5` pricing. The immediate fix, merged in [PR #1018](https://github.com/ccusage/ccusage/pull/1018) and released in [`19.0.3`](https://github.com/ccusage/ccusage/releases/tag/v19.0.3), changed fallback selection from insertion order to the closest model-name length.

The Rust implementation shipped in Straude's `20.0.16` goes further:

- `gpt-5.4-mini` has an [exact built-in pricing entry](https://github.com/ccusage/ccusage/blob/v20.0.16/rust/crates/ccusage/src/pricing.rs#L1011-L1026).
- Fallback matching chooses the [longest matching key](https://github.com/ccusage/ccusage/blob/v20.0.16/rust/crates/ccusage/src/pricing.rs#L460-L472) and enforces model-version boundaries, so `gpt-5` cannot match an adjacent numeric version indiscriminately.
- Pricing lookup results, including misses, are cached before repeated message processing ([source](https://github.com/ccusage/ccusage/blob/v20.0.16/rust/crates/ccusage/src/pricing.rs#L399-L448)).

Straude adds a second validation layer: it rejects negative or non-finite values, inconsistent token totals, duplicate dates/agents/models, aggregate-to-breakdown differences, missing-pricing warnings, and model-cost drift over $0.005. ccusage marks missing pricing internally but [omits that boolean from serialized JSON](https://github.com/ccusage/ccusage/blob/v20.0.18/rust/crates/ccusage/src/types.rs#L93-L105), so Straude keeps diagnostic logging enabled and scans stderr for ccusage's explicit ["Missing pricing ... cost excludes this model" warning](https://github.com/ccusage/ccusage/blob/v20.0.18/rust/crates/ccusage/src/output.rs#L363-L382).

That warning path is not complete. A synthetic Codex `gpt-6` row produced `$0` with no warning on both tested versions, so all of Straude's arithmetic invariants passed. For Claude and Codex, where nonzero model usage is paid API-equivalent usage, Straude should reject any nonzero-token model breakdown with zero cost unless ccusage exposes explicit trustworthy provenance that the model is free. This rule is source-based, not a model-name allowlist, and automatically starts accepting a future model when ccusage supplies its price.

## Straude includes the relevant speed improvements

The native Rust collector arrived in [`20.0.0`](https://github.com/ccusage/ccusage/releases/tag/v20.0.0). Straude resolves the installed platform-specific native package directly and invokes it with `execFile`, so it avoids package-runner and JavaScript-shim overhead on every collection.

The `20.0.16` pin includes the important runtime optimizations:

- [PR #1096](https://github.com/ccusage/ccusage/pull/1096) reported a 2.18x improvement for unified daily JSON and 2.16x for Codex daily JSON by reducing allocation, hashing, and parsing overhead.
- [PR #1122](https://github.com/ccusage/ccusage/pull/1122) made a 1 GiB Codex JSON fixture 1.55x faster with bounded-memory loading and one-pass aggregation.
- [PR #1158](https://github.com/ccusage/ccusage/pull/1158) reduced peak RSS on a 50 MB unified Codex fixture from about 82 MB to 5.5 MB while slightly improving latency.
- [PR #1326](https://github.com/ccusage/ccusage/pull/1326) moved JSONL adapters onto byte-oriented prefiltering.
- [PR #1332](https://github.com/ccusage/ccusage/pull/1332) parallelized file and database reads across all agent loaders, including a measured 5.36x OpenCode improvement when its database covered most files.
- [PR #1407](https://github.com/ccusage/ccusage/pull/1407), released in `20.0.15`, cached pricing lookups that otherwise scanned roughly 2,200 entries per message.

`20.0.17` is an accounting fix and `20.0.18`'s performance release note concerns the Nix build dependency cache, not the installed CLI runtime. Straude is therefore current on the upstream speed work that affects users, but should still upgrade for the two accuracy/coverage fixes.

## Future model and source behavior

### Models

Straude does not whitelist model IDs. Its collector types use plain strings, preserve ccusage's model name, and validate only the accounting shape and a 255-character protocol bound. The existing `20.0.16` collector already contains tests and pricing for [`claude-fable-5`](https://github.com/ccusage/ccusage/blob/v20.0.16/rust/crates/ccusage/src/pricing.rs#L1988-L2003) and the [`gpt-5.6` family](https://github.com/ccusage/ccusage/blob/v20.0.16/rust/crates/ccusage/src/pricing.rs#L2045-L2073).

For an existing supported source, a future model can work without either project releasing code when:

1. the source log records a model ID and token/cost fields in the format its existing ccusage adapter already understands; and
2. live LiteLLM or models.dev pricing contains the model; and
3. ccusage emits a nonzero price, or explicit trustworthy free-model provenance, for nonzero usage.

ccusage loads live LiteLLM pricing and lazily falls back to live models.dev before its embedded models.dev snapshot ([source](https://github.com/ccusage/ccusage/blob/v20.0.16/rust/crates/ccusage/src/pricing.rs#L399-L439)). Straude's online mode therefore already supports data-only additions to those catalogs. If Opus 5, a later Fable model, or GPT-6 needs a new alias, parser rule, request-level tier, or hardcoded price in ccusage, a fresh Straude install can consume the stable release containing that code as long as its output passes the production invariants.

### Sources

Straude calls `ccusage daily --json --by-agent`, which is the correct upstream interface for every detected supported source. ccusage `20.0.18` currently compiles 15 built-in loaders: Claude, Codex, OpenCode, Amp, Droid, Codebuff, Hermes, pi, Goose, OpenClaw, Kilo, Copilot, Gemini, Kimi, and Qwen ([source](https://github.com/ccusage/ccusage/blob/v20.0.18/rust/crates/ccusage/src/adapter/all/loader.rs#L28-L31)). Its unified JSON includes source metadata and optional per-agent rows ([source](https://github.com/ccusage/ccusage/blob/v20.0.18/rust/crates/ccusage/src/adapter/all/report.rs#L132-L170)), which matches Straude's parser.

Straude accepts any non-empty agent string at runtime, so a newly compiled ccusage source does not require a Straude allowlist update. It does require a newer ccusage binary because the upstream loader list is compiled code.

The boundary is data quality, not naming. ccusage's [Source Support Q&A](https://ccusage.com/guide/source-support-qa) requires local timestamps, session and model identity, and token counts or recorded cost; it explicitly refuses to estimate usage from transcript text. Straude cannot reliably support an agent that ccusage rejects because its local files lack those fields.

## Compatibility probe

I ran the released `ccusage@20.0.18` native package with Straude's production flags (`daily --json --by-agent --timezone UTC --no-offline`) against the repository's GPT-5.6 Codex fixture, then parsed the output with Straude's current `parseCcusageOutput`.

The unmodified parser accepted one Codex day containing `gpt-5.6`, `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`, preserving 440,000 tokens and $1.917 of cost. For known-priced models, the only blocker is `collectCcusageUsageAsync`'s exact version equality check, not an output incompatibility.

A second synthetic fixture changed the recorded model to `gpt-6`. Both `20.0.16` and `20.0.18` preserved the model and token data but returned zero cost without a warning or JSON missing-pricing marker, proving the zero-cost acceptance gap above.

On the small direct-native fixture, 30 warm runs measured:

| Version | Median | p95 |
| --- | ---: | ---: |
| `20.0.16` | 8.24 ms | 13.66 ms |
| `20.0.18` | 6.96 ms | 7.31 ms |

This fixture is too small to generalize the relative speedup, but it confirms that both releases use the fast native path and that upgrading does not introduce an obvious local performance regression.

## Implemented recommendation

1. **Upgrade to `20.0.18` now.** This closes the advisor-model undercount and Kimi/Moonshot catalog gap while retaining all current performance work.
2. **Close the zero-cost provenance gap.** Reject nonzero-token Claude or Codex model breakdowns with zero cost unless ccusage later serializes an explicit trustworthy free-model/pricing-provenance field. Add a `gpt-6` fixture that must fail until ccusage prices it, then pass automatically.
3. **Publish an open-ended stable dependency floor.** Change the CLI dependency to `>=20.0.18` and accept later stable collector versions when their output passes Straude's strict parser, accounting, and pricing validation. Keep `bun.lock` exact so repository tests remain reproducible.
4. **Keep the accounting boundary strict and model-agnostic.** Preserve arbitrary source/model strings, per-agent/model invariant checks, and fail closed on missing pricing or JSON contract drift. Add explicit fixtures named like `claude-opus-5`, `claude-fable-6`, `gpt-6-codex`, and `future-agent` to prevent a later allowlist from creeping in.
5. **Canary upstream continuously.** A scheduled job should install `ccusage@latest` and run the known-price, unknown-price, real collector, malformed-output, and performance fixtures. A new major should pass when compatible rather than fail solely because of its version.
6. **Do not invoke `ccusage@latest` through npx on every sync.** That adds a registry/network dependency to collection, restores cold-download latency, permits an untested major/schema change, and makes a previously working installed CLI fail because npm is unavailable.

The trade-off is explicit: the open-ended dependency floor lets a future stable release reach fresh installs before Straude has tested that exact version. The strict parser and zero-cost guard convert schema, accounting, or pricing drift into a stopped sync rather than silent bad accounting, and the scheduled canary shortens detection. There is no mechanism that is simultaneously instant for every existing installation, offline, and locked to a pre-tested collector digest.
