import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { CONFIG_DIR } from "../config.js";

const MACHINE_ID_FILE = join(CONFIG_DIR, "machine_id");

let cached: string | null = null;

/**
 * Returns a stable, anonymous per-machine UUID stored at ~/.straude/machine_id.
 * Used as the PostHog distinct_id for users who haven't run `straude login`,
 * so anonymous CLI events aren't all collapsed into a single distinct_id.
 */
export function getMachineId(): string {
  if (cached) return cached;
  try {
    if (existsSync(MACHINE_ID_FILE)) {
      const id = readFileSync(MACHINE_ID_FILE, "utf-8").trim();
      if (id) {
        cached = id;
        return id;
      }
    }
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    const id = randomUUID();
    writeFileSync(MACHINE_ID_FILE, id, { encoding: "utf-8", mode: 0o600 });
    cached = id;
    return id;
  } catch {
    // If we can't read/write the file, fall back to a process-local UUID.
    // Worse for analytics (every invocation looks like a new user) but never
    // breaks the CLI for users with read-only home directories.
    const id = randomUUID();
    cached = id;
    return id;
  }
}

/**
 * PostHog distinct_id for an event. Falls back to the machine UUID when the
 * user hasn't logged in yet.
 */
export function getDistinctId(config: { username?: string } | null): string {
  return config?.username || getMachineId();
}
