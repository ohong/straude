import { execFile as execFileCb } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CcusageDailyEntry, NormalizationAnomaly } from "./ccusage.js";
import {
  normalizeTokenBuckets,
  summarizeNormalization,
  type NormalizationMeta,
  type NormalizationSummary,
} from "./token-normalization.js";

export interface GeminiOutput {
  data: CcusageDailyEntry[];
  anomalies?: NormalizationAnomaly[];
  normalizationSummary?: NormalizationSummary;
  entryMeta?: Array<{ date: string; meta: NormalizationMeta }>;
}

const GCUSAGE_PKG = "gcusage@0";

/**
 * Async — returns raw JSON string with Gemini usage data.
 * Tries gcusage CLI first; falls back to reading session files directly.
 * Returns empty string on failure.
 */
export async function runGeminiRawAsync(sinceDate: string, untilDate: string): Promise<string> {
  // Try gcusage CLI first (reads telemetry.log)
  try {
    const since = formatIsoDate(sinceDate);
    const until = formatIsoDate(untilDate);
    const result = await execGcusageAsync(["--json", "--period", "day", "--since", since, "--until", until]);
    // gcusage returns "[]" when no telemetry.log exists — fall through to session reader
    if (result.trim() !== "[]") return result;
  } catch {
    // gcusage not installed or failed — fall through
  }

  // Fallback: read session files directly from ~/.gemini/tmp/*/chats/
  try {
    const data = await readGeminiSessions(sinceDate, untilDate);
    if (data.length === 0) return "";
    return JSON.stringify(data);
  } catch {
    return "";
  }
}

/** Convert YYYYMMDD to YYYY-MM-DD if needed. */
function formatIsoDate(d: string): string {
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}

function execGcusageAsync(args: string[]): Promise<string> {
  const cmd = process.versions.bun !== undefined ? "bunx" : "npx";
  const prefix = process.versions.bun !== undefined ? ["--bun"] : ["--yes"];

  return new Promise((resolve, reject) => {
    execFileCb(cmd, [...prefix, GCUSAGE_PKG, ...args], {
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

// ---------------------------------------------------------------------------
// gcusage CLI output parser
// ---------------------------------------------------------------------------

/**
 * gcusage daily JSON format:
 * [{date: "YYYY-MM-DD", models: string[], input: number, output: number, thought: number, cache: number, tool: number}]
 *
 * Note: gcusage's `input` is net input (cache already subtracted).
 * We add cache back for our normalized format where inputTokens is gross.
 */
interface GcusageEntry {
  date: string;
  models: string[];
  input: number;
  output: number;
  thought: number;
  cache: number;
  tool: number;
}

// ---------------------------------------------------------------------------
// Direct session file reader (fallback when gcusage has no data)
// ---------------------------------------------------------------------------

interface GeminiSessionMessage {
  type?: string;
  tokens?: {
    input?: number;
    output?: number;
    cached?: number;
    thoughts?: number;
    tool?: number;
    total?: number;
  };
  model?: string;
}

interface GeminiSession {
  sessionId?: string;
  startTime?: string;
  messages?: GeminiSessionMessage[];
}

interface DailyAggregate {
  models: Set<string>;
  input: number;
  output: number;
  thought: number;
  cache: number;
  tool: number;
}

async function readGeminiSessions(sinceDate: string, untilDate: string): Promise<GcusageEntry[]> {
  const geminiDir = join(homedir(), ".gemini");
  if (!existsSync(geminiDir)) return [];

  const tmpDir = join(geminiDir, "tmp");
  if (!existsSync(tmpDir)) return [];

  const sinceIso = formatIsoDate(sinceDate);
  const untilIso = formatIsoDate(untilDate);

  const byDate = new Map<string, DailyAggregate>();

  let projectDirs: string[];
  try {
    projectDirs = await readdir(tmpDir);
  } catch {
    return [];
  }

  for (const project of projectDirs) {
    const chatsDir = join(tmpDir, project, "chats");
    if (!existsSync(chatsDir)) continue;

    let sessionFiles: string[];
    try {
      sessionFiles = await readdir(chatsDir);
    } catch {
      continue;
    }

    for (const file of sessionFiles) {
      if (!file.endsWith(".json")) continue;

      // session-YYYY-MM-DDTHH-MM-{id}.json
      const dateMatch = file.match(/session-(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) continue;

      const sessionDate = dateMatch[1]!;
      if (sessionDate < sinceIso || sessionDate > untilIso) continue;

      try {
        const raw = await readFile(join(chatsDir, file), "utf-8");
        const session: GeminiSession = JSON.parse(raw);
        if (!session.messages) continue;

        // Use startTime date or filename date
        const date = session.startTime?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? sessionDate;
        if (date < sinceIso || date > untilIso) continue;

        let agg = byDate.get(date);
        if (!agg) {
          agg = { models: new Set(), input: 0, output: 0, thought: 0, cache: 0, tool: 0 };
          byDate.set(date, agg);
        }

        for (const msg of session.messages) {
          if (!msg.tokens) continue;
          if (msg.model) agg.models.add(msg.model);

          agg.input += msg.tokens.input ?? 0;
          agg.output += msg.tokens.output ?? 0;
          agg.thought += msg.tokens.thoughts ?? 0;
          agg.cache += msg.tokens.cached ?? 0;
          agg.tool += msg.tokens.tool ?? 0;
        }
      } catch {
        continue;
      }
    }
  }

  // Return in gcusage format so parseGeminiOutput handles both paths
  const entries: GcusageEntry[] = [];
  for (const [date, agg] of byDate) {
    // gcusage convention: input is net (cache subtracted from input total)
    entries.push({
      date,
      models: [...agg.models],
      input: agg.input,
      output: agg.output,
      thought: agg.thought,
      cache: agg.cache,
      tool: agg.tool,
    });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

// ---------------------------------------------------------------------------
// Parser (shared by both gcusage and session-reader paths)
// ---------------------------------------------------------------------------

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
        warnings: ["Failed to parse Gemini JSON output."],
      }],
      normalizationSummary: {
        total: 1,
        anomalies: 1,
        byMode: { unresolved: 1 },
        byConfidence: { low: 1 },
      },
    };
  }

  if (!Array.isArray(parsed)) {
    return { data: [], anomalies: [], normalizationSummary: summarizeNormalization([]), entryMeta: [] };
  }

  const entries = parsed as GcusageEntry[];
  if (entries.length === 0) {
    return { data: [], anomalies: [], normalizationSummary: summarizeNormalization([]), entryMeta: [] };
  }

  const normalizedRows = entries
    .filter((e) => e.date)
    .map((e) => {
      // gcusage/session-reader: input is net (cache already subtracted by gcusage,
      // or raw per-message input from session files where cached is separate).
      // Gross input = input + cache for our normalized format.
      const grossInput = e.input + e.cache;
      const totalOutput = e.output + e.thought + e.tool;
      const totalTokens = grossInput + totalOutput + e.cache;

      const normalized = normalizeTokenBuckets(
        {
          inputTokens: grossInput,
          outputTokens: totalOutput,
          cacheReadTokens: e.cache,
          cacheCreationTokens: 0,
          totalTokens,
        },
        { source: "generic", cacheSemantics: "separate" },
      );

      return {
        date: e.date,
        meta: normalized.meta,
        entry: {
          date: e.date,
          models: e.models ?? [],
          inputTokens: normalized.normalized.inputTokens,
          outputTokens: normalized.normalized.outputTokens,
          cacheCreationTokens: normalized.normalized.cacheCreationTokens,
          cacheReadTokens: normalized.normalized.cacheReadTokens,
          totalTokens: normalized.normalized.totalTokens,
          costUSD: 0, // Gemini CLI is free tier; no cost data available
        } satisfies CcusageDailyEntry,
      };
    });

  const anomalies: NormalizationAnomaly[] = normalizedRows
    .filter((row) => row.meta.mode === "unresolved" || row.meta.confidence !== "high" || row.meta.warnings.length > 0)
    .map((row) => ({
      date: row.date,
      source: "gemini" as const,
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
