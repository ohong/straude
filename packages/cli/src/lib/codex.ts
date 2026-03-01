import { execFileSync } from "node:child_process";
import type { CcusageDailyEntry } from "./ccusage.js";

export interface CodexOutput {
  data: CcusageDailyEntry[];
}

const CODEX_PKG = "@ccusage/codex@latest";

/** Returns the raw JSON string from @ccusage/codex (for hashing). Empty string on failure. */
export function runCodexRaw(sinceDate: string, untilDate: string): string {
  try {
    return execCodex(["daily", "--json", "--since", sinceDate, "--until", untilDate]);
  } catch {
    return "";
  }
}

function execCodex(args: string[]): string {
  const cmd = process.versions.bun !== undefined ? "bunx" : "npx";
  const prefix = process.versions.bun !== undefined ? ["--bun"] : ["--yes"];

  return execFileSync(cmd, [...prefix, CODEX_PKG, ...args], {
    encoding: "utf-8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
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

export function parseCodexOutput(raw: string): CodexOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: [] };
  }

  // Empty array = no data
  if (Array.isArray(parsed) && (parsed as unknown[]).length === 0) {
    return { data: [] };
  }

  const output = parsed as CodexDailyOutput;
  if (!output.daily || !Array.isArray(output.daily)) {
    return { data: [] };
  }

  const data: CcusageDailyEntry[] = output.daily
    .filter((e) => {
      const cost = extractCost(e);
      return e.date && typeof cost === "number" && cost >= 0;
    })
    .map((e) => ({
      date: normalizeDate(e.date),
      models: extractModels(e),
      inputTokens: e.inputTokens ?? 0,
      outputTokens: e.outputTokens ?? 0,
      cacheCreationTokens: e.cacheCreationTokens ?? 0,
      // cachedInputTokens (codex) maps to cacheReadTokens in our canonical format
      cacheReadTokens: e.cachedInputTokens ?? e.cacheReadTokens ?? 0,
      totalTokens: e.totalTokens ?? 0,
      costUSD: extractCost(e)!,
    }));

  return { data };
}
