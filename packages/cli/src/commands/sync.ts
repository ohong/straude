import { loadConfig } from "../lib/auth.js";
import { loginCommand } from "./login.js";
import { pushCommand } from "./push.js";
import { runCcusageRaw, parseCcusageOutput } from "../lib/ccusage.js";
import { MAX_BACKFILL_DAYS } from "../config.js";

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

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function daysBetween(dateStrA: string, dateStrB: string): number {
  // Parse as local dates to avoid UTC/local timezone mismatch
  const [ay, am, ad] = dateStrA.split("-").map(Number);
  const [by, bm, bd] = dateStrB.split("-").map(Number);
  const a = new Date(ay!, am! - 1, ad!);
  const b = new Date(by!, bm! - 1, bd!);
  const msPerDay = 86_400_000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function printTodayStats(): void {
  const now = new Date();
  const compact = formatDateCompact(now);
  try {
    const raw = runCcusageRaw(compact, compact);
    const { data: entries } = parseCcusageOutput(raw);
    if (entries.length === 0) {
      console.log("No usage data for today.");
      return;
    }
    for (const entry of entries) {
      console.log(`  ${entry.date}:`);
      console.log(`    Cost: ${formatCost(entry.costUSD)}`);
      console.log(
        `    Tokens: ${formatTokens(entry.totalTokens)} (input: ${formatTokens(entry.inputTokens)}, output: ${formatTokens(entry.outputTokens)})`,
      );
      console.log(`    Models: ${entry.models.join(", ")}`);
    }
  } catch {
    // Non-fatal — stats preview is best-effort
  }
}

/**
 * Default command when `straude` is run with no arguments.
 * Authenticates if needed, then pushes new stats since last push.
 */
export async function syncCommand(apiUrlOverride?: string): Promise<void> {
  let config = loadConfig();

  // First time: run login flow
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

  const today = formatDate(new Date());

  // Determine how many days to push
  if (config.last_push_date) {
    if (config.last_push_date >= today) {
      // Show today's stats even though already synced
      printTodayStats();
      console.log("\nAlready synced today.");
      return;
    }

    const gap = daysBetween(config.last_push_date, today);
    // Push from day after last push to today, capped at backfill limit
    const daysToPush = Math.min(gap, MAX_BACKFILL_DAYS);

    await pushCommand({ days: daysToPush }, config);
  } else {
    // Never pushed before — push today only
    await pushCommand({}, config);
  }
}
