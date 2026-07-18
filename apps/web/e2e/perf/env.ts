import { readFileSync } from "node:fs";
import path from "node:path";

// Playwright does not load Next's .env.local — parse it directly so the
// harness uses the same Supabase project as the server under test.
export function loadWebEnv(): Record<string, string> {
  const file = path.join(__dirname, "..", "..", ".env.local");
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (!m) continue;
    const value = m[2].trim();
    env[m[1]] = value.replace(/^(['"])(.*)\1$/, "$2");
  }
  return env;
}

export const AUTH_STATE_PATH = path.join(__dirname, ".auth", "storage-state.json");
export const TARGETS_PATH = path.join(__dirname, ".auth", "targets.json");
export const RESULTS_DIR = path.join(__dirname, "..", "..", "perf-results");
