import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "../config.js";

export const FIRST_RUN_MARKER_FILENAME = ".first-run";
export const FIRST_RUN_MARKER = join(CONFIG_DIR, FIRST_RUN_MARKER_FILENAME);

function markerPath(configDir: string): string {
  return join(configDir, FIRST_RUN_MARKER_FILENAME);
}

export function isFirstRun(configDir: string = CONFIG_DIR): boolean {
  return !existsSync(markerPath(configDir));
}

export function markFirstRun(configDir: string = CONFIG_DIR): void {
  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true, mode: 0o700 });
    }
    writeFileSync(markerPath(configDir), new Date().toISOString() + "\n", {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch {
    // Read-only home directory: skip marker write. Means we may re-fire
    // cli_first_run on every invocation for this machine — annoying but never
    // breaks the CLI.
  }
}
