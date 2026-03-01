import { execFileSync, execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

/** Type-safe representation of the error thrown by execFileSync / execFile. */
interface ExecError extends Error {
  code?: string;
  status?: number | null;
  stderr?: string;
  signal?: string | null;
  killed?: boolean;
}

/** Resolved ccusage command. Cached after first resolution. */
let _resolved: { cmd: string; args: string[] } | undefined;

// Pin to v17 — ccusage v18 uses the `runtime:` protocol in its dependencies,
// which npm doesn't support (EUNSUPPORTEDPROTOCOL). Safe to unpin once ccusage
// drops `runtime:` or npm adds support for it.
const CCUSAGE_PKG = "ccusage@17";

/** Check if a binary exists on PATH without spawning a subprocess. */
function isOnPath(binary: string): boolean {
  const dirs = (process.env.PATH || "").split(delimiter);
  return dirs.some((dir) => existsSync(join(dir, binary)));
}

/**
 * Resolve the fastest available way to run ccusage.
 * 1. Direct `ccusage` binary on PATH (globally installed) — fastest
 * 2. `bunx` if running under Bun — no subprocess needed to detect
 * 3. `npx` fallback
 */
function resolveCcusageCommand(): { cmd: string; args: string[] } {
  if (_resolved) return _resolved;

  // 1. Check if ccusage binary exists on PATH (pure fs, no subprocess)
  if (isOnPath("ccusage")) {
    _resolved = { cmd: "ccusage", args: [] };
    return _resolved;
  }

  // 2. Prefer bunx if running under Bun
  if (process.versions.bun !== undefined) {
    _resolved = { cmd: "bunx", args: ["--bun"] };
  } else {
    // 3. Fallback to npx
    _resolved = { cmd: "npx", args: ["--yes"] };
  }

  console.error(
    "Tip: Install ccusage globally for faster syncs: bun add -g ccusage",
  );

  return _resolved;
}

/** Reset resolver cache — for testing only. */
export function _resetCcusageResolver(): void {
  _resolved = undefined;
}

/** Run ccusage via the resolved binary. */
function execCcusage(args: string[]): string {
  const { cmd, args: prefix } = resolveCcusageCommand();
  // When running via bunx/npx, pin the version to avoid ccusage@18+ runtime: protocol issue
  const pkg = cmd === "ccusage" ? null : CCUSAGE_PKG;
  const cmdArgs = pkg ? [...prefix, pkg, ...args] : args;

  try {
    return execFileSync(cmd, cmdArgs, {
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err: unknown) {
    const error = err as ExecError;

    if (error.killed || error.signal === "SIGTERM") {
      const hint = pkg
        ? `${cmd} ${prefix.join(" ")} ${pkg} daily --json`
        : "ccusage daily --json";
      throw new Error(
        `ccusage timed out. Try running \`${hint}\` directly to verify it works.`,
      );
    }

    const detail = error.stderr?.trim() || error.message || "unknown error";
    throw new Error(`ccusage failed: ${detail}`);
  }
}

/** Async version of execCcusage — runs ccusage in a child process without blocking. */
function execCcusageAsync(args: string[]): Promise<string> {
  const { cmd, args: prefix } = resolveCcusageCommand();
  const pkg = cmd === "ccusage" ? null : CCUSAGE_PKG;
  const cmdArgs = pkg ? [...prefix, pkg, ...args] : args;

  return new Promise((resolve, reject) => {
    execFileCb(cmd, cmdArgs, {
      encoding: "utf-8",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    }, (err, stdout) => {
      if (!err) {
        resolve(stdout);
        return;
      }
      const error = err as ExecError;
      if (error.killed || error.signal === "SIGTERM") {
        const hint = pkg
          ? `${cmd} ${prefix.join(" ")} ${pkg} daily --json`
          : "ccusage daily --json";
        reject(new Error(
          `ccusage timed out. Try running \`${hint}\` directly to verify it works.`,
        ));
        return;
      }
      const detail = error.stderr?.trim() || error.message || "unknown error";
      reject(new Error(`ccusage failed: ${detail}`));
    });
  });
}

/** Per-model cost entry for breakdown tracking. */
export interface ModelBreakdownEntry {
  model: string;
  cost_usd: number;
}

/** Normalized entry used throughout the CLI and sent to the API. */
export interface CcusageDailyEntry {
  date: string;
  models: string[];
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUSD: number;
  modelBreakdown?: ModelBreakdownEntry[];
}

/** Raw shape returned by ccusage v18+ (`ccusage daily --json`). */
interface CcusageV18Entry {
  date: string;
  modelsUsed: string[];
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelBreakdowns?: Array<{ modelName: string; cost: number }>;
}

interface CcusageV18Output {
  daily: CcusageV18Entry[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
    totalCost: number;
  };
}

export interface CcusageOutput {
  data: CcusageDailyEntry[];
}

/**
 * Runs `ccusage daily --json` for the given date range and returns parsed output.
 * Dates should be in YYYYMMDD format (no dashes) as ccusage expects.
 */
export function runCcusage(sinceDate: string, untilDate: string): CcusageOutput {
  const args = ["daily", "--json", "--breakdown", "--since", sinceDate, "--until", untilDate];
  return parseCcusageOutput(execCcusage(args));
}

/** Returns the raw JSON string from ccusage (for hashing). */
export function runCcusageRaw(sinceDate: string, untilDate: string): string {
  const args = ["daily", "--json", "--breakdown", "--since", sinceDate, "--until", untilDate];
  return execCcusage(args);
}

/** Async version — returns raw JSON string without blocking the event loop. */
export function runCcusageRawAsync(sinceDate: string, untilDate: string): Promise<string> {
  const args = ["daily", "--json", "--breakdown", "--since", sinceDate, "--until", untilDate];
  return execCcusageAsync(args);
}

/** Normalize a v18 entry into our canonical format. */
function normalizeEntry(raw: CcusageV18Entry): CcusageDailyEntry {
  return {
    date: raw.date,
    models: raw.modelsUsed,
    inputTokens: raw.inputTokens,
    outputTokens: raw.outputTokens,
    cacheCreationTokens: raw.cacheCreationTokens,
    cacheReadTokens: raw.cacheReadTokens,
    totalTokens: raw.totalTokens,
    costUSD: raw.totalCost,
    modelBreakdown: raw.modelBreakdowns?.map((b) => ({ model: b.modelName, cost_usd: b.cost })),
  };
}

export function parseCcusageOutput(raw: string): CcusageOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse ccusage output as JSON");
  }

  // ccusage returns `[]` when there's no data for the period
  if (Array.isArray(parsed) && (parsed as unknown[]).length === 0) {
    return { data: [] };
  }

  const v18 = parsed as CcusageV18Output;
  if (!Array.isArray(v18.daily)) {
    throw new Error("Unexpected ccusage output format (expected 'daily' array)");
  }

  const data = v18.daily.map(normalizeEntry);

  for (const entry of data) {
    if (!entry.date || typeof entry.costUSD !== "number") {
      throw new Error(`Invalid entry in ccusage output for date: ${entry.date}`);
    }
    if (entry.costUSD < 0) {
      throw new Error(`Negative cost for date: ${entry.date}`);
    }
    if (entry.totalTokens < 0 || entry.inputTokens < 0 || entry.outputTokens < 0) {
      throw new Error(`Negative token count for date: ${entry.date}`);
    }
  }

  return { data };
}
