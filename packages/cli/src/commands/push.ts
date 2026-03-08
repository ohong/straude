import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { loadConfig, updateLastPushDate, saveConfig } from "../lib/auth.js";
import type { StraudeConfig } from "../lib/auth.js";
import { loginCommand } from "./login.js";
import { apiRequest } from "../lib/api.js";
import { runCcusageRawAsync, parseCcusageOutput } from "../lib/ccusage.js";
import type { CcusageDailyEntry, ModelBreakdownEntry } from "../lib/ccusage.js";
import { runCodexRawAsync, parseCodexOutput } from "../lib/codex.js";
import { runGeminiRawAsync, parseGeminiOutput } from "../lib/gemini.js";
import { runQwenRawAsync, parseQwenOutput } from "../lib/qwen.js";
import { runMistralRawAsync, parseMistralOutput } from "../lib/mistral.js";
import { MAX_BACKFILL_DAYS } from "../config.js";

interface UsageSubmitRequest {
  entries: Array<{
    date: string;
    data: CcusageDailyEntry;
  }>;
  hash?: string;
  source: "cli" | "web";
  device_id?: string;
  device_name?: string;
}

interface UsageSubmitResponse {
  results: Array<{
    date: string;
    usage_id: string;
    post_id: string;
    post_url: string;
    action: "created" | "updated";
  }>;
}

interface PushOptions {
  date?: string;
  days?: number;
  dryRun?: boolean;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateCompact(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y!, m! - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  return Math.round(Math.abs(a.getTime() - b.getTime()) / msPerDay);
}

function daysBetweenStrings(dateStrA: string, dateStrB: string): number {
  const [ay, am, ad] = dateStrA.split("-").map(Number);
  const [by, bm, bd] = dateStrB.split("-").map(Number);
  const a = new Date(ay!, am! - 1, ad!);
  const b = new Date(by!, bm! - 1, bd!);
  const msPerDay = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * Build per-model cost breakdown from a source's entry.
 * Distributes total cost evenly across models when per-model data isn't available.
 */
function buildBreakdown(entry: CcusageDailyEntry): ModelBreakdownEntry[] {
  if (entry.modelBreakdown && entry.modelBreakdown.length > 0) return entry.modelBreakdown;
  // Fallback: distribute evenly (no per-model data available)
  if (entry.models.length === 0 || entry.costUSD === 0) return [];
  const perModel = entry.costUSD / entry.models.length;
  return entry.models.map((model) => ({ model, cost_usd: perModel }));
}

/**
 * Merge daily entries from multiple providers by date.
 * Sums tokens/costs, unions models, builds model_breakdown.
 */
export function mergeEntries(
  claudeEntries: CcusageDailyEntry[],
  codexEntries: CcusageDailyEntry[],
  ...additionalSources: CcusageDailyEntry[][]
): CcusageDailyEntry[] {
  const allSources = [claudeEntries, codexEntries, ...additionalSources];
  const byDate = new Map<string, CcusageDailyEntry[]>();

  for (const source of allSources) {
    for (const e of source) {
      const existing = byDate.get(e.date) ?? [];
      existing.push(e);
      byDate.set(e.date, existing);
    }
  }

  const merged: CcusageDailyEntry[] = [];

  for (const [date, entries] of byDate) {
    const allBreakdowns = entries.flatMap((e) => buildBreakdown(e));

    merged.push({
      date,
      models: entries.flatMap((e) => e.models),
      inputTokens: entries.reduce((sum, e) => sum + e.inputTokens, 0),
      outputTokens: entries.reduce((sum, e) => sum + e.outputTokens, 0),
      cacheCreationTokens: entries.reduce((sum, e) => sum + e.cacheCreationTokens, 0),
      cacheReadTokens: entries.reduce((sum, e) => sum + e.cacheReadTokens, 0),
      totalTokens: entries.reduce((sum, e) => sum + e.totalTokens, 0),
      costUSD: entries.reduce((sum, e) => sum + e.costUSD, 0),
      modelBreakdown: allBreakdowns.length > 0 ? allBreakdowns : undefined,
    });
  }

  // Sort by date ascending
  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}

export async function pushCommand(options: PushOptions, apiUrlOverride?: string): Promise<void> {
  let config = loadConfig();

  // Login if needed
  if (!config) {
    await loginCommand(apiUrlOverride);
    config = loadConfig();
    if (!config) {
      console.error("Login failed.");
      process.exit(1);
    }
  }

  // --api-url flag overrides the stored config URL
  if (apiUrlOverride) {
    config = { ...config, api_url: apiUrlOverride };
  }

  // Ensure device_id exists — generate on first push
  if (!config.device_id) {
    config.device_id = randomUUID();
    config.device_name = hostname();
    saveConfig(config);
  }

  const today = new Date();
  const todayStr = formatDate(today);

  let sinceDate: Date;
  let untilDate: Date;

  if (options.date) {
    const target = parseDate(options.date);
    if (daysBetween(today, target) > MAX_BACKFILL_DAYS) {
      console.error(`Date must be within the last ${MAX_BACKFILL_DAYS} days.`);
      process.exit(1);
    }
    if (target > today) {
      console.error("Cannot push usage for a future date.");
      process.exit(1);
    }
    sinceDate = target;
    untilDate = target;
  } else if (options.days) {
    const days = Math.min(options.days, MAX_BACKFILL_DAYS);
    sinceDate = new Date(today);
    sinceDate.setDate(sinceDate.getDate() - days + 1);
    untilDate = today;
  } else if (config.last_push_date) {
    // Smart sync: calculate days since last push
    if (config.last_push_date >= todayStr) {
      // Already pushed today — re-sync with days=1
      sinceDate = today;
      untilDate = today;
    } else {
      const gap = daysBetweenStrings(config.last_push_date, todayStr);
      const days = Math.min(gap, MAX_BACKFILL_DAYS);
      sinceDate = new Date(today);
      sinceDate.setDate(sinceDate.getDate() - days + 1);
      untilDate = today;
    }
  } else {
    // Never pushed before — backfill last 3 days by default
    const FIRST_RUN_BACKFILL_DAYS = 3;
    sinceDate = new Date(today);
    sinceDate.setDate(sinceDate.getDate() - FIRST_RUN_BACKFILL_DAYS + 1);
    untilDate = today;
  }

  const sinceStr = formatDateCompact(sinceDate);
  const untilStr = formatDateCompact(untilDate);

  console.log(
    sinceDate.getTime() === untilDate.getTime()
      ? `Pushing usage for ${formatDate(sinceDate)}...`
      : `Pushing usage for ${formatDate(sinceDate)} to ${formatDate(untilDate)}...`,
  );

  // Run all providers in parallel — the single biggest perf win
  const [claudeResult, codexRaw, geminiRaw, qwenRaw, mistralRaw] = await Promise.all([
    runCcusageRawAsync(sinceStr, untilStr).catch((err: Error) => err),
    runCodexRawAsync(sinceStr, untilStr),
    runGeminiRawAsync(sinceStr, untilStr),
    runQwenRawAsync(sinceStr, untilStr),
    runMistralRawAsync(sinceStr, untilStr),
  ]);

  // Claude data is required — fail if it errored
  if (claudeResult instanceof Error) {
    console.error(claudeResult.message);
    process.exit(1);
  }
  const claudeRaw: string = claudeResult;

  let claudeEntries: CcusageDailyEntry[];
  let claudeAnomalies: Array<{ confidence: "high" | "medium" | "low"; mode: string }> = [];
  try {
    const parsed = parseCcusageOutput(claudeRaw);
    claudeEntries = parsed.data;
    claudeAnomalies = (parsed.anomalies ?? []).map((a) => ({ confidence: a.confidence, mode: a.mode }));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  // Codex data — silent on fetch failure (empty string), but surface parser anomalies.
  const codexParsed = codexRaw ? parseCodexOutput(codexRaw) : { data: [], anomalies: [], entryMeta: [] };

  // Gemini, Qwen, Mistral — silent on fetch failure
  const geminiParsed = geminiRaw ? parseGeminiOutput(geminiRaw) : { data: [], anomalies: [], entryMeta: [] };
  const qwenParsed = qwenRaw ? parseQwenOutput(qwenRaw) : { data: [], anomalies: [], entryMeta: [] };
  const mistralParsed = mistralRaw ? parseMistralOutput(mistralRaw) : { data: [], anomalies: [], entryMeta: [] };

  const allAnomalies = [
    ...claudeAnomalies,
    ...(codexParsed.anomalies ?? []),
    ...(geminiParsed.anomalies ?? []),
    ...(qwenParsed.anomalies ?? []),
    ...(mistralParsed.anomalies ?? []),
  ];
  const mediumLowCount = allAnomalies.filter((a) => a.confidence !== "high").length;
  if (mediumLowCount > 0) {
    const lowCount = allAnomalies.filter((a) => a.confidence === "low").length;
    const unresolvedCount = allAnomalies.filter((a) => a.mode === "unresolved").length;
    console.log(
      `Warning: normalization anomalies detected (${mediumLowCount} medium/low rows, low confidence: ${lowCount}, unresolved: ${unresolvedCount}).`,
    );
  }

  const codexMetaByDate = new Map((codexParsed.entryMeta ?? []).map((row) => [row.date, row.meta]));
  const blockedDates = new Set<string>();

  for (const [date, meta] of codexMetaByDate) {
    if (meta.mode === "unresolved") {
      blockedDates.add(date);
    }
  }

  if (blockedDates.size > 0) {
    const blocked = [...blockedDates].sort();
    const reason = "unresolved codex normalization";
    console.log(`Warning: skipping Codex rows for ${blocked.length} date(s) due to ${reason}: ${blocked.join(", ")}`);
  }

  const codexEntries = codexParsed.data.filter((entry) => !blockedDates.has(entry.date));

  // Merge all provider entries by date
  const entries = mergeEntries(
    claudeEntries,
    codexEntries,
    geminiParsed.data,
    qwenParsed.data,
    mistralParsed.data,
  );

  if (entries.length === 0) {
    console.log("No usage data found for the specified period.");
    return;
  }

  // Print summary for each day
  for (const entry of entries) {
    console.log(`  ${entry.date}:`);
    console.log(`    Cost: ${formatCost(entry.costUSD)}`);
    console.log(
      `    Tokens: ${formatTokens(entry.totalTokens)} (input: ${formatTokens(entry.inputTokens)}, output: ${formatTokens(entry.outputTokens)})`,
    );
    console.log(`    Models: ${entry.models.join(", ")}`);
  }

  if (options.dryRun) {
    console.log("\n(dry run — nothing submitted)");
    return;
  }

  // Compute SHA-256 hash of concatenated raw JSONs from all providers
  const hashInput = [claudeRaw, codexRaw, geminiRaw, qwenRaw, mistralRaw].filter(Boolean).join("");
  const hash = createHash("sha256").update(hashInput).digest("hex");

  const body: UsageSubmitRequest = {
    entries: entries.map((entry) => ({
      date: entry.date,
      data: entry,
    })),
    hash,
    source: "cli",
    device_id: config.device_id,
    device_name: config.device_name,
  };

  let response: UsageSubmitResponse;
  try {
    response = await apiRequest<UsageSubmitResponse>(config, "/api/usage/submit", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`\nFailed to submit: ${(err as Error).message}`);
    process.exit(1);
  }

  // Track last pushed date for incremental sync
  const latestDate = entries.reduce(
    (latest, e) => (e.date > latest ? e.date : latest),
    entries[0]!.date,
  );
  updateLastPushDate(latestDate);

  console.log("");
  for (const result of response.results) {
    const verb = result.action === "updated" ? "Updated" : "Posted";
    console.log(`${verb} ${result.date}: ${result.post_url}?edit=1`);
  }
}
