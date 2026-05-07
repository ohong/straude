import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { loadConfig, updateLastPushDate, saveConfig } from "../lib/auth.js";
import type { StraudeConfig } from "../lib/auth.js";
import { loginCommand } from "./login.js";
import { apiRequest } from "../lib/api.js";
import { runCcusageRawAsync, parseCcusageOutput, ensureCcusageInstalled } from "../lib/ccusage.js";
import type { CcusageDailyEntry, ModelBreakdownEntry } from "../lib/ccusage.js";
import {
  AGENTSVIEW_COLLECTOR,
  MIN_AGENTSVIEW_VERSION,
  getAgentsViewVersion,
  isSupportedAgentsViewInstalled,
  parseAgentsViewOutput,
  runAgentsViewRawAsync,
} from "../lib/agentsview.js";
import {
  CODEX_NATIVE_COLLECTOR,
  collectCodexUsageAsync,
  containsSessionFile,
} from "../lib/codex-native.js";
import { MAX_BACKFILL_DAYS, DEFAULT_SYNC_DAYS } from "../config.js";
import { Spinner } from "../lib/spinner.js";
import type { DashboardData as DashboardResponse } from "../components/PushSummary.js";
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
    claude?: "ccusage-v18" | typeof AGENTSVIEW_COLLECTOR;
    codex?: typeof CODEX_NATIVE_COLLECTOR;
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

type CollectorPreference = "auto" | "agentsview" | "legacy";
type SelectedCollector = "agentsview-claude-native-codex" | "legacy";

function isMissingClaudeDataError(error: Error): boolean {
  return error.message.includes("No valid Claude data directories found");
}

function isCcusageNotInstalledError(error: Error): boolean {
  return error.message.includes("ccusage is not installed or not on PATH");
}

function isMissingAgentsViewClaudeDataError(error: Error): boolean {
  const message = error.message ?? "";
  return /no\s+claude\s+(?:code\s+)?(?:data|sessions?|directories|director(?:y|ies))/i.test(message);
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

function localTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function readCollectorPreference(): CollectorPreference {
  const value = (process.env.STRAUDE_COLLECTOR ?? "auto").toLowerCase();
  if (value === "auto" || value === "agentsview" || value === "legacy") return value;
  throw new Error("Invalid STRAUDE_COLLECTOR value. Expected auto, agentsview, or legacy.");
}

function selectCollector(
  preference: CollectorPreference,
  shouldRunCodexRepair: boolean,
  agentsViewAvailable: boolean,
): SelectedCollector {
  if (preference === "legacy") return "legacy";
  if (preference === "agentsview") return "agentsview-claude-native-codex";
  if (shouldRunCodexRepair) return "legacy";
  return agentsViewAvailable ? "agentsview-claude-native-codex" : "legacy";
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

  let collectorPreference: CollectorPreference;
  try {
    collectorPreference = readCollectorPreference();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const today = new Date();
  const shouldRunCodexRepair = !options.date
    && !config.codex_native_repair_completed_at
    && await containsSessionFile();
  const shouldProbeAgentsView = collectorPreference !== "legacy"
    && !(collectorPreference === "auto" && shouldRunCodexRepair);
  const agentsViewProbeTimeoutMs = Math.min(options.timeoutMs ?? 3_000, 3_000);
  const agentsViewAvailable = shouldProbeAgentsView
    ? await isSupportedAgentsViewInstalled(agentsViewProbeTimeoutMs)
    : false;
  if (collectorPreference === "agentsview" && !agentsViewAvailable) {
    console.error(`agentsview ${MIN_AGENTSVIEW_VERSION} or newer is required. Install or upgrade it from https://www.agentsview.io/.`);
    process.exit(1);
  }

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
  const sinceIso = formatDate(sinceDate);
  const untilIso = formatDate(untilDate);

  const selectedCollector = selectCollector(collectorPreference, shouldRunCodexRepair, agentsViewAvailable);

  console.log(
    sinceDate.getTime() === untilDate.getTime()
      ? `Pushing usage for ${formatDate(sinceDate)}...`
      : `Pushing usage for ${formatDate(sinceDate)} to ${formatDate(untilDate)}...`,
  );

  const scanSpinner = new Spinner("scan");
  scanSpinner.start();

  let entries: CcusageDailyEntry[] = [];
  let rawHashInput = "";
  let collector: UsageSubmitRequest["collector"] | undefined;
  let allAnomalies: NormalizationAnomaly[] = [];
  let anomalyCounts = countAnomalies([]);
  let codexCollectFailed = false;
  let agentsViewVersion: string | undefined;
  const blockedDates = new Set<string>();

  if (isDebug()) {
    debugLog(`collector mode: ${selectedCollector} (preference=${collectorPreference})`);
    debugLog(`agentsview available: ${agentsViewAvailable}`);
    debugLog(`codex repair pending: ${shouldRunCodexRepair}`);
    debugLog(`codex_native_repair_completed_at: ${config.codex_native_repair_completed_at ?? "(unset)"}`);
    debugLog(`timezone: ${localTimeZone() ?? "(unset)"}`);
    debugLog(`pricing mode: offline`);
  }

  if (selectedCollector === "agentsview-claude-native-codex") {
    // Probe agentsview version once, eagerly, so telemetry + debug logs can
    // record it even if the main agentsview run later fails. Failures here
    // are non-fatal — the version is metadata, not a gate.
    try {
      agentsViewVersion = await getAgentsViewVersion(options.timeoutMs);
      if (isDebug()) {
        debugLog(`agentsview version: ${agentsViewVersion}`);
      }
    } catch {
      if (isDebug()) {
        debugLog(`agentsview version: (probe failed)`);
      }
    }

    const [agentsViewResult, codexParsed] = await Promise.all([
      runAgentsViewRawAsync(sinceIso, untilIso, options.timeoutMs, {
        agent: "claude",
        timezone: localTimeZone(),
      }).catch((err: Error) => err),
      collectCodexUsageAsync(sinceStr, untilStr).catch(() => {
        codexCollectFailed = true;
        return {
          data: [],
          anomalies: [],
          entryMeta: [],
          fingerprint: "",
          scannedFiles: 0,
          parsedEvents: 0,
        };
      }),
    ]);
    scanSpinner.stop();

    let agentsViewRaw = "";
    let claudeEntries: CcusageDailyEntry[] = [];
    let claudeAnomalies: NormalizationAnomaly[] = [];

    if (agentsViewResult instanceof Error) {
      // Mirror the legacy ccusage three-branch structure: a missing
      // `~/.claude/` tree shouldn't crash a Codex-only user. Real failures
      // (binary error, parse error, timeout) still exit fatally.
      if (isMissingAgentsViewClaudeDataError(agentsViewResult)) {
        console.log("No Claude Code data found locally; syncing Codex usage only.");
      } else {
        console.error(agentsViewResult.message);
        process.exit(1);
      }
    } else {
      agentsViewRaw = agentsViewResult;
      try {
        const parsed = parseAgentsViewOutput(agentsViewRaw);
        claudeEntries = parsed.data;
        claudeAnomalies = parsed.anomalies ?? [];
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }
    }

    allAnomalies = [
      ...claudeAnomalies,
      ...(codexParsed.anomalies ?? []),
    ];
    anomalyCounts = countAnomalies(allAnomalies);

    const codexMetaByDate = new Map((codexParsed.entryMeta ?? []).map((row) => [row.date, row.meta]));

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

    entries = mergeEntries(claudeEntries, codexEntries);
    rawHashInput = codexParsed.fingerprint ? agentsViewRaw + codexParsed.fingerprint : agentsViewRaw;
    const hybridCollector: UsageSubmitRequest["collector"] = {};
    if (claudeEntries.length > 0) hybridCollector.claude = AGENTSVIEW_COLLECTOR;
    if (codexEntries.length > 0) hybridCollector.codex = CODEX_NATIVE_COLLECTOR;
    collector = Object.keys(hybridCollector).length > 0 ? hybridCollector : undefined;
  } else {
    // Legacy fallback path: ccusage + native Codex.
    //
    // Try to ensure ccusage is installed. In a TTY this prompts the user and
    // runs `bun add -g` / `npm install -g`. We catch the throw rather than
    // propagating it: Codex-only users (no Claude data) shouldn't be blocked
    // by a missing ccusage. If ccusage is genuinely required, the runCcusage
    // call below will surface the "not installed" error and we treat it the
    // same as missing Claude data.
    let ccusageReady = true;
    try {
      await ensureCcusageInstalled(config);
    } catch {
      ccusageReady = false;
    }

    const [claudeResult, codexParsed] = await Promise.all([
      ccusageReady
        ? runCcusageRawAsync(sinceStr, untilStr, options.timeoutMs).catch((err: Error) => err)
        : Promise.resolve(
            new Error("ccusage is not installed or not on PATH"),
          ),
      collectCodexUsageAsync(sinceStr, untilStr).catch(() => {
        codexCollectFailed = true;
        return {
          data: [],
          anomalies: [],
          entryMeta: [],
          fingerprint: "",
          scannedFiles: 0,
          parsedEvents: 0,
        };
      }),
    ]);
    scanSpinner.stop();

    let claudeRaw = "";
    let claudeEntries: CcusageDailyEntry[] = [];
    let claudeAnomalies: NormalizationAnomaly[] = [];

    if (claudeResult instanceof Error) {
      // Codex-only users do not have local Claude data; keep other Claude failures fatal.
      if (
        isMissingClaudeDataError(claudeResult) ||
        isCcusageNotInstalledError(claudeResult)
      ) {
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
        claudeAnomalies = parsed.anomalies ?? [];
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }
    }

    allAnomalies = [
      ...claudeAnomalies,
      ...(codexParsed.anomalies ?? []),
    ];
    anomalyCounts = countAnomalies(allAnomalies);

    const codexMetaByDate = new Map((codexParsed.entryMeta ?? []).map((row) => [row.date, row.meta]));

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

    entries = mergeEntries(claudeEntries, codexEntries);
    rawHashInput = codexParsed.fingerprint ? claudeRaw + codexParsed.fingerprint : claudeRaw;
    const legacyCollector: UsageSubmitRequest["collector"] = {};
    if (claudeEntries.length > 0) legacyCollector.claude = "ccusage-v18";
    if (codexEntries.length > 0) legacyCollector.codex = CODEX_NATIVE_COLLECTOR;
    collector = Object.keys(legacyCollector).length > 0 ? legacyCollector : undefined;
  }

  // Token-normalization anomalies are diagnostic, not user-actionable: rows
  // tagged medium/low confidence still get pushed (we just had to infer cache
  // semantics). Only native Codex `mode === "unresolved"` rows are dropped.
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

  const hash = createHash("sha256").update(rawHashInput).digest("hex");

  const body: UsageSubmitRequest = {
    entries: entries.map((entry) => ({
      date: entry.date,
      data: entry,
    })),
    hash,
    collector,
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
  if (shouldRunCodexRepair && !codexCollectFailed && blockedDates.size === 0) {
    config.codex_native_repair_completed_at = new Date().toISOString();
    config.last_push_date = latestDate;
    saveConfig(config);
  } else {
    updateLastPushDate(latestDate);
  }

  const totalCost = entries.reduce((sum, e) => sum + e.costUSD, 0);
  const totalTokens = entries.reduce((sum, e) => sum + e.totalTokens, 0);
  const datesCreated = response.results.filter((r) => r.action === "created").length;
  const datesUpdated = response.results.filter((r) => r.action === "updated").length;
  // Wrap telemetry capture in try/catch — a property assembly bug or
  // PostHog hiccup must never crash the user-facing command.
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
        collector_mode: selectedCollector,
        collector_preference: collectorPreference,
        agentsview_available: agentsViewAvailable,
        codex_repair_pending: shouldRunCodexRepair,
        agentsview_version: agentsViewVersion,
      },
    });
  } catch {
    // Telemetry failure is non-fatal.
  }

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

function countAnomalies(
  anomalies: NormalizationAnomaly[],
): { mediumLow: number; low: number; unresolved: number } {
  return {
    mediumLow: anomalies.filter((a) => a.confidence !== "high").length,
    low: anomalies.filter((a) => a.confidence === "low").length,
    unresolved: anomalies.filter((a) => a.mode === "unresolved").length,
  };
}
