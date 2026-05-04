import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "../config.js";

export const FIRST_RUN_MARKER = join(CONFIG_DIR, ".first-run");

export function isFirstRun(): boolean {
  return !existsSync(FIRST_RUN_MARKER);
}

export function markFirstRun(): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    writeFileSync(FIRST_RUN_MARKER, new Date().toISOString() + "\n", {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch {
    // Read-only home directory: skip marker write. Means we may re-fire
    // cli_first_run on every invocation for this machine — annoying but never
    // breaks the CLI.
  }
}
