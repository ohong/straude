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

export interface MistralOutput {
  data: CcusageDailyEntry[];
  anomalies?: NormalizationAnomaly[];
  normalizationSummary?: NormalizationSummary;
  entryMeta?: Array<{ date: string; meta: NormalizationMeta }>;
}

/**
 * Mistral Vibe stores session data in:
 *   ~/.vibe/logs/session/session_{YYYYMMDD}_{HHMMSS}_{id}/
 *     - meta.json: { session_id, start_time, stats: { session_prompt_tokens, session_completion_tokens, ... } }
 *     - messages.jsonl: JSONL with LLMMessage objects
 *
 * VIBE_HOME env var can override the ~/.vibe/ base directory.
 */

/** Async — reads Mistral Vibe session metadata and aggregates by date. Empty on failure. */
export async function runMistralRawAsync(sinceDate: string, untilDate: string): Promise<string> {
  try {
    const data = await readMistralSessions(sinceDate, untilDate);
    if (data.length === 0) return "";
    return JSON.stringify(data);
  } catch {
    return "";
  }
}

interface MistralSessionMeta {
  session_id?: string;
  start_time?: string;
  end_time?: string | null;
  stats?: {
    session_prompt_tokens?: number;
    session_completion_tokens?: number;
    context_tokens?: number;
    input_price_per_million?: number;
    output_price_per_million?: number;
  };
  config?: {
    active_model?: string;
    provider?: {
      model?: string;
    };
  };
  agent_profile?: {
    model?: string;
  };
}

interface DailyAggregate {
  models: Set<string>;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
}

/** Convert YYYYMMDD to YYYY-MM-DD if needed. */
function toIsoDate(d: string): string {
  if (/^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}

/** Extract YYYY-MM-DD from an ISO timestamp or folder name. */
function extractDate(s: string): string | null {
  // ISO timestamp: 2026-03-05T13:11:24Z
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1]!;

  // Folder timestamp: 20260305_131124
  const folderMatch = s.match(/(\d{4})(\d{2})(\d{2})_\d{6}/);
  if (folderMatch) return `${folderMatch[1]}-${folderMatch[2]}-${folderMatch[3]}`;

  return null;
}

function getVibeHome(): string {
  return process.env.VIBE_HOME || join(homedir(), ".vibe");
}

async function readMistralSessions(sinceDate: string, untilDate: string): Promise<CcusageDailyEntry[]> {
  const vibeHome = getVibeHome();
  if (!existsSync(vibeHome)) return [];

  const sessionLogDir = join(vibeHome, "logs", "session");
  if (!existsSync(sessionLogDir)) return [];

  const sinceIso = toIsoDate(sinceDate);
  const untilIso = toIsoDate(untilDate);

  const byDate = new Map<string, DailyAggregate>();

  let sessionDirs: string[];
  try {
    sessionDirs = await readdir(sessionLogDir);
  } catch {
    return [];
  }

  for (const dir of sessionDirs) {
    // Folder pattern: session_YYYYMMDD_HHMMSS_{id}
    const dateFromFolder = extractDate(dir.replace(/^session_/, ""));

    const metaPath = join(sessionLogDir, dir, "meta.json");
    if (!existsSync(metaPath)) continue;

    try {
      const raw = await readFile(metaPath, "utf-8");
      const meta: MistralSessionMeta = JSON.parse(raw);

      // Determine session date from meta.start_time or folder name
      const date = (meta.start_time ? extractDate(meta.start_time) : null) ?? dateFromFolder;
      if (!date || date < sinceIso || date > untilIso) continue;

      const stats = meta.stats;
      if (!stats) continue;

      const promptTokens = stats.session_prompt_tokens ?? 0;
      const completionTokens = stats.session_completion_tokens ?? 0;
      if (promptTokens === 0 && completionTokens === 0) continue;

      let agg = byDate.get(date);
      if (!agg) {
        agg = { models: new Set(), inputTokens: 0, outputTokens: 0, costUSD: 0 };
        byDate.set(date, agg);
      }

      // Extract model name: config.active_model (primary), then fallbacks
      const model = meta.config?.active_model ?? meta.agent_profile?.model ?? meta.config?.provider?.model;
      if (model) agg.models.add(model);

      agg.inputTokens += promptTokens;
      agg.outputTokens += completionTokens;

      // Estimate cost from pricing info if available
      if (stats.input_price_per_million && stats.output_price_per_million) {
        agg.costUSD +=
          (promptTokens / 1_000_000) * stats.input_price_per_million +
          (completionTokens / 1_000_000) * stats.output_price_per_million;
      }
    } catch {
      // Skip malformed session metadata
      continue;
    }
  }

  const entries: CcusageDailyEntry[] = [];
  for (const [date, agg] of byDate) {
    entries.push({
      date,
      models: [...agg.models],
      inputTokens: agg.inputTokens,
      outputTokens: agg.outputTokens,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: agg.inputTokens + agg.outputTokens,
      costUSD: agg.costUSD,
    });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

export function parseMistralOutput(raw: string): MistralOutput {
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

  // Direct file reading produces pre-normalized data — no anomalies expected
  return {
    data,
    anomalies: [],
    normalizationSummary: summarizeNormalization([]),
    entryMeta: [],
  };
}
