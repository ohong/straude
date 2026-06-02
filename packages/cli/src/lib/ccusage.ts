import { execFile as execFileCb, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  normalizeTokenBuckets,
  summarizeNormalization,
  type NormalizationMeta,
  type NormalizationSummary,
  type TokenNormalizationConfidence,
  type TokenNormalizationMode,
} from "./token-normalization.js";
import { DEFAULT_SUBPROCESS_TIMEOUT_MS } from "../config.js";
import type { StraudeConfig } from "./auth.js";

export const CCUSAGE_MIN_VERSION = "20.0.5";
export const CCUSAGE_CLAUDE_COLLECTOR = "ccusage-claude-v20" as const;
export const CCUSAGE_CODEX_COLLECTOR = "ccusage-codex-v20" as const;

const require = createRequire(import.meta.url);
const SUPPORTED_AGENTS = ["claude", "codex"] as const;

export type CcusageAgent = (typeof SUPPORTED_AGENTS)[number];

/** Type-safe representation of the error thrown by execFileSync / execFile. */
interface ExecError extends Error {
  code?: string;
  status?: number | null;
  stderr?: string | Buffer;
  stdout?: string | Buffer;
  signal?: string | null;
  killed?: boolean;
}

/** Resolved bundled ccusage command. Cached after first resolution. */
let _resolved: { cmd: string; args: string[]; version: string } | undefined;

function resolveCcusageBin(): string {
  try {
    return require.resolve("ccusage/dist/cli.js");
  } catch (err) {
    throw new Error(
      "Bundled ccusage dependency is missing. Reinstall Straude or run `bun install` and retry.",
      { cause: err },
    );
  }
}

function parseVersion(raw: string): string | null {
  return raw.match(/\b(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?\b/)?.[0] ?? null;
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(/[.-]/).slice(0, 3).map((part) => Number(part));
  const bParts = b.split(/[.-]/).slice(0, 3).map((part) => Number(part));
  for (let i = 0; i < 3; i += 1) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function validateCcusageVersion(version: string): void {
  if (compareVersions(version, CCUSAGE_MIN_VERSION) < 0) {
    throw new Error(
      `ccusage ${CCUSAGE_MIN_VERSION} or newer is required; found ${version}.`,
    );
  }
}

function readRuntimeVersion(cmd: string, args: string[]): string {
  let raw: string;
  try {
    raw = execFileSync(cmd, [...args, "--version"], {
      encoding: "utf-8",
      timeout: DEFAULT_SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      shell: process.platform === "win32",
    });
  } catch (err) {
    const error = err as ExecError;
    const detail = bufferToString(error.stderr).trim() || error.message || "unknown error";
    throw new Error(`Failed to validate bundled ccusage version: ${detail}`);
  }

  const version = parseVersion(raw);
  if (!version) {
    throw new Error(`Failed to parse bundled ccusage version from: ${raw.trim() || "<empty>"}`);
  }
  validateCcusageVersion(version);
  return version;
}

/**
 * Resolve how to run the bundled ccusage dependency. We intentionally do not
 * look on PATH: Straude ships an exact ccusage dependency and executes that
 * package's declared bin through the current Node runtime.
 */
function resolveCcusageCommand(): { cmd: string; args: string[]; version: string } {
  if (_resolved) return _resolved;

  const binPath = resolveCcusageBin();
  const cmd = process.execPath;
  const args = [binPath];
  const version = readRuntimeVersion(cmd, args);

  _resolved = { cmd, args, version };
  return _resolved;
}

/** Reset resolver cache - for testing only. */
export function _resetCcusageResolver(): void {
  _resolved = undefined;
}

/** Whether the bundled ccusage dependency is currently resolvable and new enough. */
export function isCcusageInstalled(): boolean {
  try {
    resolveCcusageCommand();
    return true;
  } catch {
    return false;
  }
}

/**
 * Kept for the push command's existing call site. With bundled ccusage there is
 * nothing to install at runtime; this validates that the packaged binary exists
 * and satisfies the minimum supported version.
 */
export async function ensureCcusageInstalled(
  _config: StraudeConfig | null = null,
): Promise<void> {
  resolveCcusageCommand();
}

function bufferToString(value: string | Buffer | undefined): string {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf-8");
  return "";
}

function hasMissingPricingError(stderr: string): boolean {
  return /(?:missing|unavailable|not found).{0,80}pric|pric.{0,80}(?:missing|unavailable|not found)|no-offline/i.test(stderr);
}

function commandHint(args: string[]): string {
  return `ccusage ${args.join(" ")}`;
}

function ccusageArgs(agent: CcusageAgent, sinceDate: string, untilDate: string): string[] {
  return [
    agent,
    "daily",
    "--json",
    "--since",
    sinceDate,
    "--until",
    untilDate,
    "--no-offline",
  ];
}

/** Run ccusage via the resolved bundled binary. */
function execCcusage(args: string[], timeoutMs?: number): string {
  const { cmd, args: prefix } = resolveCcusageCommand();
  const cmdArgs = [...prefix, ...args];

  try {
    return execFileSync(cmd, cmdArgs, {
      encoding: "utf-8",
      timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32",
    });
  } catch (err: unknown) {
    const error = err as ExecError;

    if (error.killed || error.signal === "SIGTERM") {
      throw new Error(
        `ccusage timed out. Try running \`${commandHint(args)}\` directly to verify it works.`,
      );
    }

    const detail = bufferToString(error.stderr).trim() || error.message || "unknown error";
    if (hasMissingPricingError(detail)) {
      throw new Error(`ccusage failed because pricing data is unavailable with --no-offline: ${detail}`);
    }
    throw new Error(`ccusage failed: ${detail}`);
  }
}

/** Async version of execCcusage - runs ccusage in a child process without blocking. */
function execCcusageAsync(args: string[], timeoutMs?: number): Promise<string> {
  const { cmd, args: prefix } = resolveCcusageCommand();
  const cmdArgs = [...prefix, ...args];

  return new Promise((resolvePromise, reject) => {
    execFileCb(cmd, cmdArgs, {
      encoding: "utf-8",
      timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32",
    }, (err, stdout, stderr) => {
      const stderrText = typeof stderr === "string" ? stderr : bufferToString(stderr);
      if (!err) {
        if (hasMissingPricingError(stderrText)) {
          reject(new Error(`ccusage failed because pricing data is unavailable with --no-offline: ${stderrText.trim()}`));
          return;
        }
        resolvePromise(stdout);
        return;
      }

      const error = err as ExecError;
      if (error.killed || error.signal === "SIGTERM") {
        reject(new Error(
          `ccusage timed out. Try running \`${commandHint(args)}\` directly to verify it works.`,
        ));
        return;
      }

      const detail = stderrText.trim() || bufferToString(error.stderr).trim() || error.message || "unknown error";
      if (hasMissingPricingError(detail)) {
        reject(new Error(`ccusage failed because pricing data is unavailable with --no-offline: ${detail}`));
        return;
      }
      reject(new Error(`ccusage failed: ${detail}`));
    });
  });
}

/** Per-model cost entry for breakdown tracking. */
export interface ModelBreakdownEntry {
  model: string;
  cost_usd: number;
}

/** Normalized entry used throughout the CLI and sent to the API. */
export interface CcusageDailyEntry {
  date: string;
  models: string[];
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUSD: number;
  reasoningOutputTokens?: number;
  modelBreakdown?: ModelBreakdownEntry[];
}

export interface CcusageRowMetadata {
  date: string;
  agents: CcusageAgent[];
}

/** Raw shape returned by `ccusage claude daily --json`. */
interface CcusageClaudeEntry {
  date?: unknown;
  modelsUsed?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  cacheCreationTokens?: unknown;
  cacheReadTokens?: unknown;
  totalTokens?: unknown;
  totalCost?: unknown;
  reasoningOutputTokens?: unknown;
  modelBreakdowns?: unknown;
}

/** Raw shape returned by `ccusage codex daily --json`. */
interface CcusageCodexEntry {
  date?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  cachedInputTokens?: unknown;
  cacheCreationTokens?: unknown;
  totalTokens?: unknown;
  costUSD?: unknown;
  reasoningOutputTokens?: unknown;
  models?: unknown;
}

/** Raw shape returned by unified `ccusage daily --json`; kept for compatibility. */
interface CcusageUnifiedEntry {
  period?: unknown;
  modelsUsed?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  cacheCreationTokens?: unknown;
  cacheReadTokens?: unknown;
  totalTokens?: unknown;
  totalCost?: unknown;
  reasoningOutputTokens?: unknown;
  modelBreakdowns?: unknown;
  metadata?: unknown;
}

interface CcusageV20Output {
  daily?: unknown;
}

export interface CcusageOutput {
  data: CcusageDailyEntry[];
  rowMetadata?: CcusageRowMetadata[];
  anomalies?: NormalizationAnomaly[];
  normalizationSummary?: NormalizationSummary;
}

export interface NormalizationAnomaly {
  date: string;
  source: "ccusage" | "codex";
  mode: TokenNormalizationMode;
  confidence: TokenNormalizationConfidence;
  consistencyError: number;
  warnings: string[];
}

/**
 * Runs source-focused ccusage for the given date range and returns parsed output.
 * Dates should be in YYYYMMDD format (no dashes) as ccusage expects.
 */
export function runCcusage(agent: CcusageAgent, sinceDate: string, untilDate: string, timeoutMs?: number): CcusageOutput {
  const args = ccusageArgs(agent, sinceDate, untilDate);
  return parseCcusageOutput(execCcusage(args, timeoutMs), agent);
}

/** Returns the raw JSON string from ccusage (for hashing). */
export function runCcusageRaw(agent: CcusageAgent, sinceDate: string, untilDate: string, timeoutMs?: number): string {
  const args = ccusageArgs(agent, sinceDate, untilDate);
  return execCcusage(args, timeoutMs);
}

/** Async version - returns raw JSON string without blocking the event loop. */
export function runCcusageRawAsync(agent: CcusageAgent, sinceDate: string, untilDate: string, timeoutMs?: number): Promise<string> {
  const args = ccusageArgs(agent, sinceDate, untilDate);
  return execCcusageAsync(args, timeoutMs);
}

export const runCcusageAgentRawAsync = runCcusageRawAsync;

function finiteNumber(value: unknown, field: string, date: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ccusage row for ${date}: ${field} must be a finite number`);
  }
  if (value < 0) {
    throw new Error(`Invalid ccusage row for ${date}: ${field} must be non-negative`);
  }
  return value;
}

function optionalFiniteNumber(value: unknown, field: string, date: string): number | undefined {
  if (value == null) return undefined;
  return finiteNumber(value, field, date);
}

function parseAgents(metadata: unknown, date: string): CcusageAgent[] {
  const agents = (metadata as { agents?: unknown } | null | undefined)?.agents;
  if (!Array.isArray(agents) || agents.length === 0) {
    throw new Error(`Invalid ccusage row for ${date}: metadata.agents must be a non-empty array`);
  }

  const unique = new Set<CcusageAgent>();
  for (const agent of agents) {
    if (!SUPPORTED_AGENTS.includes(agent as CcusageAgent)) {
      throw new Error(`Unsupported ccusage agent for ${date}: ${String(agent)}`);
    }
    unique.add(agent as CcusageAgent);
  }

  return [...unique];
}

function parseModelBreakdowns(value: unknown, date: string): ModelBreakdownEntry[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ccusage row for ${date}: modelBreakdowns must be an array`);
  }

  return value.map((rawBreakdown, index) => {
    const breakdown = rawBreakdown as { modelName?: unknown; cost?: unknown };
    if (typeof breakdown.modelName !== "string" || breakdown.modelName.length === 0) {
      throw new Error(`Invalid ccusage row for ${date}: modelBreakdowns[${index}].modelName is required`);
    }
    return {
      model: breakdown.modelName,
      cost_usd: finiteNumber(breakdown.cost, `modelBreakdowns[${index}].cost`, date),
    };
  });
}

function parseModels(raw: CcusageClaudeEntry | CcusageUnifiedEntry, breakdowns: ModelBreakdownEntry[] | undefined, date: string): string[] {
  if (Array.isArray(raw.modelsUsed)) {
    const models = raw.modelsUsed.filter((model): model is string => typeof model === "string" && model.length > 0);
    if (models.length !== raw.modelsUsed.length) {
      throw new Error(`Invalid ccusage row for ${date}: modelsUsed must contain only strings`);
    }
    return models;
  }

  if (breakdowns && breakdowns.length > 0) {
    return [...new Set(breakdowns.map((breakdown) => breakdown.model))];
  }

  return [];
}

/** Normalize a unified v20 entry into our canonical format. */
function normalizeUnifiedEntry(raw: CcusageUnifiedEntry): { entry: CcusageDailyEntry; rowMetadata: CcusageRowMetadata; meta: NormalizationMeta } {
  if (typeof raw.period !== "string" || raw.period.length === 0) {
    throw new Error("Invalid ccusage row: period is required");
  }

  const date = raw.period;
  const agents = parseAgents(raw.metadata, date);
  const totalTokens = finiteNumber(raw.totalTokens, "totalTokens", date);
  const inputTokens = finiteNumber(raw.inputTokens, "inputTokens", date);
  const outputTokens = finiteNumber(raw.outputTokens, "outputTokens", date);
  const cacheCreationTokens = finiteNumber(raw.cacheCreationTokens, "cacheCreationTokens", date);
  const cacheReadTokens = finiteNumber(raw.cacheReadTokens, "cacheReadTokens", date);
  const residualReasoningTokens = Math.max(
    0,
    totalTokens - inputTokens - outputTokens - cacheCreationTokens - cacheReadTokens,
  );
  const reasoningOutputTokens = optionalFiniteNumber(raw.reasoningOutputTokens, "reasoningOutputTokens", date)
    ?? residualReasoningTokens;
  const modelBreakdown = parseModelBreakdowns(raw.modelBreakdowns, date);

  const normalized = normalizeTokenBuckets(
    {
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      reasoningOutputTokens,
    },
    { source: "ccusage", cacheSemantics: "separate" },
  );

  if (normalized.meta.mode === "unresolved") {
    throw new Error(`Invalid ccusage row for ${date}: token totals are inconsistent`);
  }

  return {
    entry: {
      date,
      models: parseModels(raw, modelBreakdown, date),
      inputTokens: normalized.normalized.inputTokens,
      outputTokens: normalized.normalized.outputTokens,
      cacheCreationTokens: normalized.normalized.cacheCreationTokens,
      cacheReadTokens: normalized.normalized.cacheReadTokens,
      totalTokens: normalized.normalized.totalTokens,
      costUSD: finiteNumber(raw.totalCost, "totalCost", date),
      reasoningOutputTokens: normalized.normalized.reasoningOutputTokens,
      modelBreakdown,
    },
    rowMetadata: { date, agents },
    meta: normalized.meta,
  };
}

function normalizeClaudeEntry(raw: CcusageClaudeEntry): { entry: CcusageDailyEntry; rowMetadata: CcusageRowMetadata; meta: NormalizationMeta } {
  if (typeof raw.date !== "string" || raw.date.length === 0) {
    throw new Error("Invalid ccusage claude row: date is required");
  }

  const date = raw.date;
  const totalTokens = finiteNumber(raw.totalTokens, "totalTokens", date);
  const inputTokens = finiteNumber(raw.inputTokens, "inputTokens", date);
  const outputTokens = finiteNumber(raw.outputTokens, "outputTokens", date);
  const cacheCreationTokens = finiteNumber(raw.cacheCreationTokens, "cacheCreationTokens", date);
  const cacheReadTokens = finiteNumber(raw.cacheReadTokens, "cacheReadTokens", date);
  const residualReasoningTokens = Math.max(
    0,
    totalTokens - inputTokens - outputTokens - cacheCreationTokens - cacheReadTokens,
  );
  const reasoningOutputTokens = optionalFiniteNumber(raw.reasoningOutputTokens, "reasoningOutputTokens", date)
    ?? residualReasoningTokens;
  const modelBreakdown = parseModelBreakdowns(raw.modelBreakdowns, date);

  const normalized = normalizeTokenBuckets(
    {
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      reasoningOutputTokens,
    },
    { source: "ccusage", cacheSemantics: "separate" },
  );

  if (normalized.meta.mode === "unresolved") {
    throw new Error(`Invalid ccusage claude row for ${date}: token totals are inconsistent`);
  }

  return {
    entry: {
      date,
      models: parseModels(raw, modelBreakdown, date),
      inputTokens: normalized.normalized.inputTokens,
      outputTokens: normalized.normalized.outputTokens,
      cacheCreationTokens: normalized.normalized.cacheCreationTokens,
      cacheReadTokens: normalized.normalized.cacheReadTokens,
      totalTokens: normalized.normalized.totalTokens,
      costUSD: finiteNumber(raw.totalCost, "totalCost", date),
      reasoningOutputTokens: normalized.normalized.reasoningOutputTokens,
      modelBreakdown,
    },
    rowMetadata: { date, agents: ["claude"] },
    meta: normalized.meta,
  };
}

function parseCodexModels(value: unknown, date: string, costUSD: number): { models: string[]; breakdown?: ModelBreakdownEntry[] } {
  if (value == null) return { models: [] };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ccusage codex row for ${date}: models must be an object`);
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([model]) => model.length > 0);
  const models = entries.map(([model]) => model);
  const tokenWeights = entries.map(([model, rawModel]) => {
    if (typeof rawModel !== "object" || rawModel == null || Array.isArray(rawModel)) {
      throw new Error(`Invalid ccusage codex row for ${date}: models.${model} must be an object`);
    }
    const totalTokens = (rawModel as { totalTokens?: unknown }).totalTokens;
    return typeof totalTokens === "number" && Number.isFinite(totalTokens) && totalTokens > 0
      ? totalTokens
      : 0;
  });

  const totalModelTokens = tokenWeights.reduce((sum, count) => sum + count, 0);
  const breakdown = costUSD > 0 && totalModelTokens > 0
    ? models.map((model, index) => ({
      model,
      cost_usd: costUSD * (tokenWeights[index]! / totalModelTokens),
    }))
    : undefined;

  return { models, breakdown };
}

function normalizeCodexEntry(raw: CcusageCodexEntry): { entry: CcusageDailyEntry; rowMetadata: CcusageRowMetadata; meta: NormalizationMeta } {
  if (typeof raw.date !== "string" || raw.date.length === 0) {
    throw new Error("Invalid ccusage codex row: date is required");
  }

  const date = raw.date;
  const totalTokens = finiteNumber(raw.totalTokens, "totalTokens", date);
  const inputTokens = finiteNumber(raw.inputTokens, "inputTokens", date);
  const outputTokens = finiteNumber(raw.outputTokens, "outputTokens", date);
  const cacheReadTokens = finiteNumber(raw.cachedInputTokens, "cachedInputTokens", date);
  const cacheCreationTokens = optionalFiniteNumber(raw.cacheCreationTokens, "cacheCreationTokens", date) ?? 0;
  const costUSD = finiteNumber(raw.costUSD, "costUSD", date);
  const reasoningOutputTokens = optionalFiniteNumber(raw.reasoningOutputTokens, "reasoningOutputTokens", date) ?? 0;
  const modelInfo = parseCodexModels(raw.models, date, costUSD);

  const normalized = normalizeTokenBuckets(
    {
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      reasoningOutputTokens,
    },
    { source: "ccusage", cacheSemantics: "separate" },
  );

  if (normalized.meta.mode === "unresolved") {
    throw new Error(`Invalid ccusage codex row for ${date}: token totals are inconsistent`);
  }

  return {
    entry: {
      date,
      models: modelInfo.models,
      inputTokens: normalized.normalized.inputTokens,
      outputTokens: normalized.normalized.outputTokens,
      cacheCreationTokens: normalized.normalized.cacheCreationTokens,
      cacheReadTokens: normalized.normalized.cacheReadTokens,
      totalTokens: normalized.normalized.totalTokens,
      costUSD,
      reasoningOutputTokens: normalized.normalized.reasoningOutputTokens,
      modelBreakdown: modelInfo.breakdown,
    },
    rowMetadata: { date, agents: ["codex"] },
    meta: normalized.meta,
  };
}

function sourceForAgents(agents: CcusageAgent[]): "ccusage" | "codex" {
  return agents.includes("codex") && !agents.includes("claude") ? "codex" : "ccusage";
}

export function parseCcusageOutput(raw: string, agent?: CcusageAgent): CcusageOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error("Failed to parse ccusage output as JSON", { cause: err });
  }

  // ccusage returns `[]` when there's no data for the period.
  if (Array.isArray(parsed) && parsed.length === 0) {
    return { data: [], rowMetadata: [] };
  }

  const v20 = parsed as CcusageV20Output;
  if (!Array.isArray(v20.daily)) {
    throw new Error("Unexpected ccusage output format (expected 'daily' array)");
  }

  const normalizedRows = v20.daily.map((row) => {
    if (agent === "claude") return normalizeClaudeEntry(row as CcusageClaudeEntry);
    if (agent === "codex") return normalizeCodexEntry(row as CcusageCodexEntry);
    return normalizeUnifiedEntry(row as CcusageUnifiedEntry);
  });
  const data = normalizedRows.map((row) => row.entry);

  const anomalies: NormalizationAnomaly[] = normalizedRows
    .filter((row) => row.meta.confidence !== "high" || row.meta.warnings.length > 0)
    .map((row) => ({
      date: row.entry.date,
      source: sourceForAgents(row.rowMetadata.agents),
      mode: row.meta.mode,
      confidence: row.meta.confidence,
      consistencyError: row.meta.consistencyError,
      warnings: row.meta.warnings,
    }));

  return {
    data,
    rowMetadata: normalizedRows.map((row) => row.rowMetadata),
    anomalies,
    normalizationSummary: summarizeNormalization(normalizedRows.map((row) => row.meta)),
  };
}
