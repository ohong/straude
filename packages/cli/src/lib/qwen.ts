import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CcusageDailyEntry, NormalizationAnomaly } from "./ccusage.js";
import {
  summarizeNormalization,
  type NormalizationMeta,
  type NormalizationSummary,
} from "./token-normalization.js";

export interface QwenOutput {
  data: CcusageDailyEntry[];
  anomalies?: NormalizationAnomaly[];
  normalizationSummary?: NormalizationSummary;
  entryMeta?: Array<{ date: string; meta: NormalizationMeta }>;
}

/**
 * Qwen Code stores session data as JSONL in:
 *   ~/.qwen/projects/{project-path}/chats/{session-uuid}.jsonl
 *
 * Each line is a JSON object. Token usage is in entries with:
 *   - type: "assistant" → usageMetadata: { promptTokenCount, candidatesTokenCount, ... }
 *   - model field on assistant entries
 */

/** Async — reads Qwen Code session files and aggregates by date. Empty on failure. */
export async function runQwenRawAsync(sinceDate: string, untilDate: string): Promise<string> {
  try {
    const data = await readQwenSessions(sinceDate, untilDate);
    if (data.length === 0) return "";
    return JSON.stringify(data);
  } catch {
    return "";
  }
}

interface DailyAggregate {
  models: Set<string>;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
}

/** Convert YYYYMMDD to YYYY-MM-DD if needed. */
function toIsoDate(d: string): string {
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}

async function readQwenSessions(sinceDate: string, untilDate: string): Promise<CcusageDailyEntry[]> {
  const qwenDir = join(homedir(), ".qwen");
  if (!existsSync(qwenDir)) return [];

  const projectsDir = join(qwenDir, "projects");
  if (!existsSync(projectsDir)) return [];

  const sinceIso = toIsoDate(sinceDate);
  const untilIso = toIsoDate(untilDate);

  const byDate = new Map<string, DailyAggregate>();

  // Scan all project directories under ~/.qwen/projects/
  let projectDirs: string[];
  try {
    projectDirs = await readdir(projectsDir);
  } catch {
    return [];
  }

  for (const project of projectDirs) {
    const chatsDir = join(projectsDir, project, "chats");
    if (!existsSync(chatsDir)) continue;

    let chatFiles: string[];
    try {
      chatFiles = await readdir(chatsDir);
    } catch {
      continue;
    }

    for (const file of chatFiles) {
      if (!file.endsWith(".jsonl")) continue;

      try {
        const raw = await readFile(join(chatsDir, file), "utf-8");
        const lines = raw.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          let entry: Record<string, unknown>;
          try {
            entry = JSON.parse(line);
          } catch {
            continue;
          }

          // Only process assistant entries with usageMetadata
          if (entry.type !== "assistant") continue;

          const usage = entry.usageMetadata as Record<string, number> | undefined;
          if (!usage) continue;

          const timestamp = entry.timestamp as string | undefined;
          if (!timestamp) continue;

          const dateMatch = timestamp.match(/^(\d{4}-\d{2}-\d{2})/);
          if (!dateMatch) continue;

          const date = dateMatch[1]!;
          if (date < sinceIso || date > untilIso) continue;

          let agg = byDate.get(date);
          if (!agg) {
            agg = { models: new Set(), inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, thoughtsTokens: 0, totalTokens: 0 };
            byDate.set(date, agg);
          }

          const model = entry.model as string | undefined;
          if (model) agg.models.add(model);

          agg.inputTokens += usage.promptTokenCount ?? 0;
          agg.outputTokens += usage.candidatesTokenCount ?? 0;
          agg.cacheReadTokens += usage.cachedContentTokenCount ?? 0;
          agg.thoughtsTokens += usage.thoughtsTokenCount ?? 0;
          agg.totalTokens += usage.totalTokenCount ?? 0;
        }
      } catch {
        continue;
      }
    }
  }

  const entries: CcusageDailyEntry[] = [];
  for (const [date, agg] of byDate) {
    entries.push({
      date,
      models: [...agg.models],
      inputTokens: agg.inputTokens,
      outputTokens: agg.outputTokens + agg.thoughtsTokens,
      cacheCreationTokens: 0,
      cacheReadTokens: agg.cacheReadTokens,
      totalTokens: agg.totalTokens,
      costUSD: 0, // Qwen Code free tier via OAuth; no cost data
    });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

export function parseQwenOutput(raw: string): QwenOutput {
  if (!raw) {
    return { data: [], anomalies: [], normalizationSummary: summarizeNormalization([]), entryMeta: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: [], anomalies: [], normalizationSummary: summarizeNormalization([]), entryMeta: [] };
  }

  if (!Array.isArray(parsed)) {
    return { data: [], anomalies: [], normalizationSummary: summarizeNormalization([]), entryMeta: [] };
  }

  const data = parsed as CcusageDailyEntry[];

  return {
    data,
    anomalies: [],
    normalizationSummary: summarizeNormalization([]),
    entryMeta: [],
  };
}
