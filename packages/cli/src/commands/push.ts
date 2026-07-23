import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { performance } from "node:perf_hooks";
import {
  canonicalizeUsageEntryV2,
  parseUsageSubmitResponseV2,
  parseUsageSubmitV2,
  type AgentUsageComponent,
  type UsageEntryV2,
  type UsageOutcomeV2,
  type UsageSubmitRequestV2,
  type UsageSubmitResultV2,
} from "@straude/shared/usage-protocol";
import { MAX_BACKFILL_DAYS, DEFAULT_SYNC_DAYS, CLI_VERSION } from "../config.js";
import { apiRequest, ApiHttpError, ApiTimeoutError } from "../lib/api.js";
import { loadConfig, updateConfig, type StraudeConfig } from "../lib/auth.js";
import {
  addCalendarDays,
  assertCalendarDate,
  calendarDateToLocalDate,
  calendarDaysBetween,
  compactCalendarDate,
  listCalendarDates,
  localDateToCalendarDate,
} from "../lib/calendar.js";
import {
  CCUSAGE_DEFAULT_PRICING_MODE,
  PricingUnavailableError,
  collectCcusageUsageAsync,
  resolveLocalTimezone,
  type CcusageAgentEntry,
  type CcusageCollectorMeta,
  type CcusageDailyEntry,
} from "../lib/ccusage.js";
import { getDistinctId, getInstallationId } from "../lib/machine-id.js";
import { isInteractive } from "../lib/prompt.js";
import { posthog } from "../lib/posthog.js";
import { Spinner } from "../lib/spinner.js";
import {
  acquireSyncLease,
  loadPendingBatches,
  removePendingBatch,
  upsertPendingBatch,
  type PendingRangeMode,
  type PendingUsageBatch,
} from "../lib/sync-state.js";
import {
  TELEMETRY_SHUTDOWN_TIMEOUT_MS,
  errorMessage,
  reportUsagePushFailed,
  shutdownTelemetryWithTimeout,
} from "../lib/telemetry.js";
import { NonInteractiveLoginError, loginCommand } from "./login.js";
import type { DashboardData as DashboardResponse } from "../components/PushSummary.js";

const FIRST_OR_MIGRATION_SYNC_DAYS = 3;
const SUBMIT_DEADLINE_MS = 15_000;
const DASHBOARD_DEADLINE_MS = 3_000;
const PROTOCOL_RETRY_ATTEMPTS = 3;
const MIGRATION_ID = "ccusage-by-agent-v2";

export const CLI_EXIT = {
  OK: 0,
  PERMANENT: 1,
  AUTH_REQUIRED: 2,
  TEMPORARY: 75,
} as const;

export interface PushOptions {
  date?: string;
  days?: number;
  dryRun?: boolean;
  timeoutMs?: number;
  nonInteractive?: boolean;
}

type PushRangeMode = PendingRangeMode;

interface PushTimings {
  auth_ms?: number;
  collection_ms?: number;
  submit_ms?: number;
  dashboard_ms?: number;
}

interface DateRangeResolutionSuccess {
  ok: true;
  since: Date;
  until: Date;
  mode: PushRangeMode;
}

export type DateRangeResolution =
  | DateRangeResolutionSuccess
  | { ok: false; error: string };

interface SubmitBatchResult {
  complete: boolean;
  exitCode: number;
  results: DatedUsageResult[];
  identityConflict: boolean;
  retryCount: number;
}

type DatedUsageResult = UsageSubmitResultV2 & { date: string };

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function dateFromInput(value: string): Date {
  return calendarDateToLocalDate(assertCalendarDate(value));
}

export function resolvePushDateRange(args: {
  today: Date;
  options: { date?: string; days?: number };
  lastPushDate?: string;
  shouldRunMigrationBackfill: boolean;
}): DateRangeResolution {
  const { options, shouldRunMigrationBackfill } = args;
  const today = localDateToCalendarDate(args.today);

  if (options.date !== undefined) {
    let target: string;
    try {
      target = assertCalendarDate(options.date);
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
    const age = calendarDaysBetween(target, today);
    if (age < 0) return { ok: false, error: "Cannot push usage for a future date." };
    if (age > MAX_BACKFILL_DAYS) {
      return { ok: false, error: `Date must be within the last ${MAX_BACKFILL_DAYS} days.` };
    }
    const date = dateFromInput(target);
    return { ok: true, since: date, until: date, mode: "explicit_date" };
  }

  if (options.days !== undefined) {
    if (
      !Number.isSafeInteger(options.days)
      || options.days < 1
      || options.days > MAX_BACKFILL_DAYS
    ) {
      return {
        ok: false,
        error: `Days must be an integer between 1 and ${MAX_BACKFILL_DAYS}.`,
      };
    }
    return {
      ok: true,
      since: dateFromInput(addCalendarDays(today, -options.days + 1)),
      until: dateFromInput(today),
      mode: "explicit_days",
    };
  }

  if (!args.lastPushDate) {
    return {
      ok: true,
      since: dateFromInput(addCalendarDays(today, -FIRST_OR_MIGRATION_SYNC_DAYS + 1)),
      until: dateFromInput(today),
      mode: "first_sync",
    };
  }

  if (shouldRunMigrationBackfill) {
    return {
      ok: true,
      since: dateFromInput(addCalendarDays(today, -FIRST_OR_MIGRATION_SYNC_DAYS + 1)),
      until: dateFromInput(today),
      mode: "migration",
    };
  }

  try {
    assertCalendarDate(args.lastPushDate, "last push date");
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  if (args.lastPushDate >= today) {
    const date = dateFromInput(today);
    return { ok: true, since: date, until: date, mode: "incremental" };
  }

  const since = addCalendarDays(args.lastPushDate, 1);
  const until = calendarDaysBetween(since, today) >= DEFAULT_SYNC_DAYS
    ? addCalendarDays(since, DEFAULT_SYNC_DAYS - 1)
    : today;
  return {
    ok: true,
    since: dateFromInput(since),
    until: dateFromInput(until),
    mode: "incremental",
  };
}

export function isWithinBackfillWindow(date: string, today = new Date()): boolean {
  try {
    assertCalendarDate(date);
    const age = calendarDaysBetween(date, localDateToCalendarDate(today));
    return age >= 0 && age <= MAX_BACKFILL_DAYS;
  } catch {
    return false;
  }
}

function toWireAgent(agent: CcusageAgentEntry): AgentUsageComponent {
  return {
    agent: agent.agent,
    models: [...agent.models].sort(),
    input_tokens: agent.inputTokens,
    output_tokens: agent.outputTokens,
    reasoning_output_tokens: agent.reasoningOutputTokens,
    cache_creation_tokens: agent.cacheCreationTokens,
    cache_read_tokens: agent.cacheReadTokens,
    total_tokens: agent.totalTokens,
    cost_usd: agent.costUSD,
    model_breakdown: agent.modelBreakdown.map((model) => ({
      model: model.model,
      input_tokens: model.inputTokens,
      output_tokens: model.outputTokens,
      reasoning_output_tokens: model.reasoningOutputTokens,
      cache_creation_tokens: model.cacheCreationTokens,
      cache_read_tokens: model.cacheReadTokens,
      total_tokens: model.totalTokens,
      cost_usd: model.cost_usd,
    })),
  };
}

function createUsageEntry(
  entry: CcusageDailyEntry,
  migration: boolean,
): UsageEntryV2 {
  const withoutHash: UsageEntryV2 = {
    date: entry.date,
    content_hash: "0".repeat(64),
    agents: entry.agentBreakdown.map(toWireAgent),
    ...(migration
      ? {
        authoritative_correction: true,
        migration_id: MIGRATION_ID,
      }
      : {}),
  };
  return {
    ...withoutHash,
    content_hash: createHash("sha256")
      .update(canonicalizeUsageEntryV2(withoutHash))
      .digest("hex"),
  };
}

function createRequest(args: {
  config: StraudeConfig;
  timezone: string;
  collector: CcusageCollectorMeta;
  entries: CcusageDailyEntry[];
  migration: boolean;
}): UsageSubmitRequestV2 {
  const installationId = getInstallationId();
  const previousDeviceId = !args.config.previous_device_id_migrated_at
    && args.config.device_id !== installationId
    ? args.config.device_id
    : undefined;
  const request: UsageSubmitRequestV2 = {
    protocol_version: 2,
    request_id: randomUUID(),
    source: "cli",
    timezone: args.timezone,
    installation: {
      id: installationId,
      ...(previousDeviceId ? { previous_device_id: previousDeviceId } : {}),
      name: args.config.device_name ?? hostname(),
    },
    collector: {
      name: "ccusage",
      version: args.collector.ccusage_version,
      pricing_mode: args.collector.pricing_mode,
      metadata: {
        agents: args.collector.ccusage_agents,
        ...(args.collector.claude ? { claude: args.collector.claude } : {}),
        ...(args.collector.codex ? { codex: args.collector.codex } : {}),
      },
    },
    entries: args.entries.map((entry) => createUsageEntry(entry, args.migration)),
  };
  const parsed = parseUsageSubmitV2(request);
  if (!parsed.ok) {
    throw new Error(
      `Refusing to persist an invalid usage request (${parsed.error.code} at ${parsed.error.path ?? "request"}): ${parsed.error.message}`,
    );
  }
  return parsed.value;
}

function classifySubmitError(error: unknown, interactive: boolean): number {
  if (error instanceof ApiHttpError) {
    if (error.status === 401 && !interactive) return CLI_EXIT.AUTH_REQUIRED;
    if (error.retryable) return CLI_EXIT.TEMPORARY;
    return CLI_EXIT.PERMANENT;
  }
  if (
    error instanceof ApiTimeoutError
    || error instanceof TypeError
    || (error instanceof Error && [
      "ECONNRESET",
      "ECONNREFUSED",
      "EAI_AGAIN",
      "ENETUNREACH",
    ].includes((error as NodeJS.ErrnoException).code ?? ""))
  ) {
    return CLI_EXIT.TEMPORARY;
  }
  return CLI_EXIT.PERMANENT;
}

function outcomeExitCode(outcomes: UsageOutcomeV2[]): number {
  if (outcomes.some((outcome) => (
    outcome.status === "permanent_error" || outcome.status === "identity_conflict"
  ))) {
    return CLI_EXIT.PERMANENT;
  }
  if (outcomes.some((outcome) => outcome.status === "retryable_error")) {
    return CLI_EXIT.TEMPORARY;
  }
  return CLI_EXIT.OK;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function submitBatch(
  config: StraudeConfig,
  batch: PendingUsageBatch,
  interactive: boolean,
): Promise<SubmitBatchResult> {
  const submitDeadline = Date.now() + SUBMIT_DEADLINE_MS;
  const terminal = new Map<string, UsageOutcomeV2>();
  let retryable = [...batch.request.entries];
  let remaining = [...batch.request.entries];
  let lastAttempt = 0;

  for (let attempt = 0; attempt < PROTOCOL_RETRY_ATTEMPTS && retryable.length > 0; attempt += 1) {
    lastAttempt = attempt;
    const request: UsageSubmitRequestV2 = {
      ...batch.request,
      entries: retryable,
    };
    try {
      const rawResponse = await apiRequest<unknown>(
        config,
        "/api/usage/submit",
        {
          method: "POST",
          body: JSON.stringify(request),
          headers: {
            "X-Straude-CLI-Version": CLI_VERSION,
            "X-Straude-Retry-Attempt": String(attempt),
          },
          timeoutMs: Math.max(1, submitDeadline - Date.now()),
          deadlineAt: submitDeadline,
          maxRetries: 0,
          acceptedStatuses: [400, 409, 503],
        },
      );
      const parsed = parseUsageSubmitResponseV2(rawResponse);
      if (!parsed.ok) {
        throw new Error(
          `Invalid v2 usage response (${parsed.error.code}): ${parsed.error.message}`,
        );
      }
      if (parsed.value.request_id !== batch.request.request_id) {
        throw new Error("Usage response request_id did not match the submitted request.");
      }
      const submittedDates = new Set(retryable.map((entry) => entry.date));
      const outcomeDates = new Set(parsed.value.outcomes.map((outcome) => outcome.date));
      if (
        outcomeDates.size !== submittedDates.size
        || [...submittedDates].some((date) => !outcomeDates.has(date))
      ) {
        throw new Error("Usage response did not include exactly one outcome per submitted date.");
      }

      for (const outcome of parsed.value.outcomes) terminal.set(outcome.date, outcome);
      const successfulDates = new Set(
        [...terminal.values()]
          .filter((outcome) => outcome.status === "committed" || outcome.status === "unchanged")
          .map((outcome) => outcome.date),
      );
      remaining = batch.request.entries.filter((entry) => !successfulDates.has(entry.date));
      const queued = batch.request.entries.filter((entry) => {
        const status = terminal.get(entry.date)?.status;
        return status === "retryable_error" || status === "identity_conflict";
      });
      const permanentDates = new Set(
        [...terminal.values()]
          .filter((outcome) => outcome.status === "permanent_error")
          .map((outcome) => outcome.date),
      );
      if (queued.length > 0) {
        const firstPermanentIndex = batch.requested_dates.findIndex(
          (date) => permanentDates.has(date),
        );
        const originalWatermarkIndex = batch.watermark_date
          ? batch.requested_dates.indexOf(batch.watermark_date)
          : -1;
        const safeWatermarkIndex = firstPermanentIndex === -1
          ? originalWatermarkIndex
          : Math.min(originalWatermarkIndex, firstPermanentIndex - 1);
        const { watermark_date: _watermark, ...batchWithoutWatermark } = batch;
        upsertPendingBatch({
          ...batchWithoutWatermark,
          request: { ...batch.request, entries: queued },
          ...(safeWatermarkIndex >= 0
            ? { watermark_date: batch.requested_dates[safeWatermarkIndex] }
            : {}),
          migration_pending: batch.migration_pending && permanentDates.size === 0,
        });
      } else if (permanentDates.size > 0) {
        removePendingBatch(batch.request.request_id);
      }
      retryable = queued.filter((entry) => terminal.get(entry.date)?.status === "retryable_error");

      if (retryable.length > 0 && attempt + 1 < PROTOCOL_RETRY_ATTEMPTS) {
        const retryAfter = Math.max(
          0,
          ...retryable.map((entry) => terminal.get(entry.date)?.error?.retry_after_ms ?? 0),
        );
        const delay = retryAfter > 0 ? retryAfter : Math.random() * 500 * 2 ** attempt;
        if (Date.now() + delay >= submitDeadline) break;
        await sleep(delay);
      }
    } catch (error) {
      const exitCode = classifySubmitError(error, interactive);
      if (exitCode === CLI_EXIT.TEMPORARY && attempt + 1 < PROTOCOL_RETRY_ATTEMPTS) {
        const retryAfter = error instanceof ApiHttpError
          ? error.retryAfterMs ?? 0
          : 0;
        const delay = retryAfter > 0
          ? retryAfter
          : Math.random() * 500 * 2 ** attempt;
        if (Date.now() + delay < submitDeadline) {
          await sleep(delay);
          continue;
        }
      }
      reportUsagePushFailed(config, error, {
        command: "push",
        stage: "submit",
        request_id: batch.request.request_id,
        retry_count: attempt,
        error_code: error instanceof ApiHttpError ? `HTTP_${error.status}` : "SUBMIT_FAILED",
      });
      return {
        complete: false,
        exitCode,
        results: [],
        identityConflict: false,
        retryCount: attempt,
      };
    }
  }

  const outcomes = remaining
    .map((entry) => terminal.get(entry.date))
    .filter((outcome): outcome is UsageOutcomeV2 => outcome !== undefined);
  const exitCode = outcomeExitCode(outcomes);
  const results = [...terminal.values()]
    .flatMap((outcome): DatedUsageResult[] => (
      outcome.result ? [{ date: outcome.date, ...outcome.result }] : []
    ));
  if (remaining.length === 0) {
    return {
      complete: true,
      exitCode: CLI_EXIT.OK,
      results,
      identityConflict: false,
      retryCount: lastAttempt,
    };
  }
  return {
    complete: false,
    exitCode: exitCode === CLI_EXIT.OK ? CLI_EXIT.TEMPORARY : exitCode,
    results,
    identityConflict: outcomes.some((outcome) => outcome.status === "identity_conflict"),
    retryCount: lastAttempt,
  };
}

function advanceCompletedBatch(batch: PendingUsageBatch): StraudeConfig {
  return updateConfig((current) => {
    if (!current) throw new Error("Authentication disappeared while syncing.");
    const {
      codex_native_repair_completed_at: _obsoleteRepair,
      codex_native_last_token_usage_repair_completed_at: _obsoleteLastTokenRepair,
      ccusage_v20_migration_completed_at: _obsoleteV20Migration,
      ...preserved
    } = current;
    const automatic = batch.range_mode === "incremental"
      || batch.range_mode === "first_sync"
      || batch.range_mode === "migration";
    const lastDate = batch.watermark_date;
    return {
      ...preserved,
      ...(automatic && lastDate ? { last_push_date: lastDate } : {}),
      ...(batch.migration_pending
        ? { usage_protocol_v2_migration_completed_at: new Date().toISOString() }
        : {}),
      ...(batch.request.installation.previous_device_id
        ? { previous_device_id_migrated_at: new Date().toISOString() }
        : {}),
    };
  });
}

function printDryRun(entries: CcusageDailyEntry[]): void {
  for (const entry of entries) {
    console.log(`  ${entry.date}:`);
    console.log(`    Cost: ${formatCost(entry.costUSD)}`);
    console.log(
      `    Tokens: ${formatTokens(entry.totalTokens)} (input: ${formatTokens(entry.inputTokens)}, output: ${formatTokens(entry.outputTokens)})`,
    );
    for (const agent of entry.agentBreakdown) {
      console.log(
        `    ${agent.agent}: ${formatCost(agent.costUSD)}, ${formatTokens(agent.totalTokens)} tokens`,
      );
    }
  }
  console.log("\n(dry run, nothing submitted)");
}

function printSubmitSuccess(
  entries: CcusageDailyEntry[],
  results: DatedUsageResult[],
): void {
  const totalCost = entries.reduce((sum, entry) => sum + entry.costUSD, 0);
  const totalTokens = entries.reduce((sum, entry) => sum + entry.totalTokens, 0);
  const created = results.filter((result) => result.action === "created").length;
  const updated = results.filter((result) => result.action === "updated").length;
  console.log("");
  console.log(
    `Synced ${entries.length} ${pluralize(entries.length, "day")} (${formatCost(totalCost)}, ${formatTokens(totalTokens)} tokens).`,
  );
  if (created > 0 || updated > 0) console.log(`Posted ${created}, updated ${updated}.`);
  const primary = results[0];
  if (primary) {
    console.log(`View it: ${primary.post_url}${primary.post_url.includes("?") ? "&" : "?"}edit=1`);
  }
}

async function renderDashboard(
  config: StraudeConfig,
  results: DatedUsageResult[],
): Promise<{ rendered: boolean; durationMs: number }> {
  const startedAt = performance.now();
  try {
    const dashboard = await apiRequest<DashboardResponse>(
      config,
      "/api/cli/dashboard",
      { timeoutMs: DASHBOARD_DEADLINE_MS, maxRetries: 0 },
    );
    const { render } = await import("ink");
    const { createElement } = await import("react");
    const { PushSummary } = await import("../components/PushSummary.js");
    const { waitUntilExit } = render(createElement(PushSummary, { dashboard, results }));
    await waitUntilExit();
    return { rendered: true, durationMs: elapsedMs(startedAt) };
  } catch (error) {
    console.log("Usage synced; dashboard unavailable.");
    posthog.capture({
      distinctId: getDistinctId(config),
      event: "dashboard_degraded",
      properties: {
        error_code: error instanceof ApiTimeoutError ? "DASHBOARD_TIMEOUT" : "DASHBOARD_UNAVAILABLE",
        duration_ms: elapsedMs(startedAt),
      },
    });
    return { rendered: false, durationMs: elapsedMs(startedAt) };
  }
}

function telemetryProperties(args: {
  timings: PushTimings;
  totalStartedAt: number;
  rangeMode: PushRangeMode;
  requestId?: string;
  pricingMode?: string;
  ccusageVersion?: string;
  retryCount?: number;
  pricingRetryCount?: number;
}): Record<string, string | number | undefined> {
  return {
    range_mode: args.rangeMode,
    request_id: args.requestId,
    pricing_mode: args.pricingMode,
    ccusage_version: args.ccusageVersion,
    retry_count: args.retryCount,
    pricing_retry_count: args.pricingRetryCount,
    telemetry_shutdown_timeout_ms: TELEMETRY_SHUTDOWN_TIMEOUT_MS,
    total_ms: elapsedMs(args.totalStartedAt),
    ...args.timings,
  };
}

async function authenticate(
  apiUrlOverride: string | undefined,
  nonInteractive: boolean,
  timings: PushTimings,
): Promise<StraudeConfig | null> {
  let config = loadConfig();
  if (config) return apiUrlOverride ? { ...config, api_url: apiUrlOverride } : config;
  if (nonInteractive) {
    console.error("AUTH_REQUIRED: Run `straude login` in an interactive terminal.");
    return null;
  }

  const startedAt = performance.now();
  try {
    console.log("After authentication, Straude will continue into your first sync here.");
    await loginCommand(apiUrlOverride, { requireInteractive: true });
  } catch (error) {
    if (error instanceof NonInteractiveLoginError) {
      console.error(`AUTH_REQUIRED: ${error.message}`);
      return null;
    }
    throw error;
  } finally {
    timings.auth_ms = elapsedMs(startedAt);
  }
  config = loadConfig();
  if (!config) {
    console.error("Authentication completed without a saved Straude config.");
    return null;
  }
  return apiUrlOverride ? { ...config, api_url: apiUrlOverride } : config;
}

export async function pushCommand(
  options: PushOptions,
  apiUrlOverride?: string,
): Promise<number> {
  const totalStartedAt = performance.now();
  const timings: PushTimings = {};
  const nonInteractive = options.nonInteractive === true || !isInteractive();
  const config = await authenticate(apiUrlOverride, nonInteractive, timings);
  if (!config) return CLI_EXIT.AUTH_REQUIRED;

  const timezone = resolveLocalTimezone();
  const today = new Date();
  const migrationPending = !config.usage_protocol_v2_migration_completed_at;
  const resolution = resolvePushDateRange({
    today,
    options: { date: options.date, days: options.days },
    lastPushDate: config.last_push_date,
    shouldRunMigrationBackfill: migrationPending,
  });
  if (!resolution.ok) {
    console.error(resolution.error);
    return CLI_EXIT.PERMANENT;
  }

  const since = localDateToCalendarDate(resolution.since);
  const until = localDateToCalendarDate(resolution.until);
  let requestedDates = listCalendarDates(since, until);
  const automaticWatermarkDate = (
    resolution.mode === "incremental"
    || resolution.mode === "first_sync"
    || resolution.mode === "migration"
  )
    ? requestedDates.at(-1)
    : undefined;
  const isMigrationBatch = resolution.mode === "first_sync"
    || resolution.mode === "migration";
  const lease = await acquireSyncLease({
    dates: requestedDates,
    interactive: !nonInteractive,
  });
  if (!lease) {
    if (nonInteractive) {
      console.log("Sync already running; requested dates were safely queued.");
      return CLI_EXIT.OK;
    }
    console.error("Another sync is still running after 30 seconds. Retry later.");
    return CLI_EXIT.TEMPORARY;
  }

  try {
    const queuedDatesToConsume = resolution.mode === "first_sync" || resolution.mode === "migration"
      ? lease.queuedDates.filter((date) => requestedDates.includes(date))
      : lease.queuedDates;
    if (queuedDatesToConsume.length > 0) {
      const allDates = [...new Set([...requestedDates, ...queuedDatesToConsume])].sort();
      requestedDates = listCalendarDates(allDates[0]!, allDates.at(-1)!);
      if (calendarDaysBetween(requestedDates[0]!, requestedDates.at(-1)!) >= MAX_BACKFILL_DAYS) {
        console.error("Queued sync dates exceed the 30-day backfill window.");
        return CLI_EXIT.PERMANENT;
      }
    }

    for (const pending of loadPendingBatches()) {
      const pendingResult = await submitBatch(config, pending, !nonInteractive);
      if (!pendingResult.complete) {
        console.error(
          pendingResult.identityConflict
            ? "Device identity conflict. Run `straude devices` in an interactive terminal to resolve it."
            : pendingResult.exitCode === CLI_EXIT.AUTH_REQUIRED
            ? "AUTH_REQUIRED: Run `straude login` in an interactive terminal."
            : "A prior usage batch remains unsynced and will be retried without recollecting.",
        );
        return pendingResult.exitCode;
      }
      advanceCompletedBatch(pending);
      removePendingBatch(pending.request.request_id);
    }

    const effectiveSince = requestedDates[0]!;
    const effectiveUntil = requestedDates.at(-1)!;
    console.log(
      effectiveSince === effectiveUntil
        ? `Pushing usage for ${effectiveSince}...`
        : `Pushing usage for ${effectiveSince} to ${effectiveUntil}...`,
    );

    const spinner = new Spinner("scan");
    spinner.start();
    const collectionStartedAt = performance.now();
    let collected: Awaited<ReturnType<typeof collectCcusageUsageAsync>>;
    try {
      collected = await collectCcusageUsageAsync(
        compactCalendarDate(effectiveSince),
        compactCalendarDate(effectiveUntil),
        options.timeoutMs,
        {
          pricingMode: CCUSAGE_DEFAULT_PRICING_MODE,
          timezone,
        },
      );
      timings.collection_ms = elapsedMs(collectionStartedAt);
    } catch (error) {
      timings.collection_ms = elapsedMs(collectionStartedAt);
      const exitCode = error instanceof PricingUnavailableError
        ? CLI_EXIT.TEMPORARY
        : CLI_EXIT.PERMANENT;
      reportUsagePushFailed(config, error, {
        command: "push",
        stage: "scan",
        error_code: error instanceof PricingUnavailableError
          ? "PRICING_UNAVAILABLE"
          : "COLLECTOR_INVALID",
        ...telemetryProperties({
          timings,
          totalStartedAt,
          rangeMode: resolution.mode,
          pricingMode: CCUSAGE_DEFAULT_PRICING_MODE,
        }),
      });
      await shutdownTelemetryWithTimeout();
      console.error(`\nFailed to collect usage: ${errorMessage(error)}`);
      return exitCode;
    } finally {
      spinner.stop();
    }

    const requested = new Set(requestedDates);
    const entries = collected.data.filter((entry) => requested.has(entry.date));
    const unexpectedDates = collected.data
      .filter((entry) => !requested.has(entry.date))
      .map((entry) => entry.date);
    if (unexpectedDates.length > 0) {
      console.error(`Collector returned dates outside the requested range: ${unexpectedDates.join(", ")}`);
      return CLI_EXIT.PERMANENT;
    }

    if (options.dryRun) {
      printDryRun(entries);
      return CLI_EXIT.OK;
    }

    if (entries.length === 0) {
      const emptyBatch: PendingUsageBatch = {
        request: {
          protocol_version: 2,
          request_id: randomUUID(),
          source: "cli",
          timezone,
          installation: { id: getInstallationId(), name: config.device_name ?? hostname() },
          collector: {
            name: "ccusage",
            version: collected.version,
            pricing_mode: collected.collector.pricing_mode,
          },
          entries: [],
        },
        requested_dates: requestedDates,
        ...(automaticWatermarkDate ? { watermark_date: automaticWatermarkDate } : {}),
        range_mode: resolution.mode,
        migration_pending: isMigrationBatch,
        created_at: new Date().toISOString(),
      };
      advanceCompletedBatch(emptyBatch);
      lease.acknowledgeQueuedDates(queuedDatesToConsume);
      console.log("No usage data found for the specified period.");
      return CLI_EXIT.OK;
    }

    const request = createRequest({
      config,
      timezone,
      collector: collected.collector,
      entries,
      migration: resolution.mode === "first_sync" || resolution.mode === "migration",
    });
    const batch: PendingUsageBatch = {
      request,
      requested_dates: requestedDates,
      ...(automaticWatermarkDate ? { watermark_date: automaticWatermarkDate } : {}),
      range_mode: resolution.mode,
      migration_pending: isMigrationBatch,
      created_at: new Date().toISOString(),
    };
    upsertPendingBatch(batch);

    const syncSpinner = new Spinner("sync");
    syncSpinner.start();
    const submitStartedAt = performance.now();
    let submitted: SubmitBatchResult;
    try {
      submitted = await submitBatch(config, batch, !nonInteractive);
      timings.submit_ms = elapsedMs(submitStartedAt);
    } finally {
      syncSpinner.stop();
    }
    if (!submitted.complete) {
      console.error(
        submitted.identityConflict
          ? "Device identity conflict. Run `straude devices` in an interactive terminal to resolve it."
          : submitted.exitCode === CLI_EXIT.AUTH_REQUIRED
          ? "AUTH_REQUIRED: Run `straude login` in an interactive terminal."
          : submitted.exitCode === CLI_EXIT.PERMANENT
          ? "Usage was partially synced, but a date was permanently rejected. Fix the reported data or configuration before retrying."
          : "Usage was only partially synced. Committed dates were preserved; remaining dates will retry from the durable outbox.",
      );
      await shutdownTelemetryWithTimeout();
      return submitted.exitCode;
    }

    const updatedConfig = advanceCompletedBatch(batch);
    removePendingBatch(batch.request.request_id);
    lease.acknowledgeQueuedDates(queuedDatesToConsume);
    printSubmitSuccess(entries, submitted.results);
    const dashboard = await renderDashboard(updatedConfig, submitted.results);
    timings.dashboard_ms = dashboard.durationMs;

    posthog.capture({
      distinctId: getDistinctId(updatedConfig),
      event: "usage_pushed",
      properties: {
        protocol_version: 2,
        days_pushed: entries.length,
        dates_created: submitted.results.filter((result) => result.action === "created").length,
        dates_updated: submitted.results.filter((result) => result.action === "updated").length,
        total_cost_usd: entries.reduce((sum, entry) => sum + entry.costUSD, 0),
        total_tokens: entries.reduce((sum, entry) => sum + entry.totalTokens, 0),
        dashboard_rendered: dashboard.rendered,
        ...telemetryProperties({
          timings,
          totalStartedAt,
          rangeMode: resolution.mode,
          requestId: request.request_id,
          pricingMode: collected.collector.pricing_mode,
          ccusageVersion: collected.version,
          retryCount: submitted.retryCount,
          pricingRetryCount: collected.pricingRetryCount ?? 0,
        }),
      },
    });
    return CLI_EXIT.OK;
  } finally {
    lease.release();
  }
}
