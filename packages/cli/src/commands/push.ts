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
  CCUSAGE_DEFAULT_PRICING_MODE,
  collectCcusageUsageAsync,
} from "../lib/ccusage.js";
import type { CcusageDailyEntry, CcusageCollectorMeta } from "../lib/ccusage.js";
import { MAX_BACKFILL_DAYS, DEFAULT_SYNC_DAYS } from "../config.js";
import { Spinner } from "../lib/spinner.js";
import type { DashboardData as DashboardResponse } from "../components/PushSummary.js";
import { posthog } from "../lib/posthog.js";
import { getDistinctId } from "../lib/machine-id.js";
import {
  TELEMETRY_SHUTDOWN_TIMEOUT_MS,
  errorMessage,
  reportUsagePushFailed,
  shutdownTelemetryWithTimeout,
} from "../lib/telemetry.js";

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

type PushRangeMode =
  | "explicit_date"
  | "explicit_days"
  | "incremental"
  | "first_sync";

interface PushTimings {
  auth_ms?: number;
  collection_ms?: number;
  submit_ms?: number;
  dashboard_ms?: number;
}

interface DashboardRenderResult {
  rendered: boolean;
  durationMs: number;
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
  | { ok: true; since: Date; until: Date; mode: PushRangeMode }
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
  const { today, options, lastPushDate } = args;
  const todayStr = formatDate(today);

  if (options.date) {
    const target = parseDate(options.date);
    if (daysBetween(today, target) > MAX_BACKFILL_DAYS) {
      return { ok: false, error: `Date must be within the last ${MAX_BACKFILL_DAYS} days.` };
    }
    if (target > today) {
      return { ok: false, error: "Cannot push usage for a future date." };
    }
    return { ok: true, since: target, until: target, mode: "explicit_date" };
  }

  if (options.days) {
    const days = Math.min(options.days, MAX_BACKFILL_DAYS);
    const since = new Date(today);
    since.setDate(since.getDate() - days + 1);
    return { ok: true, since, until: today, mode: "explicit_days" };
  }

  if (lastPushDate) {
    if (lastPushDate >= todayStr) {
      return { ok: true, since: new Date(today), until: new Date(today), mode: "incremental" };
    }
    const gap = daysBetweenStrings(lastPushDate, todayStr);
    if (gap > DEFAULT_SYNC_DAYS) {
      const since = new Date(today);
      since.setDate(since.getDate() - DEFAULT_SYNC_DAYS + 1);
      return { ok: true, since, until: today, mode: "incremental" };
    }
    return { ok: true, since: parseDate(lastPushDate), until: today, mode: "incremental" };
  }

  // Never pushed before — backfill last 3 days by default
  const FIRST_RUN_BACKFILL_DAYS = 3;
  const since = new Date(today);
  since.setDate(since.getDate() - FIRST_RUN_BACKFILL_DAYS + 1);
  return { ok: true, since, until: today, mode: "first_sync" };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

function inclusiveDayCount(since: Date, until: Date): number {
  return daysBetween(since, until) + 1;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function pushTelemetryProperties(args: {
  timings: PushTimings;
  totalStartedAt: number;
  rangeMode: PushRangeMode;
  firstRun: boolean;
  authFlowStarted: boolean;
  migrationPending: boolean;
  fullBackfillCompleted: boolean;
  pricingMode?: CcusageCollectorMeta["pricing_mode"];
  ccusageVersion?: string;
  ccusageAgents?: CcusageCollectorMeta["ccusage_agents"];
  dashboardRendered?: boolean;
}): Record<string, string | number | boolean | string[] | undefined> {
  return {
    first_run: args.firstRun,
    auth_flow_started: args.authFlowStarted,
    backfill_mode: args.rangeMode,
    migration_backfill_pending: args.migrationPending,
    full_backfill_completed: args.fullBackfillCompleted,
    pricing_mode: args.pricingMode,
    ccusage_version: args.ccusageVersion,
    ccusage_agents: args.ccusageAgents,
    dashboard_rendered: args.dashboardRendered,
    telemetry_shutdown_timeout_ms: TELEMETRY_SHUTDOWN_TIMEOUT_MS,
    total_ms: elapsedMs(args.totalStartedAt),
    ...args.timings,
  };
}

async function renderDashboard(
  config: StraudeConfig,
  results: UsageSubmitResponse["results"] | undefined,
): Promise<DashboardRenderResult> {
  const startedAt = performance.now();
  try {
    const dashboard = await apiRequest<DashboardResponse>(config, "/api/cli/dashboard");
    const { render } = await import("ink");
    const { createElement } = await import("react");
    const { PushSummary } = await import("../components/PushSummary.js");

    const { waitUntilExit } = render(
      createElement(PushSummary, {
        dashboard,
        results,
      }),
    );
    await waitUntilExit();
    return {
      rendered: true,
      durationMs: elapsedMs(startedAt),
    };
  } catch {
    return {
      rendered: false,
      durationMs: elapsedMs(startedAt),
    };
  }
}

function printSubmitSuccess(args: {
  entries: CcusageDailyEntry[];
  results: UsageSubmitResponse["results"];
  totalCost: number;
  totalTokens: number;
  migrationPending: boolean;
  fullBackfillCompleted: boolean;
}): void {
  const { entries, results, totalCost, totalTokens, migrationPending, fullBackfillCompleted } = args;
  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const primaryResult = results[0];

  console.log("");
  console.log(
    `Synced ${entries.length} ${pluralize(entries.length, "day")} (${formatCost(totalCost)}, ${formatTokens(totalTokens)} tokens).`,
  );
  if (created > 0 || updated > 0) {
    console.log(`Posted ${created}, updated ${updated}.`);
  }
  if (primaryResult) {
    console.log(`View it: ${primaryResult.post_url}${primaryResult.post_url.includes("?") ? "&" : "?"}edit=1`);
  }
  if (migrationPending && !fullBackfillCompleted) {
    console.log(`Optional: backfill your last ${MAX_BACKFILL_DAYS} days with \`straude push --days ${MAX_BACKFILL_DAYS}\`.`);
  }
}

export async function pushCommand(options: PushOptions, apiUrlOverride?: string): Promise<void> {
  const totalStartedAt = performance.now();
  const timings: PushTimings = {};
  let authFlowStarted = false;
  let config = loadConfig();

  // Login if needed
  if (!config) {
    authFlowStarted = true;
    const authStartedAt = performance.now();
    console.log("After authentication, Straude will continue into your first sync here.");
    await loginCommand(apiUrlOverride);
    timings.auth_ms = elapsedMs(authStartedAt);
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
  const migrationPending = !config.ccusage_v20_migration_completed_at;
  const firstRun = !config.last_push_date;

  const resolution = resolvePushDateRange({
    today,
    options: { date: options.date, days: options.days },
    lastPushDate: config.last_push_date,
    shouldRunMigrationBackfill: migrationPending,
  });
  if (!resolution.ok) {
    console.error(resolution.error);
    process.exit(1);
  }
  const sinceDate = resolution.since;
  const untilDate = resolution.until;
  const rangeMode = resolution.mode;
  const fullBackfillRequested = inclusiveDayCount(sinceDate, untilDate) >= MAX_BACKFILL_DAYS;

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
  const collectionStartedAt = performance.now();
  try {
    ccusage = await collectCcusageUsageAsync(sinceStr, untilStr, options.timeoutMs, {
      pricingMode: CCUSAGE_DEFAULT_PRICING_MODE,
    });
    timings.collection_ms = elapsedMs(collectionStartedAt);
    scanSpinner.stop();
  } catch (err) {
    timings.collection_ms = elapsedMs(collectionStartedAt);
    scanSpinner.stop();
    reportUsagePushFailed(config, err, {
      command: "push",
      stage: "scan",
      ...pushTelemetryProperties({
        timings,
        totalStartedAt,
        rangeMode,
        firstRun,
        authFlowStarted,
        migrationPending,
        fullBackfillCompleted: false,
        pricingMode: CCUSAGE_DEFAULT_PRICING_MODE,
      }),
    });
    await shutdownTelemetryWithTimeout();
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

  const hashInput = JSON.stringify({
    collector: "ccusage-v20",
    version: ccusage.version,
    agents: ccusage.agents,
    since: sinceStr,
    until: untilStr,
    raw: ccusage.raw,
  });
  const hash = createHash("sha256").update(hashInput).digest("hex");

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
  const submitStartedAt = performance.now();
  try {
    response = await apiRequest<UsageSubmitResponse>(config, "/api/usage/submit", {
      method: "POST",
      body: JSON.stringify(body),
    });
    timings.submit_ms = elapsedMs(submitStartedAt);
    syncSpinner.stop();
  } catch (err) {
    timings.submit_ms = elapsedMs(submitStartedAt);
    syncSpinner.stop();
    reportUsagePushFailed(config, err, {
      command: "push",
      stage: "submit",
      ...pushTelemetryProperties({
        timings,
        totalStartedAt,
        rangeMode,
        firstRun,
        authFlowStarted,
        migrationPending,
        fullBackfillCompleted: false,
        pricingMode: ccusage.collector.pricing_mode,
        ccusageVersion: ccusage.version,
        ccusageAgents: ccusage.agents,
      }),
    });
    await shutdownTelemetryWithTimeout();
    console.error(`\nFailed to submit: ${errorMessage(err)}`);
    process.exit(1);
  }

  const totalCost = entries.reduce((sum, e) => sum + e.costUSD, 0);
  const totalTokens = entries.reduce((sum, e) => sum + e.totalTokens, 0);
  const fullBackfillCompleted = migrationPending && fullBackfillRequested;

  printSubmitSuccess({
    entries,
    results: response.results,
    totalCost,
    totalTokens,
    migrationPending,
    fullBackfillCompleted,
  });

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
  if (fullBackfillCompleted) {
    const stamp = new Date().toISOString();
    config.ccusage_v20_migration_completed_at = stamp;
    config.last_push_date = latestDate;
    saveConfig(config);
  } else {
    updateLastPushDate(latestDate);
  }

  const datesCreated = response.results.filter((r) => r.action === "created").length;
  const datesUpdated = response.results.filter((r) => r.action === "updated").length;

  const dashboard = await renderDashboard(
    config,
    response.results,
  );
  timings.dashboard_ms = dashboard.durationMs;

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
      ...pushTelemetryProperties({
        timings,
        totalStartedAt,
        rangeMode,
        firstRun,
        authFlowStarted,
        migrationPending,
        fullBackfillCompleted,
        pricingMode: ccusage.collector.pricing_mode,
        ccusageVersion: ccusage.version,
        ccusageAgents: ccusage.agents,
        dashboardRendered: dashboard.rendered,
      }),
    },
  });
}
