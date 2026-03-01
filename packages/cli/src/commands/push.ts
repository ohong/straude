import { createHash } from "node:crypto";
import { requireAuth, updateLastPushDate } from "../lib/auth.js";
import type { StraudeConfig } from "../lib/auth.js";
import { apiRequest } from "../lib/api.js";
import { runCcusageRawAsync, parseCcusageOutput } from "../lib/ccusage.js";
import type { CcusageDailyEntry, ModelBreakdownEntry } from "../lib/ccusage.js";
import { runCodexRawAsync, parseCodexOutput } from "../lib/codex.js";
import { MAX_BACKFILL_DAYS } from "../config.js";

interface UsageSubmitRequest {
  entries: Array<{
    date: string;
    data: CcusageDailyEntry;
  }>;
  hash?: string;
  source: "cli" | "web";
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
 * Merge Claude and Codex daily entries by date.
 * Sums tokens/costs, unions models, builds model_breakdown.
 */
export function mergeEntries(
  claudeEntries: CcusageDailyEntry[],
  codexEntries: CcusageDailyEntry[],
): CcusageDailyEntry[] {
  const byDate = new Map<string, { claude?: CcusageDailyEntry; codex?: CcusageDailyEntry }>();

  for (const e of claudeEntries) {
    byDate.set(e.date, { ...byDate.get(e.date), claude: e });
  }
  for (const e of codexEntries) {
    byDate.set(e.date, { ...byDate.get(e.date), codex: e });
  }

  const merged: CcusageDailyEntry[] = [];

  for (const [date, { claude, codex }] of byDate) {
    const claudeBreakdown = claude ? buildBreakdown(claude) : [];
    const codexBreakdown = codex ? buildBreakdown(codex) : [];
    const modelBreakdown = [...claudeBreakdown, ...codexBreakdown];

    merged.push({
      date,
      models: [
        ...(claude?.models ?? []),
        ...(codex?.models ?? []),
      ],
      inputTokens: (claude?.inputTokens ?? 0) + (codex?.inputTokens ?? 0),
      outputTokens: (claude?.outputTokens ?? 0) + (codex?.outputTokens ?? 0),
      cacheCreationTokens: (claude?.cacheCreationTokens ?? 0) + (codex?.cacheCreationTokens ?? 0),
      cacheReadTokens: (claude?.cacheReadTokens ?? 0) + (codex?.cacheReadTokens ?? 0),
      totalTokens: (claude?.totalTokens ?? 0) + (codex?.totalTokens ?? 0),
      costUSD: (claude?.costUSD ?? 0) + (codex?.costUSD ?? 0),
      modelBreakdown: modelBreakdown.length > 0 ? modelBreakdown : undefined,
    });
  }

  // Sort by date ascending
  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged;
}

export async function pushCommand(options: PushOptions, configOverride?: StraudeConfig): Promise<void> {
  const config = configOverride ?? requireAuth();
  const today = new Date();

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
  } else {
    sinceDate = today;
    untilDate = today;
  }

  const sinceStr = formatDateCompact(sinceDate);
  const untilStr = formatDateCompact(untilDate);

  console.log(
    sinceDate.getTime() === untilDate.getTime()
      ? `Pushing usage for ${formatDate(sinceDate)}...`
      : `Pushing usage for ${formatDate(sinceDate)} to ${formatDate(untilDate)}...`,
  );

  // Run ccusage + codex in parallel — the single biggest perf win
  const [claudeResult, codexRaw] = await Promise.all([
    runCcusageRawAsync(sinceStr, untilStr).catch((err: Error) => err),
    runCodexRawAsync(sinceStr, untilStr),
  ]);

  // Claude data is required — fail if it errored
  if (claudeResult instanceof Error) {
    console.error(claudeResult.message);
    process.exit(1);
  }
  const claudeRaw: string = claudeResult;

  let claudeEntries: CcusageDailyEntry[];
  try {
    claudeEntries = parseCcusageOutput(claudeRaw).data;
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  // Codex data — silent on failure (empty string = failed or no data)
  const codexEntries = codexRaw ? parseCodexOutput(codexRaw).data : [];

  // Merge Claude + Codex entries by date
  const entries = mergeEntries(claudeEntries, codexEntries);

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

  // Compute SHA-256 hash of concatenated raw JSONs
  const hashInput = codexRaw ? claudeRaw + codexRaw : claudeRaw;
  const hash = createHash("sha256").update(hashInput).digest("hex");

  const body: UsageSubmitRequest = {
    entries: entries.map((entry) => ({
      date: entry.date,
      data: entry,
    })),
    hash,
    source: "cli",
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
