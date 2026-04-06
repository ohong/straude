import { execFileSync, execFile as execFileCb } from "node:child_process";
import type { CcusageDailyEntry, NormalizationAnomaly } from "./ccusage.js";
import {
  normalizeTokenBuckets,
  summarizeNormalization,
  type NormalizationMeta,
  type NormalizationSummary,
} from "./token-normalization.js";
import { DEFAULT_SUBPROCESS_TIMEOUT_MS } from "../config.js";

export interface GeminiOutput {
  data: CcusageDailyEntry[];
  anomalies?: NormalizationAnomaly[];
  normalizationSummary?: NormalizationSummary;
  entryMeta?: Array<{ date: string; meta: NormalizationMeta }>;
}

// Pin to major version so bunx/npx can use the cached copy without a registry roundtrip.
const GEMISTAT_PKG = "gemistat@0";

/**
 * Convert compact date (YYYYMMDD) to ISO date (YYYY-MM-DD).
 * gemistat expects ISO dates, unlike ccusage which expects compact dates.
 */
function toIsoDate(compact: string): string {
  if (compact.length === 8 && !compact.includes("-")) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }
  return compact;
}

/** Returns the raw JSON string from gemistat (for hashing). Empty string on failure. */
export function runGeminiRaw(sinceDate: string, untilDate: string, timeoutMs?: number): string {
  try {
    return execGemistat(["daily", "--json", "--since", toIsoDate(sinceDate), "--until", toIsoDate(untilDate)], timeoutMs);
  } catch {
    return "";
  }
}

/** Async version — returns raw JSON string without blocking. Empty string on failure. */
export async function runGeminiRawAsync(sinceDate: string, untilDate: string, timeoutMs?: number): Promise<string> {
  try {
    return await execGemistatAsync(["daily", "--json", "--since", toIsoDate(sinceDate), "--until", toIsoDate(untilDate)], timeoutMs);
  } catch {
    return "";
  }
}

function execGemistat(args: string[], timeoutMs?: number): string {
  const cmd = process.versions.bun !== undefined ? "bunx" : "npx";
  const prefix = process.versions.bun !== undefined ? ["--bun"] : ["--yes"];

  return execFileSync(cmd, [...prefix, GEMISTAT_PKG, ...args], {
    encoding: "utf-8",
    timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32",
  });
}

function execGemistatAsync(args: string[], timeoutMs?: number): Promise<string> {
  const cmd = process.versions.bun !== undefined ? "bunx" : "npx";
  const prefix = process.versions.bun !== undefined ? ["--bun"] : ["--yes"];

  return new Promise((resolve, reject) => {
    execFileCb(cmd, [...prefix, GEMISTAT_PKG, ...args], {
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
 * Raw shape returned by gemistat (`daily --json`).
 *
 * Format matches ccusage conventions:
 * - Cost: `totalCost`
 * - Date: ISO 8601 ("2025-06-01")
 * - Models: `modelsUsed: string[]`
 * - Cache: separate `cacheCreationTokens` and `cacheReadTokens`
 * - No `totalTokens` — computed as input + output + cacheCreation + cacheRead
 */
interface GemistatRawEntry {
  date: string;
  modelsUsed?: string[];
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalCost: number;
}

interface GemistatDailyOutput {
  daily: GemistatRawEntry[];
  totals?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    totalCost: number;
  };
}

export function parseGeminiOutput(raw: string): GeminiOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      data: [],
      anomalies: [{
        date: "unknown",
        source: "gemini",
        mode: "unresolved",
        confidence: "low",
        consistencyError: 0,
        warnings: ["Failed to parse gemistat JSON output."],
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

  const output = parsed as GemistatDailyOutput;
  if (!output.daily || !Array.isArray(output.daily)) {
    return { data: [], anomalies: [], normalizationSummary: summarizeNormalization([]), entryMeta: [] };
  }

  const normalizedRows = output.daily
    .filter((e) => {
      return e.date && typeof e.totalCost === "number" && e.totalCost >= 0;
    })
    .map((e) => {
      const cacheCreation = e.cacheCreationTokens ?? 0;
      const cacheRead = e.cacheReadTokens ?? 0;
      const computedTotal = (e.inputTokens ?? 0) + (e.outputTokens ?? 0) + cacheCreation + cacheRead;

      const normalized = normalizeTokenBuckets(
        {
          inputTokens: e.inputTokens,
          outputTokens: e.outputTokens,
          cacheCreationTokens: cacheCreation,
          cacheReadTokens: cacheRead,
          totalTokens: computedTotal,
        },
        { source: "gemini", cacheSemantics: "separate" },
      );

      return {
        date: e.date,
        meta: normalized.meta,
        entry: {
          date: e.date,
          models: e.modelsUsed ?? [],
          inputTokens: normalized.normalized.inputTokens,
          outputTokens: normalized.normalized.outputTokens,
          cacheCreationTokens: normalized.normalized.cacheCreationTokens,
          cacheReadTokens: normalized.normalized.cacheReadTokens,
          totalTokens: normalized.normalized.totalTokens,
          costUSD: e.totalCost,
          reasoningOutputTokens: normalized.normalized.reasoningOutputTokens,
        } satisfies CcusageDailyEntry,
      };
    });

  const anomalies: NormalizationAnomaly[] = normalizedRows
    .filter((row) => row.meta.mode === "unresolved" || row.meta.confidence !== "high" || row.meta.warnings.length > 0)
    .map((row) => ({
      date: row.date,
      source: "gemini",
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
