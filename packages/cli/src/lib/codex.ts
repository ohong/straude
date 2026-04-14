import { execFileSync, execFile as execFileCb } from "node:child_process";
import type { CcusageDailyEntry, ModelBreakdownEntry, NormalizationAnomaly } from "./ccusage.js";
import {
  normalizeTokenBuckets,
  summarizeNormalization,
  type NormalizationMeta,
  type NormalizationSummary,
} from "./token-normalization.js";
import { DEFAULT_SUBPROCESS_TIMEOUT_MS } from "../config.js";

export interface CodexOutput {
  data: CcusageDailyEntry[];
  anomalies?: NormalizationAnomaly[];
  normalizationSummary?: NormalizationSummary;
  entryMeta?: Array<{ date: string; meta: NormalizationMeta }>;
}

// Pin to major version so bunx/npx can use the cached copy without a registry roundtrip.
// @latest forces a registry check on every invocation (~200-1000ms penalty).
const DEFAULT_CODEX_PKG = "@ccusage/codex@18";

function getCodexPackage(): string {
  const override = process.env.STRAUDE_CODEX_PKG?.trim();
  return override || DEFAULT_CODEX_PKG;
}

/** Returns the raw JSON string from @ccusage/codex (for hashing). Empty string on failure. */
export function runCodexRaw(sinceDate: string, untilDate: string, timeoutMs?: number): string {
  try {
    return execCodex(["daily", "--json", "--since", sinceDate, "--until", untilDate], timeoutMs);
  } catch {
    return "";
  }
}

/** Async version — returns raw JSON string without blocking. Empty string on failure. */
export async function runCodexRawAsync(sinceDate: string, untilDate: string, timeoutMs?: number): Promise<string> {
  try {
    return await execCodexAsync(["daily", "--json", "--since", sinceDate, "--until", untilDate], timeoutMs);
  } catch {
    return "";
  }
}

function execCodex(args: string[], timeoutMs?: number): string {
  const cmd = process.versions.bun !== undefined ? "bunx" : "npx";
  const prefix = process.versions.bun !== undefined ? ["--bun"] : ["--yes"];

  return execFileSync(cmd, [...prefix, getCodexPackage(), ...args], {
    encoding: "utf-8",
    timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32",
  });
}

function execCodexAsync(args: string[], timeoutMs?: number): Promise<string> {
  const cmd = process.versions.bun !== undefined ? "bunx" : "npx";
  const prefix = process.versions.bun !== undefined ? ["--bun"] : ["--yes"];

  return new Promise((resolve, reject) => {
    execFileCb(cmd, [...prefix, getCodexPackage(), ...args], {
      encoding: "utf-8",
      timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32",
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/**
 * Raw shape returned by @ccusage/codex (`daily --json`).
 *
 * The actual format differs from ccusage in several ways:
 * - Cost: `costUSD` (not `totalCost`)
 * - Date: locale string like "Feb 03, 2026" (not ISO 8601)
 * - Models: `models: Record<string, {...}>` (not `modelsUsed: string[]`)
 * - Cache: `cachedInputTokens` is a subset of `inputTokens` (not a separate `cacheReadTokens`)
 */
interface CodexRawEntry {
  date: string;
  // Real format: models as object with model names as keys
  models?: Record<string, unknown>;
  // Legacy/hypothetical format: modelsUsed as string array
  modelsUsed?: string[];
  inputTokens: number;
  outputTokens: number;
  reasoningOutputTokens?: number;
  cachedInputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens: number;
  // Real format uses costUSD; accept totalCost for forward-compatibility
  costUSD?: number;
  totalCost?: number;
}

interface CodexDailyOutput {
  daily: CodexRawEntry[];
}

/**
 * Parse locale date string ("Feb 03, 2026") to ISO format ("2026-02-03").
 * Also accepts ISO dates as-is.
 */
function normalizeDate(dateStr: string): string {
  // Already ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr;

  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Extract model names from either object keys or string array. */
function extractModels(entry: CodexRawEntry): string[] {
  if (entry.models && typeof entry.models === "object" && !Array.isArray(entry.models)) {
    return Object.keys(entry.models);
  }
  if (Array.isArray(entry.modelsUsed)) {
    return entry.modelsUsed;
  }
  return [];
}

/** Get cost from either costUSD or totalCost. */
function extractCost(entry: CodexRawEntry): number | undefined {
  if (typeof entry.costUSD === "number") return entry.costUSD;
  if (typeof entry.totalCost === "number") return entry.totalCost;
  return undefined;
}

/** Per-model usage shape from @ccusage/codex output. */
interface CodexModelUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/**
 * Build per-model cost breakdown by distributing total cost proportionally
 * by each model's totalTokens. Much more accurate than even-split when
 * models have different usage volumes.
 */
function buildModelBreakdown(
  entry: CodexRawEntry,
  totalCost: number,
): ModelBreakdownEntry[] | undefined {
  if (!entry.models || typeof entry.models !== "object" || Array.isArray(entry.models)) {
    return undefined;
  }

  const perModel: Array<{ model: string; tokens: number }> = [];
  let tokenSum = 0;

  for (const [model, raw] of Object.entries(entry.models)) {
    const usage = raw as CodexModelUsage | null;
    const tokens = usage?.totalTokens ?? 0;
    perModel.push({ model, tokens });
    tokenSum += tokens;
  }

  if (perModel.length === 0 || tokenSum === 0) return undefined;

  return perModel.map(({ model, tokens }) => ({
    model,
    cost_usd: totalCost * (tokens / tokenSum),
  }));
}

export function parseCodexOutput(raw: string): CodexOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      data: [],
      anomalies: [{
        date: "unknown",
        source: "codex",
        mode: "unresolved",
        confidence: "low",
        consistencyError: 0,
        warnings: ["Failed to parse codex JSON output."],
      }],
      normalizationSummary: {
        total: 1,
        anomalies: 1,
        byMode: { unresolved: 1 },
        byConfidence: { low: 1 },
      },
    };
  }

  // Empty array = no data
  if (Array.isArray(parsed) && (parsed as unknown[]).length === 0) {
    return { data: [], anomalies: [], normalizationSummary: summarizeNormalization([]), entryMeta: [] };
  }

  const output = parsed as CodexDailyOutput;
  if (!output.daily || !Array.isArray(output.daily)) {
    return { data: [], anomalies: [], normalizationSummary: summarizeNormalization([]), entryMeta: [] };
  }

  const normalizedRows = output.daily
    .filter((e) => {
      const cost = extractCost(e);
      return e.date && typeof cost === "number" && cost >= 0;
    })
    .map((e) => {
      const normalizedDate = normalizeDate(e.date);
      const normalized = normalizeTokenBuckets(
        {
          inputTokens: e.inputTokens,
          outputTokens: e.outputTokens,
          reasoningOutputTokens: e.reasoningOutputTokens,
          cachedInputTokens: e.cachedInputTokens,
          cacheReadTokens: e.cacheReadTokens,
          cacheCreationTokens: e.cacheCreationTokens,
          totalTokens: e.totalTokens,
        },
        { source: "codex", cacheSemantics: "auto" },
      );

      const cost = extractCost(e)!;
      return {
        date: normalizedDate,
        meta: normalized.meta,
        entry: {
          date: normalizedDate,
          models: extractModels(e),
          inputTokens: normalized.normalized.inputTokens,
          outputTokens: normalized.normalized.outputTokens,
          cacheCreationTokens: normalized.normalized.cacheCreationTokens,
          cacheReadTokens: normalized.normalized.cacheReadTokens,
          totalTokens: normalized.normalized.totalTokens,
          costUSD: cost,
          reasoningOutputTokens: normalized.normalized.reasoningOutputTokens,
          modelBreakdown: buildModelBreakdown(e, cost),
        } satisfies CcusageDailyEntry,
      };
    });

  const anomalies: NormalizationAnomaly[] = normalizedRows
    .filter((row) => row.meta.mode === "unresolved" || row.meta.confidence !== "high" || row.meta.warnings.length > 0)
    .map((row) => ({
      date: row.date,
      source: "codex",
      mode: row.meta.mode,
      confidence: row.meta.confidence,
      consistencyError: row.meta.consistencyError,
      warnings: row.meta.warnings,
    }));

  return {
    data: normalizedRows.map((row) => row.entry),
    anomalies,
    normalizationSummary: summarizeNormalization(normalizedRows.map((row) => row.meta)),
    entryMeta: normalizedRows.map((row) => ({ date: row.date, meta: row.meta })),
  };
}
