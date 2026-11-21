import { readdir, readFile } from "node:fs/promises";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const rollback = "20260507000200_rollback_codex_sql_repairs.sql";
const reviewedBackfills = new Set([
  "20260723133731_usage_submission_v2.sql",
  "20260723135641_usage_reconciliation.sql",
  "20261008120000_usage_newer_collector_corrections.sql",
  "20261008130000_usage_device_overlap_at_submit.sql",
]);

for (const name of await readdir(migrations)) {
  if (!name.endsWith(".sql") || name <= rollback || reviewedBackfills.has(name)) continue;
  const sql = await readFile(new URL(name, migrations), "utf8");
  // Stored function bodies describe future writes. DO blocks run during the migration.
  const executable = sql.replace(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b[\s\S]*?\bAS\s+(\$[\w]*\$)[\s\S]*?\1\s*;/gi, "");
  if (/\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(?:public\.)?(?:daily_usage|device_usage)\b/i.test(executable)) {
    throw new Error(`${name} directly rewrites historical usage. Reconcile from source data instead.`);
  }
}
