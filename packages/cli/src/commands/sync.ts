import { loadConfig } from "../lib/auth.js";
import { loginCommand } from "./login.js";
import { pushCommand } from "./push.js";
import { MAX_BACKFILL_DAYS } from "../config.js";

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
      console.log("Already synced today.");
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
