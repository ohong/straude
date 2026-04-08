import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { loadConfig, updateLastPushDate, saveConfig } from "../lib/auth.js";
import type { StraudeConfig } from "../lib/auth.js";
import { loginCommand } from "./login.js";
import { apiRequest } from "../lib/api.js";
import { runCcusageRawAsync, parseCcusageOutput } from "../lib/ccusage.js";
import type { CcusageDailyEntry, ModelBreakdownEntry } from "../lib/ccusage.js";
import { runCodexRawAsync, parseCodexOutput } from "../lib/codex.js";
import { MAX_BACKFILL_DAYS, DEFAULT_SYNC_DAYS } from "../config.js";
import { Spinner } from "../lib/spinner.js";
import type { DashboardData as DashboardResponse } from "../components/PushSummary.js";
import { posthog } from "../lib/posthog.js";

interface UsageSubmitRequest {
  entries: Array<{
    date: string;
    data: CcusageDailyEntry;
  }>;
  hash?: string;
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

function isMissingClaudeDataError(error: Error): boolean {
  return error.message.includes("No valid Claude data directories found");
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

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
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
  const todayStr = formatDate(today);

  let sinceDate: Date;
  let untilDate: Date;

  if (options.date) {
    const target = parseDate(options.date);
    if (daysBetween(today, target) > MAX_BACKFILL_DAYS) {
      console.error(`Date must be within the last ${MAX_BACKFILL_DAYS} days.`);
      process.exit(1);
    }
    if (target > today) {
      console.error("Cannot push usage for a future date.");
      process.exit(1);
    }
    sinceDate = target;
    untilDate = target;
  } else if (options.days) {
    const days = Math.min(options.days, MAX_BACKFILL_DAYS);
    sinceDate = new Date(today);
    sinceDate.setDate(sinceDate.getDate() - days + 1);
    untilDate = today;
  } else if (config.last_push_date) {
    // Smart sync: calculate days since last push
    if (config.last_push_date >= todayStr) {
      // Already pushed today — re-sync with days=1
      sinceDate = today;
      untilDate = today;
    } else {
      const gap = daysBetweenStrings(config.last_push_date, todayStr);
      if (gap > DEFAULT_SYNC_DAYS) {
        // Can't include last pushed date, too far back — cap at default window
        const days = DEFAULT_SYNC_DAYS;
        sinceDate = new Date(today);
        sinceDate.setDate(sinceDate.getDate() - days + 1);
      } else {
        // Include last pushed date to catch any updates from that day
        sinceDate = parseDate(config.last_push_date);
      }
      untilDate = today;
    }
  } else {
    // Never pushed before — backfill last 3 days by default
    const FIRST_RUN_BACKFILL_DAYS = 3;
    sinceDate = new Date(today);
    sinceDate.setDate(sinceDate.getDate() - FIRST_RUN_BACKFILL_DAYS + 1);
    untilDate = today;
  }

  const sinceStr = formatDateCompact(sinceDate);
  const untilStr = formatDateCompact(untilDate);

  console.log(
    sinceDate.getTime() === untilDate.getTime()
      ? `Pushing usage for ${formatDate(sinceDate)}...`
      : `Pushing usage for ${formatDate(sinceDate)} to ${formatDate(untilDate)}...`,
  );

  // Run ccusage + codex in parallel — the single biggest perf win
  const scanSpinner = new Spinner("scan");
  scanSpinner.start();
  const [claudeResult, codexRaw] = await Promise.all([
    runCcusageRawAsync(sinceStr, untilStr, options.timeoutMs).catch((err: Error) => err),
    runCodexRawAsync(sinceStr, untilStr, options.timeoutMs),
  ]);
  scanSpinner.stop();

  let claudeRaw = "";
  let claudeEntries: CcusageDailyEntry[] = [];
  let claudeAnomalies: Array<{ confidence: "high" | "medium" | "low"; mode: string }> = [];

  if (claudeResult instanceof Error) {
    // Codex-only users do not have local Claude data; keep other Claude failures fatal.
    if (isMissingClaudeDataError(claudeResult)) {
      console.log("No Claude Code data found locally; syncing Codex usage only.");
    } else {
      console.error(claudeResult.message);
      process.exit(1);
    }
  } else {
    claudeRaw = claudeResult;
    try {
      const parsed = parseCcusageOutput(claudeRaw);
      claudeEntries = parsed.data;
      claudeAnomalies = (parsed.anomalies ?? []).map((a) => ({ confidence: a.confidence, mode: a.mode }));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  }

  // Codex data — silent on fetch failure (empty string), but surface parser anomalies.
  const codexParsed = codexRaw ? parseCodexOutput(codexRaw) : { data: [], anomalies: [], entryMeta: [] };
  const allAnomalies = [...claudeAnomalies, ...(codexParsed.anomalies ?? [])];
  const mediumLowCount = allAnomalies.filter((a) => a.confidence !== "high").length;
  if (mediumLowCount > 0) {
    const lowCount = allAnomalies.filter((a) => a.confidence === "low").length;
    const unresolvedCount = allAnomalies.filter((a) => a.mode === "unresolved").length;
    console.log(
      `Warning: normalization anomalies detected (${mediumLowCount} medium/low rows, low confidence: ${lowCount}, unresolved: ${unresolvedCount}).`,
    );
  }

  const codexMetaByDate = new Map((codexParsed.entryMeta ?? []).map((row) => [row.date, row.meta]));
  const blockedDates = new Set<string>();

  for (const [date, meta] of codexMetaByDate) {
    if (meta.mode === "unresolved") {
      blockedDates.add(date);
    }
  }

  if (blockedDates.size > 0) {
    const blocked = [...blockedDates].sort();
    const reason = "unresolved codex normalization";
    console.log(`Warning: skipping Codex rows for ${blocked.length} date(s) due to ${reason}: ${blocked.join(", ")}`);
  }

  const codexEntries = codexParsed.data.filter((entry) => !blockedDates.has(entry.date));

  // Merge Claude + Codex entries by date
  const entries = mergeEntries(claudeEntries, codexEntries);

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

  // Compute SHA-256 hash of concatenated raw JSONs
  const hashInput = codexRaw ? claudeRaw + codexRaw : claudeRaw;
  const hash = createHash("sha256").update(hashInput).digest("hex");

  const body: UsageSubmitRequest = {
    entries: entries.map((entry) => ({
      date: entry.date,
      data: entry,
    })),
    hash,
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
    posthog.captureException(err, config.username || undefined, { command: "push" });
    posthog.capture({
      distinctId: config.username || "anonymous",
      event: "usage_push_failed",
      properties: { error: (err as Error).message },
    });
    await posthog._shutdown();
    console.error(`\nFailed to submit: ${(err as Error).message}`);
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
  updateLastPushDate(latestDate);

  const totalCost = entries.reduce((sum, e) => sum + e.costUSD, 0);
  const totalTokens = entries.reduce((sum, e) => sum + e.totalTokens, 0);
  const datesCreated = response.results.filter((r) => r.action === "created").length;
  const datesUpdated = response.results.filter((r) => r.action === "updated").length;
  posthog.capture({
    distinctId: config.username || "anonymous",
    event: "usage_pushed",
    properties: {
      days_pushed: entries.length,
      dates_created: datesCreated,
      dates_updated: datesUpdated,
      total_cost_usd: Math.round(totalCost * 100) / 100,
      total_tokens: totalTokens,
      dry_run: false,
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
