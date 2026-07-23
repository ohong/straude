# Straude CLI 0.2 Operations

This runbook covers the server rollout, alerts, historical repair, rollback,
and the evidence required to close the July 23 CLI reliability audit. It does
not authorize a production deploy by itself.

## Release order

1. Apply `20260723133731_usage_submission_v2.sql` and
   `20260723135641_usage_reconciliation.sql` to staging. Run
   `bun run --cwd apps/web test:integration` against the migrated database and
   retain the test output.
2. Enable protocol-v2 routing for 5% of production users, then 25%, then 100%.
   Hold each stage for at least 24 healthy hours. Rollback disables routing; do
   not drop the additive tables or ledger.
3. After the server accepts v2 at 100%, create the
   `straude@0.2.0` tag. The release workflow publishes only the tarball already
   tested on Linux, macOS, and Windows with Node 20 and 22, then attaches that
   tarball and `SHA256SUMS` to the GitHub release.
4. After 48 healthy hours, run historical repair in bounded batches. Verify a
   representative rollback before completing all batches.
5. The default v1 cutoff is `2026-08-06`. Keep the compatibility path for one
   further release, then remove it after observing no v1 traffic.

## Required alerts and dashboards

The submit route emits one redacted `usage_submit_request` event per request and
one `usage_submit_day` event per date. Logs contain request/protocol/CLI and
collector versions, pricing mode, status, retry count, and stage duration. They
exclude tokens, costs, paths, hostnames, auth data, collector stderr, and raw
usage.

Configure these production alerts before moving beyond 5%:

- Page on any invariant or transaction failure. Group by stable error code and
  release fingerprint so one defect creates one incident.
- Page when submit `5xx` exceeds 5% with at least five requests in ten minutes.
- Warn when unresolved partial outcomes reach 0.1%, or when any external
  operation exceeds its documented deadline.
- Track pricing failures, collector duration, submit duration, dashboard
  degradation, identity conflicts, and authentication failures separately.
  A dashboard failure does not make an already committed sync fail.

The release gate is warm three-day sync p95 below five seconds excluding login,
submit p95 below two seconds, unresolved partials below 0.1%, zero invariant
failures, and no operation running past its deadline. Compare performance
changes on the same runner class using `benchmark` and `benchmark:collector`;
accuracy fixtures must pass regardless of latency.

The frozen-lock CI gate and the `ccusage compatibility` canary serve different
purposes. CI proves the release graph in `bun.lock`; the weekly/manual canary
installs `ccusage@latest` in isolation and passes a new major through the same
production parser and accounting gates. Schema drift, zero-priced Claude/Codex
usage, or a collector run beyond 60 seconds fails clearly. A canary failure does not alter
already-installed CLIs or download collector code at runtime.

## Historical repair

Only a service-role database session may call the repair functions. Start a
batch once, store its UUID, then call the runner repeatedly with a bounded
limit until its result reports completion:

```sql
select public.start_usage_repair_batch('protocol v2 historical repair');
select public.run_usage_repair_batch('<batch-uuid>', 500);
```

Each merge and aggregate change records full before/after rows in
`usage_corrections_ledger`. Proof-eligible identities require the same normalized
hostname, at least two identical overlapping accounting fingerprints, and no
divergent overlap. Ambiguous candidates are recorded but never changed.

Verify after the final batch:

```sql
select count(*)
from public.usage_device_reconciliation_candidates
where status = 'proof_merge';

select status, count(*)
from public.usage_device_reconciliation_candidates
group by status
order by status;

select count(*)
from public.usage_corrections_ledger
where batch_id = '<batch-uuid>';
```

If representative verification fails, restore that batch exactly:

```sql
select public.rollback_usage_repair_batch('<batch-uuid>');
```

Do not edit ledger rows or manually merge candidates. Use `straude devices
merge <candidate>` or `straude devices keep-separate <candidate>` for ambiguous
user-owned decisions.

## Audit closure

Keep the audit open until production has met all correctness, latency, and
error-rate targets for 30 consecutive days. Preserve the release tarball,
digest, source-map artifact, integration output, benchmark JSON, rollout
metrics, and repair/rollback evidence with the closure record.
