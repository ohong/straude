import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { loadConfig, updateLastPushDate, saveConfig } from "../lib/auth.js";
import type { StraudeConfig } from "../lib/auth.js";
import { loginCommand } from "./login.js";
import { apiRequest } from "../lib/api.js";
import type { CcusageDailyEntry } from "../lib/ccusage.js";
import type { NormalizationAnomaly } from "../lib/ccusage.js";
import {
  AGENTSVIEW_COLLECTOR,
  MIN_AGENTSVIEW_VERSION,
  getAgentsViewVersion,
  isSupportedAgentsViewVersion,
  parseAgentsViewOutput,
  runAgentsViewRawAsync,
} from "../lib/agentsview.js";
import { MAX_BACKFILL_DAYS, DEFAULT_SYNC_DAYS } from "../config.js";
import { Spinner } from "../lib/spinner.js";
import type { DashboardData as DashboardResponse } from "../components/PushSummary.js";
import { posthog } from "../lib/posthog.js";
import { getDistinctId } from "../lib/machine-id.js";
import { isDebug, debugLog } from "../lib/debug.js";
import { errorMessage, reportUsagePushFailed } from "../lib/telemetry.js";

interface UsageSubmitRequest {
  entries: Array<{
    date: string;
    data: CcusageDailyEntry;
  }>;
  hash?: string;
  collector?: {
    unified?: typeof AGENTSVIEW_COLLECTOR;
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

function localTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
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
 * `pushCommand` so explicit --date, --days, smart-sync, and fresh-install
 * behavior can be unit-tested without mocking agentsview or the API.
 */
export function resolvePushDateRange(args: {
  today: Date;
  options: { date?: string; days?: number };
  lastPushDate?: string;
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
    return { ok: true, since: target, until: target };
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

  const firstRunBackfillDays = 3;
  const since = new Date(today);
  since.setDate(since.getDate() - firstRunBackfillDays + 1);
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

function unsupportedAgentsViewMessage(version?: string): string {
  const found = version ? ` Found ${version}.` : "";
  return `agentsview ${MIN_AGENTSVIEW_VERSION} or newer is required.${found} Install or upgrade it from https://www.agentsview.io/.`;
}

async function requireAgentsViewVersion(timeoutMs: number): Promise<string> {
  try {
    const version = await getAgentsViewVersion(timeoutMs);
    if (!isSupportedAgentsViewVersion(version)) {
      throw new Error(unsupportedAgentsViewMessage(version));
    }
    return version;
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith("agentsview is not installed")) {
      throw new Error(unsupportedAgentsViewMessage());
    }
    throw err;
  }
}

export async function pushCommand(options: PushOptions, apiUrlOverride?: string): Promise<void> {
  let config = loadConfig();

  if (!config) {
    await loginCommand(apiUrlOverride);
    config = loadConfig();
    if (!config) {
      console.error("Login failed.");
      process.exit(1);
    }
  }

  if (apiUrlOverride) {
    config = { ...config, api_url: apiUrlOverride };
  }

  if (!config.device_id) {
    config.device_id = randomUUID();
    config.device_name = hostname();
    saveConfig(config);
  }

  const today = new Date();
  const resolution = resolvePushDateRange({
    today,
    options: { date: options.date, days: options.days },
    lastPushDate: config.last_push_date,
  });
  if (!resolution.ok) {
    console.error(resolution.error);
    process.exit(1);
  }

  const sinceDate = resolution.since;
  const untilDate = resolution.until;
  const sinceIso = formatDate(sinceDate);
  const untilIso = formatDate(untilDate);
  const timezone = localTimeZone();
  const agentsViewProbeTimeoutMs = Math.min(options.timeoutMs ?? 3_000, 3_000);

  let agentsViewVersion: string;
  try {
    agentsViewVersion = await requireAgentsViewVersion(agentsViewProbeTimeoutMs);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  console.log(
    sinceDate.getTime() === untilDate.getTime()
      ? `Pushing usage for ${formatDate(sinceDate)}...`
      : `Pushing usage for ${formatDate(sinceDate)} to ${formatDate(untilDate)}...`,
  );

  if (isDebug()) {
    debugLog(`collector mode: agentsview-unified`);
    debugLog(`agentsview version: ${agentsViewVersion}`);
    debugLog(`timezone: ${timezone ?? "(unset)"}`);
    debugLog(`pricing mode: offline`);
  }

  const scanSpinner = new Spinner("scan");
  scanSpinner.start();

  let entries: CcusageDailyEntry[] = [];
  let allAnomalies: NormalizationAnomaly[] = [];
  let rawHashInput = "";
  try {
    rawHashInput = await runAgentsViewRawAsync(sinceIso, untilIso, options.timeoutMs, {
      timezone,
    });
    const parsed = parseAgentsViewOutput(rawHashInput);
    entries = parsed.data;
    allAnomalies = parsed.anomalies ?? [];
  } catch (err) {
    scanSpinner.stop();
    console.error((err as Error).message);
    process.exit(1);
  }
  scanSpinner.stop();

  const anomalyCounts = countAnomalies(allAnomalies);
  if (isDebug() && anomalyCounts.mediumLow > 0) {
    debugLog(
      `normalization anomalies: ${anomalyCounts.mediumLow} medium/low,`,
      `low=${anomalyCounts.low}, unresolved=${anomalyCounts.unresolved}`,
    );
    for (const a of allAnomalies) {
      if (a.confidence === "high") continue;
      const warningStr = a.warnings.length > 0 ? ` warnings=${a.warnings.join("; ")}` : "";
      debugLog(
        `  ${a.date} ${a.source} mode=${a.mode} confidence=${a.confidence}`,
        `consistency_error=${a.consistencyError}${warningStr}`,
      );
    }
  }

  const droppedDates: string[] = [];
  entries = entries.filter((entry) => {
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
    await renderDryRun(config, entries);
    console.log("\n(dry run — nothing submitted)");
    return;
  }

  const hash = createHash("sha256").update(rawHashInput).digest("hex");
  const body: UsageSubmitRequest = {
    entries: entries.map((entry) => ({
      date: entry.date,
      data: entry,
    })),
    hash,
    collector: { unified: AGENTSVIEW_COLLECTOR },
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

  for (const result of response.results) {
    if (result.action === "updated" && result.previous_cost != null && result.daily_total != null) {
      const delta = result.daily_total - result.previous_cost;
      if (Math.abs(delta) < 0.005) {
        const deviceHint = result.device_count && result.device_count > 1
          ? ` (${result.device_count} devices)`
          : "";
        console.log(
          `${result.date}: $${result.daily_total.toFixed(2)}${deviceHint} — no new usage detected on this device`,
        );
      }
    }
  }

  const latestDate = entries.reduce(
    (latest, e) => (e.date > latest ? e.date : latest),
    entries[0]!.date,
  );
  updateLastPushDate(latestDate);

  const totalCost = entries.reduce((sum, e) => sum + e.costUSD, 0);
  const totalTokens = entries.reduce((sum, e) => sum + e.totalTokens, 0);
  const datesCreated = response.results.filter((r) => r.action === "created").length;
  const datesUpdated = response.results.filter((r) => r.action === "updated").length;
  try {
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
        anomalies_medium_low: anomalyCounts.mediumLow,
        anomalies_low_confidence: anomalyCounts.low,
        anomalies_unresolved: anomalyCounts.unresolved,
        collector_mode: "agentsview-unified",
        agentsview_version: agentsViewVersion,
      },
    });
  } catch {
    // Telemetry failure is non-fatal.
  }

  await renderSubmittedResults(config, response);
}

async function renderDryRun(config: StraudeConfig, entries: CcusageDailyEntry[]): Promise<void> {
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
    for (const entry of entries) {
      console.log(`  ${entry.date}:`);
      console.log(`    Cost: ${formatCost(entry.costUSD)}`);
      console.log(
        `    Tokens: ${formatTokens(entry.totalTokens)} (input: ${formatTokens(entry.inputTokens)}, output: ${formatTokens(entry.outputTokens)})`,
      );
      console.log(`    Models: ${entry.models.join(", ")}`);
    }
  }
}

async function renderSubmittedResults(
  config: StraudeConfig,
  response: UsageSubmitResponse,
): Promise<void> {
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
    console.log("");
    for (const result of response.results) {
      const verb = result.action === "updated" ? "Updated" : "Posted";
      console.log(`${verb} ${result.date}: ${result.post_url}?edit=1`);
    }
  }
}

function countAnomalies(
  anomalies: NormalizationAnomaly[],
): { mediumLow: number; low: number; unresolved: number } {
  return {
    mediumLow: anomalies.filter((a) => a.confidence !== "high").length,
    low: anomalies.filter((a) => a.confidence === "low").length,
    unresolved: anomalies.filter((a) => a.mode === "unresolved").length,
  };
}
