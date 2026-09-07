import { readFileSync } from "node:fs";
import path from "node:path";

// Playwright does not load Next's .env.local — parse it directly so the
// harness uses the same Supabase project as the server under test.
const WEB_ENV_FILE = path.join(__dirname, "..", "..", ".env.local");

export function parseEnvFile(raw: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const value = match[2].trim();
    env[match[1]] = value.replace(/^(['"])(.*)\1$/, "$2");
  }
  return env;
}

type LoadWebEnvOptions = {
  envFilePath?: string;
  processEnv?: NodeJS.ProcessEnv;
};

export function loadWebEnv({
  envFilePath = WEB_ENV_FILE,
  processEnv = process.env,
}: LoadWebEnvOptions = {}): Record<string, string> {
  let fileEnv: Record<string, string> = {};
  try {
    fileEnv = parseEnvFile(readFileSync(envFilePath, "utf8"));
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const runtimeEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(processEnv)) {
    if (value !== undefined) runtimeEnv[key] = value;
  }
  return { ...fileEnv, ...runtimeEnv };
}

export function assertPerfSupabaseUrl(
  supabaseUrl: string | undefined,
  allowRemote: string | undefined
): void {
  if (!supabaseUrl?.trim()) {
    throw new Error("Perf auth requires NEXT_PUBLIC_SUPABASE_URL.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("Perf auth requires NEXT_PUBLIC_SUPABASE_URL to be a valid http or https URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Perf auth requires NEXT_PUBLIC_SUPABASE_URL to use http or https.");
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isLoopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1";
  if (!isLoopback && allowRemote?.trim() !== "1") {
    throw new Error(
      "Refusing perf auth against a remote Supabase URL. Set PERF_ALLOW_REMOTE=1 for an intentional remote run."
    );
  }
}

export const AUTH_STATE_PATH = path.join(__dirname, ".auth", "storage-state.json");
export const TARGETS_PATH = path.join(__dirname, ".auth", "targets.json");
export const RESULTS_DIR = path.join(__dirname, "..", "..", "perf-results");
