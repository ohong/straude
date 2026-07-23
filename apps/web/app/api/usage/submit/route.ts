import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  canonicalizeUsageEntryV2,
  parseUsageSubmitV2,
  parseUsageSubmitResponseV2,
  type AgentUsageComponent,
  type JsonValue,
  type ModelUsageComponent,
  type UsageEntryV2,
  type UsageOutcomeV2,
  type UsageSubmitRequestV2,
  type UsageSubmitResponseV2,
} from "@straude/shared/usage-protocol";
import { after } from "@/lib/utils/after";
import { captureServerActivationEvent } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";
import { verifyCliTokenWithRefresh } from "@/lib/api/cli-auth";
import { getServiceClient } from "@/lib/supabase/service";
import { checkAndAwardAchievements } from "@/lib/achievements";
import { rateLimit } from "@/lib/rate-limit";
import type {
  CcusageDailyEntry,
  UsageCollectorMeta,
  UsageSubmitResponse,
} from "@/types";

const MAX_BACKFILL_DAYS = 30;
const MAX_USAGE_ENTRIES = MAX_BACKFILL_DAYS + 2;
const MAX_USAGE_BODY_BYTES = 256 * 1024;
const USAGE_PROCESS_CONCURRENCY = 4;
const COST_EPSILON_USD = 0.005;
const DEFAULT_V1_CUTOFF = "2026-08-06";
const RETRYABLE_DATABASE_CODES = new Set([
  "40001",
  "40P01",
  "53300",
  "55P03",
  "57014",
  "57P01",
  "57P02",
  "57P03",
]);
const TRUSTED_CORRECTION_COLLECTORS = new Set([
  "straude-codex-native-last-token-usage",
  "ccusage-codex-v20",
]);

interface AuthContext {
  userId: string;
  source: "cli" | "web";
  refreshedToken?: string | null;
}

interface RpcError {
  code?: string;
  message: string;
}

interface UsageRpcClient {
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: RpcError | null }>;
}

interface JsonReadSuccess {
  ok: true;
  body: unknown;
}

interface JsonReadFailure {
  ok: false;
  response: NextResponse;
}

type JsonReadResult = JsonReadSuccess | JsonReadFailure;

interface LegacyAdaptResult {
  request: UsageSubmitRequestV2;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isV2Request(value: unknown): boolean {
  return isRecord(value) && value.protocol_version === 2;
}

function isLegacyProtocolSunset(): boolean {
  const configured = process.env.STRAUDE_USAGE_V1_CUTOFF ?? DEFAULT_V1_CUTOFF;
  const cutoff = Date.parse(`${configured}T00:00:00Z`);
  return Number.isFinite(cutoff) && Date.now() >= cutoff;
}

async function readJsonBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<JsonReadResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Request body too large" }, { status: 413 }),
      };
    }
  }
  if (!request.body) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Request body too large" }, { status: 413 }),
      };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
}

async function resolveAuthContext(request: Request): Promise<AuthContext | null> {
  const cliAuth = verifyCliTokenWithRefresh(request.headers.get("authorization"));
  if (cliAuth) {
    return {
      userId: cliAuth.userId,
      source: "cli",
      refreshedToken: cliAuth.refreshedToken,
    };
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ? { userId: user.id, source: "web" } : null;
  } catch {
    return null;
  }
}

function calendarDateInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function isWithinBackfillWindow(date: string, timezone = "UTC"): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;
  const targetDay = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const localToday = calendarDateInTimezone(timezone);
  const today = Date.UTC(
    Number(localToday.slice(0, 4)),
    Number(localToday.slice(5, 7)) - 1,
    Number(localToday.slice(8, 10)),
  );
  const difference = Math.round((today - targetDay) / 86_400_000);
  return difference >= 0 && difference <= MAX_BACKFILL_DAYS;
}

function hashCanonicalEntry(entry: UsageEntryV2): string {
  return createHash("sha256")
    .update(canonicalizeUsageEntryV2(entry))
    .digest("hex");
}

function sumAgentUsage(agents: AgentUsageComponent[]) {
  return agents.reduce((total, agent) => ({
    cost_usd: total.cost_usd + agent.cost_usd,
    total_tokens: total.total_tokens + agent.total_tokens,
  }), { cost_usd: 0, total_tokens: 0 });
}

function isRetryableRpcError(error: RpcError): boolean {
  if (error.code && RETRYABLE_DATABASE_CODES.has(error.code)) return true;
  return /(connection|timeout|temporar|unavailable|too many clients|network)/i.test(error.message);
}

function responseHeaders(auth: AuthContext): Record<string, string> {
  return auth.source === "cli" && auth.refreshedToken
    ? { "X-Straude-Refreshed-Token": auth.refreshedToken }
    : {};
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function submitEntry(
  db: UsageRpcClient,
  auth: AuthContext,
  request: UsageSubmitRequestV2,
  entry: UsageEntryV2,
  appUrl: string,
  cliVersion: string | null,
  retryAttempt: number,
): Promise<UsageOutcomeV2> {
  const startedAt = performance.now();
  const finish = (outcome: UsageOutcomeV2): UsageOutcomeV2 => {
    const elapsedMs = Math.round(performance.now() - startedAt);
    console.info(JSON.stringify({
      event: "usage_submit_day",
      protocol_version: request.protocol_version,
      request_id: request.request_id,
      date: entry.date,
      source: request.source,
      collector_name: request.collector.name,
      collector_version: request.collector.version,
      cli_version: cliVersion,
      stage_timings_ms: {
        transaction: elapsedMs,
        total: elapsedMs,
      },
      outcome: outcome.status,
      error_code: outcome.error?.code ?? null,
      retry_count: retryAttempt,
    }));
    return outcome;
  };
  const canonicalPayloadHash = hashCanonicalEntry(entry);
  const { data, error } = await db.rpc("submit_usage_day_v2", {
    p_user_id: auth.userId,
    p_request_id: request.request_id,
    p_source: request.source,
    p_timezone: request.timezone,
    p_installation: request.installation,
    p_collector: request.collector,
    p_entry: entry,
    p_canonical_payload_hash: canonicalPayloadHash,
    p_is_verified: auth.source === "cli",
  });
  if (error) {
    const retryable = isRetryableRpcError(error);
    return finish({
      date: entry.date,
      status: retryable ? "retryable_error" : "permanent_error",
      error: {
        code: error.code ?? "database_error",
        message: retryable
          ? "Usage transaction is temporarily unavailable"
          : "Usage transaction failed",
      },
    });
  }
  const rawCandidate = Array.isArray(data) ? data[0] : data;
  const candidate = isRecord(rawCandidate)
    && isRecord(rawCandidate.result)
    && typeof rawCandidate.result.post_id === "string"
    && typeof rawCandidate.result.post_url !== "string"
    ? {
      ...rawCandidate,
      result: {
        ...rawCandidate.result,
        post_url: `${appUrl}/post/${rawCandidate.result.post_id}`,
      },
    }
    : rawCandidate;
  const parsedResponse = parseUsageSubmitResponseV2({
    request_id: request.request_id,
    outcomes: [candidate],
  });
  if (!parsedResponse.ok) {
    return finish({
      date: entry.date,
      status: "retryable_error",
      error: {
        code: "invalid_rpc_response",
        message: "Usage transaction returned an invalid response",
      },
    });
  }
  const parsedOutcome = parsedResponse.value.outcomes[0]!;
  return finish(parsedOutcome);
}

function statusForOutcomes(outcomes: UsageOutcomeV2[], allowPartialSuccess: boolean): number {
  const hasSuccess = outcomes.some(
    (outcome) => outcome.status === "committed" || outcome.status === "unchanged",
  );
  const hasFailure = outcomes.some(
    (outcome) => outcome.status !== "committed" && outcome.status !== "unchanged",
  );
  if (allowPartialSuccess && hasSuccess && hasFailure) return 207;
  if (outcomes.some((outcome) => outcome.status === "identity_conflict")) return 409;
  if (outcomes.some((outcome) => outcome.status === "permanent_error")) return 400;
  if (outcomes.some((outcome) => outcome.status === "retryable_error")) return 503;
  return 200;
}

function legacyError(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function isLegacyError(
  value: unknown,
): value is { ok: false; error: string } {
  return isRecord(value) && value.ok === false && typeof value.error === "string";
}

function readLegacyNumber(
  value: unknown,
  field: string,
  date: string,
): number | { ok: false; error: string } {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return legacyError(`Invalid ${field} for ${date}`);
  }
  return value;
}

function legacyAgentId(entry: CcusageDailyEntry): string {
  void entry;
  return "legacy-unpartitioned";
}

function legacyEntryIsCodexOnly(entry: CcusageDailyEntry): boolean {
  if (entry.agents?.length === 1) return entry.agents[0] === "codex";
  return entry.models.length > 0
    && entry.models.every((model) => /^(gpt-|o3|o4|codex)/i.test(model));
}

function legacyModelBreakdown(
  entry: CcusageDailyEntry,
  numbers: Omit<ModelUsageComponent, "model">,
): ModelUsageComponent[] | { ok: false; error: string } {
  const models = [...new Set(entry.models)];
  if (models.length === 1) {
    return [{ model: models[0]!, ...numbers }];
  }

  const costs = new Map<string, number>();
  for (const item of entry.modelBreakdown ?? []) {
    if (
      !item
      || typeof item.model !== "string"
      || item.model.length === 0
      || typeof item.cost_usd !== "number"
      || !Number.isFinite(item.cost_usd)
      || item.cost_usd < 0
    ) {
      return legacyError(`Invalid model breakdown for ${entry.date}`);
    }
    costs.set(item.model, (costs.get(item.model) ?? 0) + item.cost_usd);
  }
  const attributedCost = [...costs.values()].reduce((sum, cost) => sum + cost, 0);
  if (attributedCost > numbers.cost_usd + COST_EPSILON_USD) {
    return legacyError(`Model breakdown exceeds total cost for ${entry.date}`);
  }

  for (const model of models) {
    if (!costs.has(model)) costs.set(model, 0);
  }
  const breakdown = [...costs.entries()].map(([model, cost]) => ({
    model,
    input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    cache_creation_tokens: 0,
    cache_read_tokens: 0,
    total_tokens: 0,
    cost_usd: cost,
  }));
  const unattributedModel = models.includes("legacy-unattributed")
    ? "legacy-combined-unattributed"
    : "legacy-unattributed";
  breakdown.push({
    model: unattributedModel,
    ...numbers,
    cost_usd: Math.max(numbers.cost_usd - attributedCost, 0),
  });
  return breakdown;
}

function legacyEntryToV2(
  outerDate: string,
  entry: CcusageDailyEntry,
  collector: UsageCollectorMeta | undefined,
): UsageEntryV2 | { ok: false; error: string } {
  if (entry.date !== outerDate || !isWithinBackfillWindow(outerDate)) {
    return legacyError(
      `Date ${outerDate} is invalid or outside the 30-day backfill window`,
    );
  }
  if (!Array.isArray(entry.models) || entry.models.some((model) => typeof model !== "string")) {
    return legacyError(`Invalid models for ${outerDate}`);
  }
  const input = readLegacyNumber(entry.inputTokens, "input tokens", outerDate);
  if (typeof input !== "number") return input;
  const output = readLegacyNumber(entry.outputTokens, "output tokens", outerDate);
  if (typeof output !== "number") return output;
  const cacheCreation = readLegacyNumber(entry.cacheCreationTokens, "cache creation tokens", outerDate);
  if (typeof cacheCreation !== "number") return cacheCreation;
  const cacheRead = readLegacyNumber(entry.cacheReadTokens, "cache read tokens", outerDate);
  if (typeof cacheRead !== "number") return cacheRead;
  const total = readLegacyNumber(entry.totalTokens, "total tokens", outerDate);
  if (typeof total !== "number") return total;
  const inferredReasoning = total - input - output - cacheCreation - cacheRead;
  const reasoning = readLegacyNumber(
    entry.reasoningOutputTokens ?? inferredReasoning,
    "reasoning tokens",
    outerDate,
  );
  if (typeof reasoning !== "number") return reasoning;
  const cost = readLegacyNumber(entry.costUSD, "cost", outerDate);
  if (typeof cost !== "number") return cost;
  if (total !== input + output + reasoning + cacheCreation + cacheRead) {
    return legacyError(`Token categories do not equal total tokens for ${outerDate}`);
  }

  const numeric = {
    input_tokens: input,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    cache_creation_tokens: cacheCreation,
    cache_read_tokens: cacheRead,
    total_tokens: total,
    cost_usd: cost,
  };
  const modelBreakdown = legacyModelBreakdown(entry, numeric);
  if (!Array.isArray(modelBreakdown)) return modelBreakdown;
  const models = modelBreakdown.map((model) => model.model);
  const agentId = legacyAgentId(entry);
  const agents: AgentUsageComponent[] = [{
    agent: agentId,
    models,
    ...numeric,
    model_breakdown: modelBreakdown,
  }];
  const trustedCodexCorrection = legacyEntryIsCodexOnly(entry)
    && typeof collector?.codex === "string"
    && TRUSTED_CORRECTION_COLLECTORS.has(collector.codex);
  const v2Entry: UsageEntryV2 = {
    date: outerDate,
    content_hash: "0".repeat(64),
    agents,
    ...(trustedCodexCorrection
      ? {
        authoritative_correction: true,
        migration_id: "legacy-codex-correction-v1",
      }
      : {}),
  };
  return { ...v2Entry, content_hash: hashCanonicalEntry(v2Entry) };
}

function jsonMetadata(value: unknown): { [key: string]: JsonValue } {
  if (!isRecord(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function adaptLegacyRequest(value: unknown): LegacyAdaptResult | { ok: false; error: string } {
  if (!isRecord(value)) return legacyError("Invalid request body");
  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    return legacyError("No entries provided");
  }
  if (value.entries.length > MAX_USAGE_ENTRIES) {
    return legacyError(`Too many entries provided. Maximum is ${MAX_USAGE_ENTRIES}.`);
  }
  if (value.source !== "cli" && value.source !== "web") return legacyError("Invalid source");
  if (typeof value.device_id !== "string") {
    return legacyError("device_id is required. Please update your CLI: npx straude@latest");
  }
  const collector = isRecord(value.collector)
    ? jsonMetadata(value.collector)
    : {};
  const rawCollector = value.collector as UsageCollectorMeta | undefined;
  const entries: UsageEntryV2[] = [];
  const seenDates = new Set<string>();
  for (const raw of value.entries) {
    if (!isRecord(raw) || typeof raw.date !== "string" || !isRecord(raw.data)) {
      return legacyError("Invalid usage entry");
    }
    if (seenDates.has(raw.date)) return legacyError(`Duplicate date: ${raw.date}`);
    seenDates.add(raw.date);
    const data = raw.data as unknown as CcusageDailyEntry;
    const converted = legacyEntryToV2(raw.date, data, rawCollector);
    if (isLegacyError(converted)) return converted;
    entries.push(converted);
  }
  const pricingMode = collector.pricing_mode === "offline" ? "offline" : "online";
  const requestId = createHash("sha256")
    .update([
      "straude-legacy-v1",
      value.source,
      value.device_id,
      ...entries
        .map((entry) => `${entry.date}:${entry.content_hash}`)
        .sort(),
    ].join("\0"))
    .digest("hex");
  return {
    request: {
      protocol_version: 2,
      request_id: typeof value.hash === "string" && value.hash.length > 0
        ? value.hash
        : requestId,
      source: value.source,
      timezone: "UTC",
      installation: {
        id: value.device_id,
        ...(typeof value.device_name === "string" ? { name: value.device_name } : {}),
      },
      collector: {
        name: "legacy-ccusage",
        version: typeof collector.ccusage_version === "string"
          ? collector.ccusage_version
          : "legacy",
        pricing_mode: pricingMode,
        metadata: collector,
      },
      entries,
    },
  };
}

function schedulePostCommitWork(
  userId: string,
  request: UsageSubmitRequestV2,
  outcomes: UsageOutcomeV2[],
): void {
  const successful = outcomes.filter(
    (outcome) => outcome.status === "committed" || outcome.status === "unchanged",
  );
  if (successful.length === 0) return;
  const totals = request.entries.reduce((sum, entry) => {
    const entryTotal = sumAgentUsage(entry.agents);
    return {
      cost: sum.cost + entryTotal.cost_usd,
      tokens: sum.tokens + entryTotal.total_tokens,
    };
  }, { cost: 0, tokens: 0 });

  after(async () => {
    await Promise.allSettled([
      checkAndAwardAchievements(userId, "usage"),
      Promise.resolve(
        getServiceClient().rpc("recalculate_user_level", { p_user_id: userId }),
      ),
      captureServerActivationEvent({
        event: "usage_submit_succeeded",
        distinctId: userId,
        properties: {
          surface: "usage_submit",
          activation_state: "first_usage_submitted",
          is_authenticated: true,
          protocol_version: 2,
          days_pushed: successful.length,
          result_count: successful.length,
          total_cost_usd: Math.round(totals.cost * 100) / 100,
          total_tokens: totals.tokens,
          has_errors: successful.length !== outcomes.length,
          "$insert_id": `usage_submit_succeeded:${userId}:${request.request_id}`,
        },
      }),
    ]);
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestStartedAt = performance.now();
  const rawCliVersion = request.headers.get("x-straude-cli-version");
  const cliVersion = rawCliVersion && /^[0-9A-Za-z.+_-]{1,64}$/.test(rawCliVersion)
    ? rawCliVersion
    : null;
  const rawRetryAttempt = request.headers.get("x-straude-retry-attempt");
  const retryAttempt = rawRetryAttempt && /^\d{1,2}$/.test(rawRetryAttempt)
    ? Math.min(Number(rawRetryAttempt), 99)
    : 0;
  const parsedBody = await readJsonBodyWithLimit(request, MAX_USAGE_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody.response;

  const auth = await resolveAuthContext(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const v2 = isV2Request(parsedBody.body);
  if (!v2 && auth.source === "cli" && isLegacyProtocolSunset()) {
    return NextResponse.json({
      error: "This Straude CLI version is no longer supported.",
      code: "usage_protocol_upgrade_required",
      update_command: "npx straude@latest",
    }, { status: 426 });
  }
  let usageRequest: UsageSubmitRequestV2;
  if (v2) {
    const parsed = parseUsageSubmitV2(parsedBody.body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    usageRequest = parsed.value;
  } else {
    const adapted = adaptLegacyRequest(parsedBody.body);
    if (isLegacyError(adapted)) {
      return NextResponse.json({ error: adapted.error }, { status: 400 });
    }
    usageRequest = adapted.request;
  }
  const outOfWindow = usageRequest.entries.find(
    (entry) => !isWithinBackfillWindow(entry.date, usageRequest.timezone),
  );
  if (outOfWindow) {
    const message = `Date ${outOfWindow.date} is outside the ${MAX_BACKFILL_DAYS}-day backfill window`;
    return v2
      ? NextResponse.json({
        request_id: usageRequest.request_id,
        outcomes: [{
          date: outOfWindow.date,
          status: "permanent_error",
          error: { code: "date_out_of_range", message },
        }],
      }, { status: 400 })
      : NextResponse.json({ error: message }, { status: 400 });
  }

  if (usageRequest.source !== auth.source) {
    const message = `Authenticated ${auth.source} requests cannot submit source ${usageRequest.source}`;
    return v2
      ? NextResponse.json({
        request_id: usageRequest.request_id,
        outcomes: usageRequest.entries.map((entry) => ({
          date: entry.date,
          status: "permanent_error",
          error: { code: "source_mismatch", message },
        })),
      }, { status: 403, headers: responseHeaders(auth) })
      : NextResponse.json({ error: message }, { status: 403, headers: responseHeaders(auth) });
  }
  const limited = await rateLimit("usage-submit", auth.userId, { limit: 20 });
  if (limited) return limited;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com").replace(/\/+$/, "");
  const db = getServiceClient();
  const outcomes = await mapWithConcurrency(
    usageRequest.entries,
    USAGE_PROCESS_CONCURRENCY,
    (entry) => submitEntry(
      db,
      auth,
      usageRequest,
      entry,
      appUrl,
      cliVersion,
      retryAttempt,
    ),
  );
  const status = statusForOutcomes(outcomes, v2);
  const headers = responseHeaders(auth);
  const outcomeCounts = outcomes.reduce<Record<string, number>>((counts, outcome) => {
    counts[outcome.status] = (counts[outcome.status] ?? 0) + 1;
    return counts;
  }, {});
  console.info(JSON.stringify({
    event: "usage_submit_request",
    protocol_version: v2 ? 2 : 1,
    request_id: usageRequest.request_id,
    cli_version: cliVersion,
    collector_name: usageRequest.collector.name,
    collector_version: usageRequest.collector.version,
    pricing_mode: usageRequest.collector.pricing_mode,
    date_count: usageRequest.entries.length,
    outcome_counts: outcomeCounts,
    retry_count: retryAttempt,
    unresolved_partial: status === 207,
    http_status: status,
    submit_duration_ms: Math.round(performance.now() - requestStartedAt),
  }));
  schedulePostCommitWork(auth.userId, usageRequest, outcomes);

  if (v2) {
    const response: UsageSubmitResponseV2 = {
      request_id: usageRequest.request_id,
      outcomes,
    };
    return NextResponse.json(response, { status, headers });
  }

  const results: UsageSubmitResponse["results"] = outcomes.flatMap((outcome) => {
    if (
      (outcome.status !== "committed" && outcome.status !== "unchanged")
      || !outcome.result
    ) {
      return [];
    }
    return [{
      date: outcome.date,
      usage_id: outcome.result.usage_id,
      post_id: outcome.result.post_id,
      post_url: outcome.result.post_url,
      action: outcome.result.action,
      previous_cost: outcome.result.previous_cost,
      daily_total: outcome.result.daily_total,
      device_count: outcome.result.device_count,
    }];
  });
  const errors = outcomes.flatMap((outcome) => outcome.error ? [outcome.error.message] : []);
  if (status !== 200) {
    return NextResponse.json({
      error: errors.join("; ") || "Usage submission failed",
      results,
      errors,
    }, { status, headers });
  }

  // Keep the legacy response contract until current clients adopt protocol v2.
  const response: UsageSubmitResponse = { results };
  return NextResponse.json(response, { headers });
}
