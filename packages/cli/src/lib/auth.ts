import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { CONFIG_DIR, CONFIG_FILE, DEFAULT_API_URL } from "../config.js";

const CONFIG_LOCK_FILE = `${CONFIG_FILE}.lock`;
const CONFIG_LOCK_TIMEOUT_MS = 2_000;
const CONFIG_LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MS = 25;

export interface AutoPushConfig {
  enabled: boolean;
  time: string; // "HH:MM"
  scheduler: "launchd" | "cron";
  mechanism?: "scheduler" | "hooks"; // defaults to "scheduler" for existing configs
}

export interface StraudeConfig {
  token: string;
  username: string;
  api_url: string;
  last_push_date?: string;
  ccusage_v20_migration_completed_at?: string;
  usage_protocol_v2_migration_completed_at?: string;
  previous_device_id_migrated_at?: string;
  codex_native_repair_completed_at?: string;
  // Set after the one-time 30-day backfill that re-collects Codex sessions with
  // the last_token_usage accounting fix. Distinct from the older repair flag
  // because users who already ran that repair can still have inflated rows.
  codex_native_last_token_usage_repair_completed_at?: string;
  device_id?: string;
  device_name?: string;
  auto_push?: AutoPushConfig;
}

export class ConfigCorruptError extends Error {
  readonly preservedPath?: string;

  constructor(message: string, options?: ErrorOptions & { preservedPath?: string }) {
    super(
      `Straude config is corrupt (${CONFIG_FILE}): ${message}. ` +
        (options?.preservedPath
          ? `The original was preserved at ${options.preservedPath}.`
          : "Move the file aside and run `straude login` again."),
      options,
    );
    this.name = "ConfigCorruptError";
    this.preservedPath = options?.preservedPath;
  }
}

function parseConfig(raw: string): StraudeConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ConfigCorruptError("invalid JSON", { cause: error });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigCorruptError("expected a JSON object");
  }
  const value = parsed as Record<string, unknown>;
  if (typeof value.token !== "string" || value.token.length === 0) {
    throw new ConfigCorruptError("missing authentication token");
  }

  return {
    token: value.token,
    username: typeof value.username === "string" ? value.username : "",
    api_url: typeof value.api_url === "string" ? value.api_url : DEFAULT_API_URL,
    last_push_date: typeof value.last_push_date === "string" ? value.last_push_date : undefined,
    ccusage_v20_migration_completed_at:
      typeof value.ccusage_v20_migration_completed_at === "string"
        ? value.ccusage_v20_migration_completed_at
        : undefined,
    usage_protocol_v2_migration_completed_at:
      typeof value.usage_protocol_v2_migration_completed_at === "string"
        ? value.usage_protocol_v2_migration_completed_at
        : undefined,
    previous_device_id_migrated_at:
      typeof value.previous_device_id_migrated_at === "string"
        ? value.previous_device_id_migrated_at
        : undefined,
    codex_native_repair_completed_at:
      typeof value.codex_native_repair_completed_at === "string"
        ? value.codex_native_repair_completed_at
        : undefined,
    codex_native_last_token_usage_repair_completed_at:
      typeof value.codex_native_last_token_usage_repair_completed_at === "string"
        ? value.codex_native_last_token_usage_repair_completed_at
        : undefined,
    device_id: typeof value.device_id === "string" ? value.device_id : undefined,
    device_name: typeof value.device_name === "string" ? value.device_name : undefined,
    auto_push: value.auto_push as AutoPushConfig | undefined,
  };
}

export function loadConfig(): StraudeConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;
  let raw: string;
  try {
    raw = readFileSync(CONFIG_FILE, "utf-8");
  } catch (error) {
    throw new ConfigCorruptError("could not be read", { cause: error });
  }
  try {
    return parseConfig(raw);
  } catch (error) {
    if (!(error instanceof ConfigCorruptError)) throw error;
    const suffix = new Date().toISOString().replaceAll(/[:.]/g, "-");
    const preservedPath = `${CONFIG_FILE}.corrupt-${suffix}`;
    try {
      renameSync(CONFIG_FILE, preservedPath);
    } catch (preserveError) {
      throw new ConfigCorruptError(
        "invalid content and the original could not be preserved",
        { cause: preserveError },
      );
    }
    throw new ConfigCorruptError("invalid content", {
      cause: error,
      preservedPath,
    });
  }
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireConfigLock(): number {
  ensureConfigDir();
  const deadline = Date.now() + CONFIG_LOCK_TIMEOUT_MS;
  while (true) {
    try {
      return openSync(CONFIG_LOCK_FILE, "wx", 0o600);
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code !== "EEXIST") throw error;

      try {
        if (Date.now() - statSync(CONFIG_LOCK_FILE).mtimeMs > CONFIG_LOCK_STALE_MS) {
          unlinkSync(CONFIG_LOCK_FILE);
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== "ENOENT") throw statError;
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error("Another Straude process is updating the config. Please retry.");
      }
      sleepSync(LOCK_RETRY_MS);
    }
  }
}

function atomicWriteConfig(config: StraudeConfig): void {
  ensureConfigDir();
  const temporary = `${CONFIG_FILE}.${process.pid}.${randomUUID()}.tmp`;
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeFileSync(fd, JSON.stringify(config, null, 2) + "\n", "utf-8");
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, CONFIG_FILE);
    chmodSync(CONFIG_FILE, 0o600);
    try {
      const directory = openSync(CONFIG_DIR, "r");
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
    } catch {
      // Windows and some filesystems do not support fsync on directories.
    }
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Preserve the original write error.
      }
    }
    try {
      unlinkSync(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // The destination rename already succeeded or the original error is
        // more useful than a temporary-file cleanup failure.
      }
    }
  }
}

function withConfigLock<T>(operation: () => T): T {
  const lockFd = acquireConfigLock();
  try {
    return operation();
  } finally {
    closeSync(lockFd);
    try {
      unlinkSync(CONFIG_LOCK_FILE);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export function saveConfig(config: StraudeConfig): void {
  withConfigLock(() => atomicWriteConfig(config));
}

export function updateConfig(
  updater: (current: StraudeConfig | null) => StraudeConfig,
): StraudeConfig {
  return withConfigLock(() => {
    const current = loadConfig();
    const next = updater(current);
    atomicWriteConfig(next);
    return next;
  });
}

export function updateLastPushDate(date: string): void {
  updateConfig((config) => {
    if (!config) {
      throw new Error("Cannot update the last push date before authentication.");
    }
    return { ...config, last_push_date: date };
  });
}

export function requireAuth(): StraudeConfig {
  const config = loadConfig();
  if (!config) {
    console.error("Not logged in. Run `npx straude@latest login` first.");
    process.exit(1);
  }
  return config;
}
