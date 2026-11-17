import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { CONFIG_DIR } from "../config.js";
import { assertCalendarDate } from "./calendar.js";
import { syncAccountKey } from "./sync-account.js";
import type { StraudeConfig } from "./auth.js";

export const WORKSPACE_SOURCE_FILE = join(CONFIG_DIR, "workspace.json");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Deliberately independent of credentials: logging in must never undo privacy. */
export interface WorkspaceSource {
  version: 1;
  workspace_id: string;
  installation_id: string;
  previous_device_id?: string;
  account_key: string;
  api_url: string;
  source_id?: string;
  start_date?: string;
}

export function loadWorkspaceSource(path = WORKSPACE_SOURCE_FILE): WorkspaceSource | null {
  if (!existsSync(path)) return null;
  try {
    const value: WorkspaceSource = JSON.parse(readFileSync(path, "utf8"));
    if (!value || value.version !== 1 || !UUID.test(value.workspace_id)
      || !UUID.test(value.installation_id)
      || (value.previous_device_id !== undefined && (!UUID.test(value.previous_device_id) || value.previous_device_id === value.installation_id)) || !/^[a-f0-9]{64}$/.test(value.account_key)
      || typeof value.api_url !== "string" || !["http:", "https:"].includes(new URL(value.api_url).protocol)
      || (value.source_id !== undefined && !UUID.test(value.source_id))
      || ((value.source_id === undefined) !== (value.start_date === undefined))) throw new Error();
    if (value.start_date !== undefined) assertCalendarDate(value.start_date);
    return value;
  } catch (error) {
    // Keep this file in place, including across subsequent attempts. Renaming a
    // corrupt privacy marker would turn the next invocation into a public sync.
    throw new Error(`Private workspace routing could not be read (${path}). Restore this file before syncing; no usage was collected or shared.`, { cause: error });
  }
}

/** Call while holding the shared sync lease. */
export function saveWorkspaceSource(source: WorkspaceSource, path = WORKSPACE_SOURCE_FILE): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeFileSync(fd, JSON.stringify(source, null, 2) + "\n", "utf8");
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, path);
    try {
      const directory = openSync(dirname(path), "r");
      try { fsyncSync(directory); } finally { closeSync(directory); }
    } catch {
      // Directory fsync is unavailable on some platforms.
    }
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function assertWorkspaceAccount(source: WorkspaceSource, config: StraudeConfig): void {
  if (source.account_key !== syncAccountKey(config) || source.api_url !== config.api_url) {
    throw new Error("This installation is assigned to a private workspace under another account or server. Sign in with the original account and server; use a separate OS account for other usage. Private routing remains enabled.");
  }
}
