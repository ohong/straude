import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { loadConfig, updateLastPushDate, saveConfig } from "../lib/auth.js";
import type { StraudeConfig } from "../lib/auth.js";
import { loginCommand } from "./login.js";
import { apiRequest } from "../lib/api.js";
import {
  CCUSAGE_CLAUDE_COLLECTOR,
  CCUSAGE_CODEX_COLLECTOR,
  runCcusageAgentRawAsync,
  parseCcusageOutput,
  ensureCcusageInstalled,
} from "../lib/ccusage.js";
import type { CcusageAgent, CcusageDailyEntry, CcusageOutput, ModelBreakdownEntry } from "../lib/ccusage.js";
import { containsSessionFile } from "../lib/codex-native.js";
import { MAX_BACKFILL_DAYS, DEFAULT_SYNC_DAYS } from "../config.js";
import { Spinner } from "../lib/spinner.js";
import type { DashboardData as DashboardResponse } from "../components/PushSummary.js";
import {
  printDryRunEntries,
  printSubmittedResults,
  renderPushSummary,
} from "./push-output.js";
import { posthog } from "../lib/posthog.js";
import { getDistinctId } from "../lib/machine-id.js";
import { isDebug, debugLog } from "../lib/debug.js";
import { errorMessage, reportUsagePushFailed } from "../lib/telemetry.js";
import type { NormalizationAnomaly } from "../lib/ccusage.js";

interface UsageSubmitRequest {
  entries: Array<{
    date: string;
    data: CcusageDailyEntry;
  }>;
  hash?: string;
  collector?: {
    claude?: typeof CCUSAGE_CLAUDE_COLLECTOR;
    codex?: typeof CCUSAGE_CODEX_COLLECTOR;
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

type SourceScan =
  | {
    ok: true;
    agent: CcusageAgent;
    raw: string;
    parsed: CcusageOutput;
  }
  | {
    ok: false;
    agent: CcusageAgent;
    error: Error;
    missingData: boolean;
  };

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
 * `pushCommand` so each branch (explicit --date, codex repair, --days,
 * smart-sync from last_push_date, fresh install) can be unit-tested without
 * mocking ccusage / the API / the filesystem.
 */
export function resolvePushDateRange(args: {
  today: Date;
  options: { date?: string; days?: number };
  lastPushDate?: string;
  shouldRunCodexRepair: boolean;
}): DateRangeResolution {
  const { today, options, lastPushDate, shouldRunCodexRepair } = args;
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

  if (shouldRunCodexRepair) {
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

/**
 * Build per-model cost breakdown from a source's entry.
 * Distributes total cost evenly across models when per-model data isn't available.
 */
function buildBreakdown(entry: CcusageDailyEntry): ModelBreakdownEntry[] {
  if (entry.modelBreakdown && entry.modelBreakdown.length > 0) return entry.modelBreakdown;
  // Fallback: distribute evenly (no per-model data available)
  if (entry.models.length === 0 || entry.costUSD === 0) return [];
  const perModel = entry.costUSD / entry.models.length;
  return entry.models.map((model) => ({ model, cost_usd: perModel }));
}

/**
 * Merge Claude and Codex daily entries by date.
 * Sums tokens/costs, unions models, builds model_breakdown.
 */
export function mergeEntries(
  claudeEntries: CcusageDailyEntry[],
  codexEntries: CcusageDailyEntry[],
): CcusageDailyEntry[] {
  const byDate = new Map<string, { claude?: CcusageDailyEntry; codex?: CcusageDailyEntry }>();

  for (const e of claudeEntries) {
    byDate.set(e.date, { ...byDate.get(e.date), claude: e });
  }
  for (const e of codexEntries) {
    byDate.set(e.date, { ...byDate.get(e.date), codex: e });
  }

  const merged: CcusageDailyEntry[] = [];

  for (const [date, { claude, codex }] of byDate) {
    const claudeBreakdown = claude ? buildBreakdown(claude) : [];
    const codexBreakdown = codex ? buildBreakdown(codex) : [];
    const modelBreakdown = [...claudeBreakdown, ...codexBreakdown];

    merged.push({
      date,
      models: [
        ...(claude?.models ?? []),
        ...(codex?.models ?? []),
      ],
      inputTokens: (claude?.inputTokens ?? 0) + (codex?.inputTokens ?? 0),
      outputTokens: (claude?.outputTokens ?? 0) + (codex?.outputTokens ?? 0),
      cacheCreationTokens: (claude?.cacheCreationTokens ?? 0) + (codex?.cacheCreationTokens ?? 0),
      cacheReadTokens: (claude?.cacheReadTokens ?? 0) + (codex?.cacheReadTokens ?? 0),
      totalTokens: (claude?.totalTokens ?? 0) + (codex?.totalTokens ?? 0),
      costUSD: (claude?.costUSD ?? 0) + (codex?.costUSD ?? 0),
      modelBreakdown: modelBreakdown.length > 0 ? modelBreakdown : undefined,
    });
  }

  // Sort by date ascending
  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}

function isMissingSourceDataError(err: Error): boolean {
  return /(?:no valid|no|missing).{0,80}(?:data|jsonl|session|director(?:y|ies))|(?:data|jsonl|session|director(?:y|ies)).{0,80}(?:not found|missing)/i
    .test(err.message);
}

async function scanCcusageSource(
  agent: CcusageAgent,
  sinceStr: string,
  untilStr: string,
  timeoutMs?: number,
): Promise<SourceScan> {
  try {
    const raw = await runCcusageAgentRawAsync(agent, sinceStr, untilStr, timeoutMs);
    return {
      ok: true,
      agent,
      raw,
      parsed: parseCcusageOutput(raw, agent),
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      ok: false,
      agent,
      error,
      missingData: isMissingSourceDataError(error),
    };
  }
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
  // Trigger a one-time 30-day backfill when the user has not yet re-collected
  // Codex sessions with the last_token_usage accounting fix. The older repair
  // marker is kept only so users who already ran the first repair still get
  // this more accurate re-collection.
  const shouldRunCodexRepair = !options.date
    && (!config.codex_native_repair_completed_at || !config.codex_native_last_token_usage_repair_completed_at)
    && await containsSessionFile();

  const resolution = resolvePushDateRange({
    today,
    options: { date: options.date, days: options.days },
    lastPushDate: config.last_push_date,
    shouldRunCodexRepair,
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

  try {
    await ensureCcusageInstalled(config);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const scanSpinner = new Spinner("scan");
  scanSpinner.start();
  const scans = await Promise.all([
    scanCcusageSource("claude", sinceStr, untilStr, options.timeoutMs),
    scanCcusageSource("codex", sinceStr, untilStr, options.timeoutMs),
  ]);
  scanSpinner.stop();

  const fatalScan = scans.find((scan) => !scan.ok && !scan.missingData);
  if (fatalScan && !fatalScan.ok) {
    console.error(fatalScan.error.message);
    process.exit(1);
  }

  const successfulScans = scans.filter((scan): scan is Extract<SourceScan, { ok: true }> => scan.ok);

  // Token-normalization anomalies are diagnostic, not user-actionable: rows
  // tagged medium/low confidence still get pushed (we just had to infer
  // cache semantics). Only `mode === "unresolved"` rows are dropped, and
  // those have their own warning below. So keep these counts quiet by
  // default and surface them only under --debug; ship the counts to PostHog
  // either way so we can monitor normalization quality across users.
  const allAnomalies: NormalizationAnomaly[] = successfulScans.flatMap(
    (scan) => scan.parsed.anomalies ?? [],
  );
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

  // Drop entries the server would reject as out-of-window. Pre-filtering keeps
  // a single edge-case row from failing the whole batch with HTTP 400.
  const droppedDates: string[] = [];
  const filterEntry = (entry: CcusageDailyEntry) => {
    if (isWithinBackfillWindow(entry.date)) return true;
    droppedDates.push(entry.date);
    return false;
  };
  const claudeEntries = successfulScans
    .filter((scan) => scan.agent === "claude")
    .flatMap((scan) => scan.parsed.data)
    .filter(filterEntry);
  const codexEntries = successfulScans
    .filter((scan) => scan.agent === "codex")
    .flatMap((scan) => scan.parsed.data)
    .filter(filterEntry);
  const entries = mergeEntries(claudeEntries, codexEntries);
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
      await renderPushSummary(dashboard);
    } catch {
      // Fallback: plain text if API or Ink fails
      printDryRunEntries(entries);
    }
    console.log("\n(dry run — nothing submitted)");
    return;
  }

  const hash = createHash("sha256")
    .update(successfulScans.map((scan) => `${scan.agent}\0${scan.raw}`).join("\0"))
    .digest("hex");
  const collector: UsageSubmitRequest["collector"] = {};
  if (claudeEntries.length > 0) collector.claude = CCUSAGE_CLAUDE_COLLECTOR;
  if (codexEntries.length > 0) collector.codex = CCUSAGE_CODEX_COLLECTOR;

  const body: UsageSubmitRequest = {
    entries: entries.map((entry) => ({
      date: entry.date,
      data: entry,
    })),
    hash,
    collector: Object.keys(collector).length > 0 ? collector : undefined,
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
  if (shouldRunCodexRepair) {
    const stamp = new Date().toISOString();
    config.codex_native_repair_completed_at = stamp;
    config.codex_native_last_token_usage_repair_completed_at = stamp;
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
      anomalies_medium_low: anomalyCounts.mediumLow,
      anomalies_low_confidence: anomalyCounts.low,
      anomalies_unresolved: anomalyCounts.unresolved,
    },
  });

  // Render visual dashboard
  try {
    const dashboard = await apiRequest<DashboardResponse>(config, "/api/cli/dashboard");
    await renderPushSummary(dashboard, response.results);
  } catch {
    // Fallback: if dashboard fetch or Ink render fails, show plain text
    printSubmittedResults(response.results);
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
