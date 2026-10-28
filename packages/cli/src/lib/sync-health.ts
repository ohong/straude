import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { CONFIG_DIR } from "../config.js";
import type { StraudeConfig } from "./auth.js";
import { syncAccountKey } from "./sync-account.js";

const HEALTH_FILE = join(CONFIG_DIR, "sync-health.json");

interface SyncHealth {
  account_key: string;
  last_success_at?: string;
  auth_required_at?: string;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function readSyncHealth(config: StraudeConfig): SyncHealth | null {
  try {
    const value: unknown = JSON.parse(readFileSync(HEALTH_FILE, "utf8"));
    if (!value || typeof value !== "object") return null;
    const health = value as Record<string, unknown>;
    if (health.account_key !== syncAccountKey(config)) return null;
    return {
      account_key: health.account_key as string,
      ...(isTimestamp(health.last_success_at) ? { last_success_at: health.last_success_at } : {}),
      ...(isTimestamp(health.auth_required_at) ? { auth_required_at: health.auth_required_at } : {}),
    };
  } catch {
    // Diagnostic state must not prevent syncing or recovery.
    return null;
  }
}

/** Call under the sync lease. Never persist credentials, payloads, or error text. */
export function recordSyncHealth(config: StraudeConfig, outcome: "success" | "auth_required"): void {
  const temporary = `${HEALTH_FILE}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const previous = readSyncHealth(config);
    const now = new Date().toISOString();
    const health: SyncHealth = outcome === "success"
      ? { account_key: syncAccountKey(config), last_success_at: now }
      : {
          account_key: syncAccountKey(config),
          ...(previous?.last_success_at ? { last_success_at: previous.last_success_at } : {}),
          auth_required_at: now,
        };
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(temporary, JSON.stringify(health) + "\n", { mode: 0o600 });
    renameSync(temporary, HEALTH_FILE);
  } catch {
    // An advisory write cannot turn an accepted submission into a failed sync.
  } finally {
    try { unlinkSync(temporary); } catch { /* Rename normally removes it. */ }
  }
}
