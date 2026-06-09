import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { performance } from "node:perf_hooks";
import { loadConfig, updateLastPushDate, saveConfig } from "../lib/auth.js";
import type { StraudeConfig } from "../lib/auth.js";
import { loginCommand } from "./login.js";
import { apiRequest } from "../lib/api.js";
import {
  CCUSAGE_CLAUDE_COLLECTOR,
  CCUSAGE_CODEX_COLLECTOR,
  collectCcusageUsageAsync,
} from "../lib/ccusage.js";
import type { CcusageDailyEntry, CcusageCollectorMeta } from "../lib/ccusage.js";
import { MAX_BACKFILL_DAYS, DEFAULT_SYNC_DAYS } from "../config.js";
import { Spinner } from "../lib/spinner.js";
import type { DashboardData as DashboardResponse } from "../components/PushSummary.js";
import { posthog } from "../lib/posthog.js";
import { getDistinctId } from "../lib/machine-id.js";
import { errorMessage, reportUsagePushFailed } from "../lib/telemetry.js";

interface UsageSubmitRequest {
  entries: Array<{
    date: string;
    data: CcusageDailyEntry;
  }>;
  hash?: string;
  collector?: {
    claude?: typeof CCUSAGE_CLAUDE_COLLECTOR;
    codex?: typeof CCUSAGE_CODEX_COLLECTOR;
    ccusage_version?: CcusageCollectorMeta["ccusage_version"];
    ccusage_agents?: CcusageCollectorMeta["ccusage_agents"];
    pricing_mode?: CcusageCollectorMeta["pricing_mode"];
  };
  source: "cli" | "web";
  device_id?: string;
  device_name?: string;
}

interface UsageSubmitResponse {
  results: Array<{
    date: string;
    usage_id: string;
    post_id: string;
    post_url: string;
    action: "created" | "updated";
    previous_cost?: number;
    daily_total?: number;
    device_count?: number;
  }>;
}

interface PushOptions {
  date?: string;
  days?: number;
  dryRun?: boolean;
  timeoutMs?: number;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateCompact(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y!, m! - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.round(Math.abs(a.getTime() - b.getTime()) / msPerDay);
}

function daysBetweenStrings(dateStrA: string, dateStrB: string): number {
  const [ay, am, ad] = dateStrA.split("-").map(Number);
  const [by, bm, bd] = dateStrB.split("-").map(Number);
  const a = new Date(ay!, am! - 1, ad!);
  const b = new Date(by!, bm! - 1, bd!);
  const msPerDay = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

/**
 * Mirrors the server's backfill-window check (apps/web/app/api/usage/submit/
 * route.ts). Pre-filtering on the client keeps a single edge-case row from
 * failing the whole submit with HTTP 400.
 */
export function isWithinBackfillWindow(dateStr: string): boolean {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return false;
  const diffDays = (now - target) / 86_400_000;
  return diffDays >= -1 && diffDays <= MAX_BACKFILL_DAYS;
}

export type DateRangeResolution =
  | { ok: true; since: Date; until: Date }
  | { ok: false; error: string };

/**
 * Pure resolver for the date range a push should cover. Extracted from
 * `pushCommand` so each branch (explicit --date, ccusage v20 migration, --days,
 * smart-sync from last_push_date, fresh install) can be unit-tested without
 * mocking ccusage / the API / the filesystem.
 */
export function resolvePushDateRange(args: {
  today: Date;
  options: { date?: string; days?: number };
  lastPushDate?: string;
  shouldRunMigrationBackfill: boolean;
}): DateRangeResolution {
  const { today, options, lastPushDate, shouldRunMigrationBackfill } = args;
  const todayStr = formatDate(today);

  if (options.date) {
    const target = parseDate(options.date);
    if (daysBetween(today, target) > MAX_BACKFILL_DAYS) {
      return { ok: false, error: `Date must be within the last ${MAX_BACKFILL_DAYS} days.` };
    }
    if (target > today) {
      return { ok: false, error: "Cannot push usage for a future date." };
    }
    return { ok: true, since: target, until: target };
  }

  if (shouldRunMigrationBackfill) {
    const since = new Date(today);
    since.setDate(since.getDate() - MAX_BACKFILL_DAYS + 1);
    return { ok: true, since, until: today };
  }

  if (options.days) {
    const days = Math.min(options.days, MAX_BACKFILL_DAYS);
    const since = new Date(today);
    since.setDate(since.getDate() - days + 1);
    return { ok: true, since, until: today };
  }

  if (lastPushDate) {
    if (lastPushDate >= todayStr) {
      return { ok: true, since: new Date(today), until: new Date(today) };
    }
    const gap = daysBetweenStrings(lastPushDate, todayStr);
    if (gap > DEFAULT_SYNC_DAYS) {
      const since = new Date(today);
      since.setDate(since.getDate() - DEFAULT_SYNC_DAYS + 1);
      return { ok: true, since, until: today };
    }
    return { ok: true, since: parseDate(lastPushDate), until: today };
  }

  // Never pushed before — backfill last 3 days by default
  const FIRST_RUN_BACKFILL_DAYS = 3;
  const since = new Date(today);
  since.setDate(since.getDate() - FIRST_RUN_BACKFILL_DAYS + 1);
  return { ok: true, since, until: today };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function inclusiveDateRangeDays(since: Date, until: Date): number {
  return daysBetween(since, until) + 1;
}

function updateHashPart(hash: ReturnType<typeof createHash>, label: string, value: string): void {
  hash.update(label);
  hash.update("\0");
  hash.update(String(value.length));
  hash.update("\0");
  hash.update(value);
  hash.update("\0");
}

function hashCcusageRun(args: {
  version: string;
  agents: string[];
  pricingMode: string;
  since: string;
  until: string;
  raw: string;
}): string {
  const hash = createHash("sha256");
  updateHashPart(hash, "collector", "ccusage-v20");
  updateHashPart(hash, "version", args.version);
  updateHashPart(hash, "agents", JSON.stringify(args.agents));
  updateHashPart(hash, "pricingMode", args.pricingMode);
  updateHashPart(hash, "since", args.since);
  updateHashPart(hash, "until", args.until);
  updateHashPart(hash, "raw", args.raw);
  return hash.digest("hex");
}

export async function pushCommand(options: PushOptions, apiUrlOverride?: string): Promise<void> {
  let config = loadConfig();

  // Login if needed
  if (!config) {
    await loginCommand(apiUrlOverride);
    config = loadConfig();
    if (!config) {
      console.error("Login failed.");
      process.exit(1);
    }
  }

  // --api-url flag overrides the stored config URL
  if (apiUrlOverride) {
    config = { ...config, api_url: apiUrlOverride };
  }

  // Ensure device_id exists — generate on first push
  if (!config.device_id) {
    config.device_id = randomUUID();
    config.device_name = hostname();
    saveConfig(config);
  }

  const today = new Date();
  // Trigger a one-time 30-day backfill after migrating both Claude and Codex
  // ingestion to ccusage v20. Explicit --date pushes stay exact.
  const shouldRunMigrationBackfill = !options.date && !config.ccusage_v20_migration_completed_at;

  const resolution = resolvePushDateRange({
    today,
    options: { date: options.date, days: options.days },
    lastPushDate: config.last_push_date,
    shouldRunMigrationBackfill,
  });
  if (!resolution.ok) {
    console.error(resolution.error);
    process.exit(1);
  }
  const sinceDate = resolution.since;
  const untilDate = resolution.until;

  const sinceStr = formatDateCompact(sinceDate);
  const untilStr = formatDateCompact(untilDate);

  console.log(
    sinceDate.getTime() === untilDate.getTime()
      ? `Pushing usage for ${formatDate(sinceDate)}...`
      : `Pushing usage for ${formatDate(sinceDate)} to ${formatDate(untilDate)}...`,
  );

  const scanSpinner = new Spinner("scan");
  scanSpinner.start();
  let ccusage: Awaited<ReturnType<typeof collectCcusageUsageAsync>>;
  const scanStartedAt = performance.now();
  let ccusageCaptureMs = 0;
  try {
    ccusage = await collectCcusageUsageAsync(sinceStr, untilStr, options.timeoutMs);
    ccusageCaptureMs = Math.round(performance.now() - scanStartedAt);
    scanSpinner.stop();
  } catch (err) {
    ccusageCaptureMs = Math.round(performance.now() - scanStartedAt);
    scanSpinner.stop();
    reportUsagePushFailed(config, err, {
      command: "push",
      stage: "scan",
      ccusage_capture_ms: ccusageCaptureMs,
      date_range_days: inclusiveDateRangeDays(sinceDate, untilDate),
    });
    await posthog._shutdown();
    console.error(`\nFailed to collect usage: ${errorMessage(err)}`);
    process.exit(1);
  }

  // Drop entries the server would reject as out-of-window. Pre-filtering keeps
  // a single edge-case row from failing the whole batch with HTTP 400.
  const droppedDates: string[] = [];
  const entries = ccusage.data.filter((entry) => {
    if (isWithinBackfillWindow(entry.date)) return true;
    droppedDates.push(entry.date);
    return false;
  });
  if (droppedDates.length > 0) {
    console.log(
      `Note: skipping ${droppedDates.length} date(s) outside the ${MAX_BACKFILL_DAYS}-day backfill window: ${droppedDates.join(", ")}`,
    );
  }

  if (entries.length === 0) {
    console.log("No usage data found for the specified period.");
    return;
  }

  if (options.dryRun) {
    // Dry run: fetch full dashboard from API (skip submit only)
    try {
      const dashboard = await apiRequest<DashboardResponse>(config, "/api/cli/dashboard");
      const { render } = await import("ink");
      const { createElement } = await import("react");
      const { PushSummary } = await import("../components/PushSummary.js");

      const { waitUntilExit } = render(
        createElement(PushSummary, { dashboard }),
      );
      await waitUntilExit();
    } catch {
      // Fallback: plain text if API or Ink fails
      for (const entry of entries) {
        console.log(`  ${entry.date}:`);
        console.log(`    Cost: ${formatCost(entry.costUSD)}`);
        console.log(
          `    Tokens: ${formatTokens(entry.totalTokens)} (input: ${formatTokens(entry.inputTokens)}, output: ${formatTokens(entry.outputTokens)})`,
        );
        console.log(`    Models: ${entry.models.join(", ")}`);
      }
    }
    console.log("\n(dry run — nothing submitted)");
    return;
  }

  const hash = hashCcusageRun({
    version: ccusage.version,
    agents: ccusage.agents,
    pricingMode: ccusage.pricingMode,
    since: sinceStr,
    until: untilStr,
    raw: ccusage.raw,
  });

  const body: UsageSubmitRequest = {
    entries: entries.map((entry) => ({
      date: entry.date,
      data: entry,
    })),
    hash,
    collector: ccusage.agents.length > 0 ? ccusage.collector : undefined,
    source: "cli",
    device_id: config.device_id,
    device_name: config.device_name,
  };

  const syncSpinner = new Spinner("sync");
  syncSpinner.start();
  let response: UsageSubmitResponse;
  try {
    response = await apiRequest<UsageSubmitResponse>(config, "/api/usage/submit", {
      method: "POST",
      body: JSON.stringify(body),
    });
    syncSpinner.stop();
  } catch (err) {
    syncSpinner.stop();
    reportUsagePushFailed(config, err, {
      command: "push",
      stage: "submit",
    });
    await posthog._shutdown();
    console.error(`\nFailed to submit: ${errorMessage(err)}`);
    process.exit(1);
  }

  // Show per-entry delta feedback before dashboard
  for (const result of response.results) {
    if (result.action === "updated" && result.previous_cost != null && result.daily_total != null) {
      const delta = result.daily_total - result.previous_cost;
      if (Math.abs(delta) < 0.005) {
        // No meaningful change — explain why
        const deviceHint = result.device_count && result.device_count > 1
          ? ` (${result.device_count} devices)`
          : "";
        console.log(
          `${result.date}: $${result.daily_total.toFixed(2)}${deviceHint} — no new usage detected on this device`,
        );
      }
    }
  }

  // Track last pushed date for incremental sync
  const latestDate = entries.reduce(
    (latest, e) => (e.date > latest ? e.date : latest),
    entries[0]!.date,
  );
  if (shouldRunMigrationBackfill) {
    const stamp = new Date().toISOString();
    config.ccusage_v20_migration_completed_at = stamp;
    config.last_push_date = latestDate;
    saveConfig(config);
  } else {
    updateLastPushDate(latestDate);
  }

  const totalCost = entries.reduce((sum, e) => sum + e.costUSD, 0);
  const totalTokens = entries.reduce((sum, e) => sum + e.totalTokens, 0);
  const datesCreated = response.results.filter((r) => r.action === "created").length;
  const datesUpdated = response.results.filter((r) => r.action === "updated").length;
  posthog.capture({
    distinctId: getDistinctId(config),
    event: "usage_pushed",
    properties: {
      days_pushed: entries.length,
      dates_created: datesCreated,
      dates_updated: datesUpdated,
      total_cost_usd: Math.round(totalCost * 100) / 100,
      total_tokens: totalTokens,
      dry_run: false,
      ccusage_version: ccusage.version,
      ccusage_agents: ccusage.agents,
      ccusage_pricing_mode: ccusage.pricingMode,
      ccusage_capture_ms: ccusageCaptureMs,
      ccusage_row_count: entries.length,
      ccusage_raw_bytes: Buffer.byteLength(ccusage.raw, "utf8"),
      date_range_days: inclusiveDateRangeDays(sinceDate, untilDate),
    },
  });

  // Render visual dashboard
  try {
    const dashboard = await apiRequest<DashboardResponse>(config, "/api/cli/dashboard");
    const { render } = await import("ink");
    const { createElement } = await import("react");
    const { PushSummary } = await import("../components/PushSummary.js");

    const { waitUntilExit } = render(
      createElement(PushSummary, {
        dashboard,
        results: response.results,
      }),
    );
    await waitUntilExit();
  } catch {
    // Fallback: if dashboard fetch or Ink render fails, show plain text
    console.log("");
    for (const result of response.results) {
      const verb = result.action === "updated" ? "Updated" : "Posted";
      console.log(`${verb} ${result.date}: ${result.post_url}?edit=1`);
    }
  }
}
