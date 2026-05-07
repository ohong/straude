import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, relative, sep } from "node:path";
import { createInterface } from "node:readline";
import type { CcusageDailyEntry, ModelBreakdownEntry, NormalizationAnomaly } from "./ccusage.js";
import {
  summarizeNormalization,
  type NormalizationMeta,
  type NormalizationSummary,
} from "./token-normalization.js";

export const CODEX_NATIVE_COLLECTOR = "straude-codex-native-v2" as const;

interface RawTokenUsage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}

interface SessionEvent {
  timestamp: string;
  date: string;
  model: string;
  raw: RawTokenUsage;
  signature: string;
}

interface CumulativeSnapshot {
  timestamp: string;
  usage: RawTokenUsage;
}

interface ParsedSession {
  id: string;
  parentId?: string;
  startedAt: string;
  events: SessionEvent[];
  signatures: Set<string>;
  // Current cumulative/context snapshot after parsing. Retained for stats and
  // as a final fallback only; forked child baselines must use cumulativeSnapshots
  // at the fork timestamp rather than this end-of-file value.
  lastCumulative: RawTokenUsage;
  cumulativeSnapshots: CumulativeSnapshot[];
  filePath: string;
}

interface AggregateBucket {
  raw: RawTokenUsage;
  model: string;
}

interface Pricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation?: number;
}

export interface CodexNativeOutput {
  data: CcusageDailyEntry[];
  anomalies?: NormalizationAnomaly[];
  normalizationSummary?: NormalizationSummary;
  entryMeta?: Array<{ date: string; meta: NormalizationMeta }>;
  fingerprint: string;
  scannedFiles: number;
  parsedEvents: number;
}

const ZERO_USAGE: RawTokenUsage = {
  input_tokens: 0,
  cached_input_tokens: 0,
  output_tokens: 0,
  reasoning_output_tokens: 0,
  total_tokens: 0,
};

const LEGACY_FALLBACK_MODEL = "gpt-5";

const CODEX_MODEL_ALIASES: Record<string, string> = {
  "gpt-5-codex": "gpt-5",
  "gpt-5.3-codex": "gpt-5.2-codex",
};

const CODEX_PRICING: Record<string, Pricing> = {
  "gpt-5": { input: 0.00000125, output: 0.00001, cacheRead: 0.000000125 },
  "gpt-5-2025-08-07": { input: 0.00000125, output: 0.00001, cacheRead: 0.000000125 },
  "gpt-5.1": { input: 0.00000125, output: 0.00001, cacheRead: 0.000000125 },
  "gpt-5.1-codex": { input: 0.00000125, output: 0.00001, cacheRead: 0.000000125 },
  "gpt-5.1-codex-max": { input: 0.00000125, output: 0.00001, cacheRead: 0.000000125 },
  "gpt-5.1-codex-mini": { input: 0.00000025, output: 0.000002, cacheRead: 0.000000025 },
  "gpt-5.2": { input: 0.00000175, output: 0.000014, cacheRead: 0.000000175 },
  "gpt-5.2-codex": { input: 0.00000175, output: 0.000014, cacheRead: 0.000000175 },
  "gpt-5.5": { input: 0.000005, output: 0.00003, cacheRead: 0.0000005 },
  "gpt-5.5-pro": { input: 0.00003, output: 0.00018, cacheRead: 0.00003 },
  "gpt-5.4": { input: 0.0000025, output: 0.000015, cacheRead: 0.00000025 },
  "gpt-5.4-2026-03-05": { input: 0.0000025, output: 0.000015, cacheRead: 0.00000025 },
  "gpt-5.4-mini": { input: 0.00000075, output: 0.0000045, cacheRead: 0.000000075 },
  "gpt-5.4-nano": { input: 0.0000002, output: 0.00000125, cacheRead: 0.00000002 },
  "gpt-5-mini": { input: 0.00000025, output: 0.000002, cacheRead: 0.000000025 },
  "gpt-5-mini-2025-08-07": { input: 0.00000025, output: 0.000002, cacheRead: 0.000000025 },
  "gpt-5-nano": { input: 0.00000005, output: 0.0000004, cacheRead: 0.000000005 },
  "gpt-5-nano-2025-08-07": { input: 0.00000005, output: 0.0000004, cacheRead: 0.000000005 },
};

function codexHome(): string {
  return process.env.CODEX_HOME ?? join(homedir(), ".codex");
}

function sessionsDir(): string {
  return join(codexHome(), "sessions");
}

function compactToIso(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(year!, month! - 1, day!);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromTimestamp(timestamp: string | undefined): string | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return null;
  return formatLocalDate(d);
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeRawUsage(value: unknown): RawTokenUsage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const usage = {
    input_tokens: toNumber(record.input_tokens),
    cached_input_tokens: toNumber(record.cached_input_tokens ?? record.cache_read_input_tokens),
    output_tokens: toNumber(record.output_tokens),
    reasoning_output_tokens: toNumber(record.reasoning_output_tokens),
    total_tokens: toNumber(record.total_tokens),
  };
  if (
    usage.input_tokens === 0
    && usage.cached_input_tokens === 0
    && usage.output_tokens === 0
    && usage.reasoning_output_tokens === 0
    && usage.total_tokens === 0
  ) {
    return null;
  }
  return usage;
}

function addRawUsage(a: RawTokenUsage | null, b: RawTokenUsage): RawTokenUsage {
  return {
    input_tokens: (a?.input_tokens ?? 0) + b.input_tokens,
    cached_input_tokens: (a?.cached_input_tokens ?? 0) + b.cached_input_tokens,
    output_tokens: (a?.output_tokens ?? 0) + b.output_tokens,
    reasoning_output_tokens: (a?.reasoning_output_tokens ?? 0) + b.reasoning_output_tokens,
    total_tokens: (a?.total_tokens ?? 0) + b.total_tokens,
  };
}

function subtractRawUsage(current: RawTokenUsage, previous: RawTokenUsage | null): RawTokenUsage {
  return {
    input_tokens: Math.max(current.input_tokens - (previous?.input_tokens ?? 0), 0),
    cached_input_tokens: Math.max(current.cached_input_tokens - (previous?.cached_input_tokens ?? 0), 0),
    output_tokens: Math.max(current.output_tokens - (previous?.output_tokens ?? 0), 0),
    reasoning_output_tokens: Math.max(current.reasoning_output_tokens - (previous?.reasoning_output_tokens ?? 0), 0),
    total_tokens: Math.max(current.total_tokens - (previous?.total_tokens ?? 0), 0),
  };
}

function isZeroUsage(usage: RawTokenUsage): boolean {
  return usage.input_tokens === 0
    && usage.cached_input_tokens === 0
    && usage.output_tokens === 0
    && usage.reasoning_output_tokens === 0
    && usage.total_tokens === 0;
}

function rawUsageEquals(a: RawTokenUsage, b: RawTokenUsage): boolean {
  return a.input_tokens === b.input_tokens
    && a.cached_input_tokens === b.cached_input_tokens
    && a.output_tokens === b.output_tokens
    && a.reasoning_output_tokens === b.reasoning_output_tokens
    && a.total_tokens === b.total_tokens;
}

function extractModel(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const direct = record.model;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const info = record.info;
  if (info && typeof info === "object") {
    const nested = (info as Record<string, unknown>).model;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return undefined;
}

function stableUsageSignature(model: string, usage: RawTokenUsage): string {
  return JSON.stringify([
    model,
    usage.input_tokens,
    usage.cached_input_tokens,
    usage.output_tokens,
    usage.reasoning_output_tokens,
    usage.total_tokens,
  ]);
}

function sessionIdFromPath(file: string): string {
  return basename(file).replace(/\.jsonl$/i, "");
}

function pathSessionDate(file: string): string | null {
  const parts = file.split(sep);
  for (let i = 0; i < parts.length - 3; i++) {
    if (parts[i] !== "sessions") continue;
    const year = parts[i + 1];
    const month = parts[i + 2];
    const day = parts[i + 3];
    if (/^\d{4}$/.test(year ?? "") && /^\d{2}$/.test(month ?? "") && /^\d{2}$/.test(day ?? "")) {
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

async function listSessionFiles(dir = sessionsDir(), root = sessionsDir()): Promise<string[]> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSessionFiles(fullPath, root));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }
  return files.sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
}

export async function containsSessionFile(dir = sessionsDir()): Promise<boolean> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".jsonl")) return true;
    if (entry.isDirectory() && await containsSessionFile(fullPath)) return true;
  }
  return false;
}

function shouldScanFile(file: string, sinceIso: string, untilIso: string): boolean {
  const pathDate = pathSessionDate(file);
  if (!pathDate) return true;
  return pathDate >= addDays(sinceIso, -1) && pathDate <= addDays(untilIso, 1);
}

async function parseSessionFile(
  file: string,
  sinceIso: string,
  untilIso: string,
  initialPreviousTotals: RawTokenUsage | null = null,
): Promise<ParsedSession> {
  let currentModel: string | undefined;
  let previousTotals: RawTokenUsage | null = initialPreviousTotals;
  let lastCumulative: RawTokenUsage = initialPreviousTotals ?? { ...ZERO_USAGE };
  // Cumulative-snapshot dedupe: Codex sometimes re-emits the same
  // token_count event twice in a row (identical total_token_usage). We dedupe
  // only when both the cumulative snapshot and per-request usage are repeated;
  // the same total with different last_token_usage is a distinct billed request.
  let prevTotalSnapshot: RawTokenUsage | null = null;
  let prevLastSnapshot: RawTokenUsage | null = null;
  const cumulativeSnapshots: CumulativeSnapshot[] = [];
  const events: SessionEvent[] = [];
  const signatures = new Set<string>();
  let id = sessionIdFromPath(file);
  let parentId: string | undefined;
  let startedAt = "";

  const rl = createInterface({
    input: createReadStream(file, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }

    const entryType = entry.type;
    const payload = entry.payload && typeof entry.payload === "object"
      ? entry.payload as Record<string, unknown>
      : undefined;
    const timestamp = typeof entry.timestamp === "string" ? entry.timestamp : undefined;

    if (entryType === "session_meta" && payload) {
      const payloadId = payload.id;
      const forkedFrom = payload.forked_from_id;
      const payloadTimestamp = payload.timestamp;
      if (typeof payloadId === "string" && payloadId) id = payloadId;
      if (typeof forkedFrom === "string" && forkedFrom) parentId = forkedFrom;
      if (typeof payloadTimestamp === "string" && payloadTimestamp) startedAt = payloadTimestamp;
      currentModel = extractModel(payload) ?? currentModel;
      continue;
    }

    if (entryType === "turn_context" && payload) {
      currentModel = extractModel(payload) ?? currentModel;
      continue;
    }

    if (entryType !== "event_msg" || !payload || payload.type !== "token_count") continue;
    const info = payload.info && typeof payload.info === "object"
      ? payload.info as Record<string, unknown>
      : undefined;
    if (!info) continue;

    currentModel = extractModel({ ...payload, info }) ?? currentModel;
    const totalUsage = normalizeRawUsage(info.total_token_usage);
    const lastUsage = normalizeRawUsage(info.last_token_usage);

    // Skip consecutive duplicate emissions of the same cumulative snapshot only
    // when the single-request usage is also repeated. A stable context total can
    // still produce a fresh billed request with a different last_token_usage.
    if (totalUsage && prevTotalSnapshot && rawUsageEquals(totalUsage, prevTotalSnapshot)) {
      const lastUsageIsDuplicate = !lastUsage
        || (prevLastSnapshot != null && rawUsageEquals(lastUsage, prevLastSnapshot));
      if (lastUsageIsDuplicate) continue;
    }

    // Codex's `total_token_usage` is the *current request's context snapshot*
    // — the prompt size + cache hits + output for the request that just
    // completed. It is NOT a monotonic session cumulative: the IDE
    // periodically prunes the conversation context, which causes the snapshot
    // to drop and then grow again. The legacy logic computed deltas via
    // `total_now - total_prev`, which double-counts every prune-then-regrow
    // cycle (verified to inflate by 70x+ on real heavy-usage days). The
    // correct per-event billing data is `last_token_usage` — the token cost
    // of the single request that produced this event. We sum those directly.
    //
    // Fallback: when only `total_token_usage` is present (older event
    // shapes / partial events), fall back to cumulative-delta semantics.
    // The forked-session baseline subtraction (handled in the caller via
    // `initialPreviousTotals`) keeps that fallback honest.
    let raw: RawTokenUsage | null = null;
    if (lastUsage) {
      raw = lastUsage;
      if (totalUsage) {
        previousTotals = totalUsage;
        lastCumulative = totalUsage;
      } else {
        previousTotals = addRawUsage(previousTotals, lastUsage);
        lastCumulative = previousTotals;
      }
    } else if (totalUsage) {
      raw = subtractRawUsage(totalUsage, previousTotals);
      previousTotals = totalUsage;
      lastCumulative = totalUsage;
    }

    if (totalUsage) prevTotalSnapshot = totalUsage;
    prevLastSnapshot = lastUsage;
    if (timestamp) cumulativeSnapshots.push({ timestamp, usage: { ...lastCumulative } });

    if (!raw || isZeroUsage(raw)) continue;

    const date = dateFromTimestamp(timestamp);
    if (!date) continue;

    const model = currentModel ?? LEGACY_FALLBACK_MODEL;
    const signature = stableUsageSignature(model, raw);
    signatures.add(signature);

    if (date < sinceIso || date > untilIso) continue;
    events.push({ timestamp: timestamp ?? "", date, model, raw, signature });
  }

  return {
    id,
    parentId,
    startedAt,
    events,
    signatures,
    lastCumulative,
    cumulativeSnapshots,
    filePath: file,
  };
}

async function addMissingAncestors(
  sessions: ParsedSession[],
  allFiles: string[],
  sinceIso: string,
  untilIso: string,
): Promise<void> {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const queued = [...sessions];

  while (queued.length > 0) {
    const session = queued.pop()!;
    const parentId = session.parentId;
    if (!parentId || byId.has(parentId)) continue;

    const parentFile = allFiles.find((file) => basename(file).includes(parentId));
    if (!parentFile) continue;

    const parent = await parseSessionFile(parentFile, sinceIso, untilIso);
    if (byId.has(parent.id)) continue;
    byId.set(parent.id, parent);
    sessions.push(parent);
    queued.push(parent);
  }
}

function collectAncestorSignatures(session: ParsedSession, byId: Map<string, ParsedSession>, seen = new Set<string>()): Set<string> {
  const signatures = new Set<string>();
  let parentId = session.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    for (const signature of parent.signatures) signatures.add(signature);
    parentId = parent.parentId;
  }
  return signatures;
}

function resolvePricing(model: string): Pricing | undefined {
  const normalized = model.trim().toLowerCase();
  const aliased = CODEX_MODEL_ALIASES[normalized] ?? normalized;
  if (CODEX_PRICING[aliased]) return CODEX_PRICING[aliased];
  if (aliased.startsWith("gpt-5.5-pro")) return CODEX_PRICING["gpt-5.5-pro"];
  if (aliased.startsWith("gpt-5.5")) return CODEX_PRICING["gpt-5.5"];
  if (aliased.startsWith("gpt-5.4-mini")) return CODEX_PRICING["gpt-5.4-mini"];
  if (aliased.startsWith("gpt-5.4-nano")) return CODEX_PRICING["gpt-5.4-nano"];
  if (aliased.startsWith("gpt-5.4")) return CODEX_PRICING["gpt-5.4"];
  if (aliased.startsWith("gpt-5.2-codex")) return CODEX_PRICING["gpt-5.2-codex"];
  if (aliased.startsWith("gpt-5.1-codex-mini")) return CODEX_PRICING["gpt-5.1-codex-mini"];
  if (aliased.startsWith("gpt-5.1-codex")) return CODEX_PRICING["gpt-5.1-codex"];
  if (aliased.startsWith("gpt-5-mini")) return CODEX_PRICING["gpt-5-mini"];
  if (aliased.startsWith("gpt-5-nano")) return CODEX_PRICING["gpt-5-nano"];
  if (aliased.startsWith("gpt-5")) return CODEX_PRICING["gpt-5"];
  return undefined;
}

function cumulativeSnapshotAtOrBefore(session: ParsedSession, timestamp: string): RawTokenUsage | null {
  const targetMs = Date.parse(timestamp);
  if (!Number.isFinite(targetMs)) return null;

  let best: CumulativeSnapshot | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const snapshot of session.cumulativeSnapshots) {
    const snapshotMs = Date.parse(snapshot.timestamp);
    if (!Number.isFinite(snapshotMs) || snapshotMs > targetMs || snapshotMs < bestMs) continue;
    best = snapshot;
    bestMs = snapshotMs;
  }

  return best ? { ...best.usage } : null;
}

function forkBaselineTimestamp(session: ParsedSession): string {
  return session.startedAt || session.events[0]?.timestamp || "";
}

function calculateCost(entry: CcusageDailyEntry, model: string): number {
  const pricing = resolvePricing(model);
  if (!pricing) return 0;
  return (
    entry.inputTokens * pricing.input
    + entry.outputTokens * pricing.output
    + entry.cacheReadTokens * pricing.cacheRead
    + entry.cacheCreationTokens * (pricing.cacheCreation ?? pricing.input)
  );
}

/**
 * Codex's documented schema (OpenAI Responses API):
 *   total_token_usage.input_tokens         = total input (uncached + cached)
 *   total_token_usage.cached_input_tokens  = subset of input that was a cache hit
 *   total_token_usage.output_tokens        = output (includes any reasoning tokens)
 *   total_token_usage.total_tokens         = input_tokens + output_tokens
 *
 * The previous implementation passed these into the shared dual-candidate
 * normalizer, which under bucket-level arithmetic drift could choose the
 * "separate cache" candidate and let cache_read exceed input — producing
 * wildly inflated costs (cache priced like uncached input). For the codex
 * path the invariant cache ⊆ input is non-negotiable, so we apply it
 * directly and emit a NormalizationAnomaly when bad upstream data tries to
 * violate it.
 */
function normalizeBucket(date: string, model: string, raw: RawTokenUsage): { entry: CcusageDailyEntry; meta: NormalizationMeta } {
  const rawInput = Math.max(raw.input_tokens, 0);
  const rawCached = Math.max(raw.cached_input_tokens, 0);
  const rawOutput = Math.max(raw.output_tokens, 0);
  const rawReasoning = Math.max(raw.reasoning_output_tokens, 0);

  const cacheClamped = rawCached > rawInput;
  const cacheReadTokens = Math.min(rawCached, rawInput);
  const inputTokens = rawInput - cacheReadTokens;
  const outputTokens = rawOutput;
  const totalTokens = inputTokens + cacheReadTokens + outputTokens;

  const warnings: string[] = [];
  if (cacheClamped) {
    warnings.push(
      `Codex source reported cached_input_tokens (${rawCached}) > input_tokens (${rawInput}); clamped to inclusive subset.`,
    );
  }

  const meta: NormalizationMeta = {
    mode: "inclusive_cache_input",
    confidence: cacheClamped ? "low" : "high",
    warnings,
    consistencyError: 0,
  };

  const entry: CcusageDailyEntry = {
    date,
    models: [model],
    inputTokens,
    outputTokens,
    cacheCreationTokens: 0,
    cacheReadTokens,
    totalTokens,
    costUSD: 0,
    reasoningOutputTokens: Math.min(rawReasoning, outputTokens),
  };
  entry.costUSD = calculateCost(entry, model);

  return { entry, meta };
}

function aggregateSessions(sessions: ParsedSession[]): { data: CcusageDailyEntry[]; metas: Array<{ date: string; meta: NormalizationMeta }>; parsedEvents: number } {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const buckets = new Map<string, AggregateBucket>();
  let parsedEvents = 0;

  for (const session of [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const ancestorSignatures = collectAncestorSignatures(session, byId);
    for (const event of session.events) {
      if (ancestorSignatures.has(event.signature)) continue;
      const key = `${event.date}\u0000${event.model}`;
      const bucket = buckets.get(key) ?? { raw: { ...ZERO_USAGE }, model: event.model };
      bucket.raw = addRawUsage(bucket.raw, event.raw);
      buckets.set(key, bucket);
      parsedEvents += 1;
    }
  }

  const byDate = new Map<string, {
    entry: CcusageDailyEntry;
    breakdown: ModelBreakdownEntry[];
    metas: NormalizationMeta[];
  }>();

  for (const [key, bucket] of buckets) {
    const [date, model] = key.split("\u0000") as [string, string];
    const normalized = normalizeBucket(date, model, bucket.raw);
    const existing = byDate.get(date) ?? {
      entry: {
        date,
        models: [],
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        costUSD: 0,
      },
      breakdown: [],
      metas: [],
    };

    existing.entry.models.push(model);
    existing.entry.inputTokens += normalized.entry.inputTokens;
    existing.entry.outputTokens += normalized.entry.outputTokens;
    existing.entry.cacheCreationTokens += normalized.entry.cacheCreationTokens;
    existing.entry.cacheReadTokens += normalized.entry.cacheReadTokens;
    existing.entry.totalTokens += normalized.entry.totalTokens;
    existing.entry.costUSD += normalized.entry.costUSD;
    existing.breakdown.push({ model, cost_usd: normalized.entry.costUSD });
    existing.metas.push(normalized.meta);
    byDate.set(date, existing);
  }

  const data = [...byDate.values()]
    .map(({ entry, breakdown }) => ({
      ...entry,
      models: [...new Set(entry.models)].sort(),
      modelBreakdown: breakdown.length > 0 ? breakdown : undefined,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const metas = [...byDate.entries()].flatMap(([date, value]) =>
    value.metas.map((meta) => ({ date, meta })),
  );

  return { data, metas, parsedEvents };
}

export async function collectCodexUsageAsync(sinceDate: string, untilDate: string): Promise<CodexNativeOutput> {
  const sinceIso = compactToIso(sinceDate);
  const untilIso = compactToIso(untilDate);
  const allFiles = await listSessionFiles();
  const files = allFiles.filter((file) => shouldScanFile(file, sinceIso, untilIso));
  const sessions: ParsedSession[] = [];

  for (const file of files) {
    sessions.push(await parseSessionFile(file, sinceIso, untilIso));
  }
  await addMissingAncestors(sessions, allFiles, sinceIso, untilIso);

  // Second pass: re-parse forked sessions with their parent's cumulative
  // snapshot at the fork time as the baseline. Without this, a child's first
  // total-only event delta is the entire parent-inclusive context. Using the
  // parent's end-of-file snapshot is also wrong when the parent continues after
  // the fork, because that subtracts post-fork parent traffic from the child.
  //
  // Topological order: parents always have an earlier startedAt than their
  // children (Codex assigns startedAt at fork time), so iterating sorted
  // ensures a parent has already been re-parsed before its children. We swap
  // the re-parsed session into the array in-place so descendants pick up the
  // updated lastCumulative.
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const sortedByStart = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const session of sortedByStart) {
    const parentId = session.parentId;
    if (!parentId) continue;
    const parent = byId.get(parentId);
    if (!parent) continue;
    const parentBaseline = cumulativeSnapshotAtOrBefore(parent, forkBaselineTimestamp(session));
    if (!parentBaseline || isZeroUsage(parentBaseline)) continue;
    const reParsed = await parseSessionFile(session.filePath, sinceIso, untilIso, parentBaseline);
    byId.set(reParsed.id, reParsed);
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) sessions[idx] = reParsed;
  }

  const { data, metas, parsedEvents } = aggregateSessions(sessions);
  const anomalies: NormalizationAnomaly[] = metas
    .filter((row) => row.meta.mode === "unresolved" || row.meta.confidence !== "high" || row.meta.warnings.length > 0)
    .map((row) => ({
      date: row.date,
      source: "codex",
      mode: row.meta.mode,
      confidence: row.meta.confidence,
      consistencyError: row.meta.consistencyError,
      warnings: row.meta.warnings,
    }));

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ collector: CODEX_NATIVE_COLLECTOR, sinceDate, untilDate, data }))
    .digest("hex");

  return {
    data,
    anomalies,
    normalizationSummary: summarizeNormalization(metas.map((row) => row.meta)),
    entryMeta: metas,
    fingerprint,
    scannedFiles: files.length,
    parsedEvents,
  };
}

export async function getCodexSessionStats(): Promise<{ count: number; latestMtimeMs: number }> {
  const files = await listSessionFiles();
  let latestMtimeMs = 0;
  for (const file of files) {
    try {
      const s = await stat(file);
      latestMtimeMs = Math.max(latestMtimeMs, s.mtimeMs);
    } catch {
      // Ignore files removed during scanning.
    }
  }
  return { count: files.length, latestMtimeMs };
}
