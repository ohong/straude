import { createHash } from "node:crypto";
import { requireAuth } from "../lib/auth.js";
import { apiRequest } from "../lib/api.js";
import { runCcusage, runCcusageRaw } from "../lib/ccusage.js";
import type { CcusageDailyEntry } from "../lib/ccusage.js";
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

export async function pushCommand(options: PushOptions): Promise<void> {
  const config = requireAuth();
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

  // Get raw JSON for hashing
  let rawJson: string;
  try {
    rawJson = runCcusageRaw(sinceStr, untilStr);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  // Parse the data
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    console.error("Failed to parse ccusage output.");
    process.exit(1);
  }

  const data = parsed as { data?: CcusageDailyEntry[] };
  if (!data.data || data.data.length === 0) {
    console.log("No usage data found for the specified period.");
    return;
  }

  const entries = data.data;

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

  // Compute SHA-256 hash of raw JSON
  const hash = createHash("sha256").update(rawJson).digest("hex");

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

  console.log("");
  for (const result of response.results) {
    console.log(`Posted ${result.date}: ${result.post_url}`);
  }
}
