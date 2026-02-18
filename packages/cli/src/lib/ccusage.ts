import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Attempt to locate the `ccusage` binary.  `execFileSync` does **not** use a
 * shell, so it only sees the PATH inherited by the current Node process.  When
 * the user installed ccusage via nvm / volta / fnm / Homebrew the binary may
 * live in a directory that was added to PATH in their shell profile but is not
 * present in the Node process's PATH.
 *
 * We first try to find it on PATH (the common case).  If that fails we probe a
 * handful of well-known global-bin directories and return the first match.
 */
function resolveCcusageBin(): string {
  // Fast-path: if it's on PATH, `which` will find it.
  try {
    const resolved = execFileSync("which", ["ccusage"], {
      encoding: "utf-8",
      timeout: 5_000,
    }).trim();
    if (resolved) return resolved;
  } catch {
    // not on PATH — fall through to manual probing
  }

  const home = homedir();
  const candidates = [
    // npm global (default prefix)
    join(home, ".npm-global", "bin", "ccusage"),
    // npm global (Linux/macOS default without prefix config)
    "/usr/local/bin/ccusage",
    // Homebrew on Apple Silicon
    "/opt/homebrew/bin/ccusage",
    // Homebrew on Intel Mac
    "/usr/local/Cellar/../bin/ccusage",
    // volta
    join(home, ".volta", "bin", "ccusage"),
    // bun global
    join(home, ".bun", "bin", "ccusage"),
    // pnpm global
    join(home, ".local", "share", "pnpm", "ccusage"),
  ];

  // Also probe nvm directories — the active version varies per user
  const nvmDir = process.env.NVM_DIR || join(home, ".nvm");
  try {
    const versions = join(nvmDir, "versions", "node");
    // We can't easily know which version is "current" outside a shell, so
    // just check if any installed version has ccusage.
    for (const v of readdirSync(versions)) {
      candidates.push(join(versions, v, "bin", "ccusage"));
    }
  } catch {
    // nvm not installed or no versions — skip
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return "ccusage"; // fall back to bare name; will produce ENOENT
}

/** Cached resolved binary path — computed once per process. */
let _ccusageBin: string | undefined;
function getCcusageBin(): string {
  if (_ccusageBin === undefined) {
    _ccusageBin = resolveCcusageBin();
  }
  return _ccusageBin;
}

/** Reset the cached binary (for tests). */
export function _resetCcusageBinCache(): void {
  _ccusageBin = undefined;
}

/** Type-safe representation of the error thrown by execFileSync. */
interface ExecError extends Error {
  code?: string;       // e.g. "ENOENT", "ETIMEDOUT", "EACCES"
  status?: number | null;
  stderr?: string;
  signal?: string | null;
  killed?: boolean;     // true when the process was killed due to timeout
}

/** Check whether an exec error indicates the binary was not found. */
function isNotFoundError(err: ExecError): boolean {
  if (err.code === "ENOENT") return true;
  if (err.status === 127) return true;
  if (err.stderr && err.stderr.includes("not found")) return true;
  if (err.message && err.message.includes("ENOENT")) return true;
  return false;
}

/** Collect diagnostic metadata for error messages. */
function diagnosticContext(err: ExecError): string {
  const parts: string[] = [];
  const bin = _ccusageBin ?? "ccusage";
  parts.push(`binary: ${bin}`);
  if (err.code) parts.push(`code: ${err.code}`);
  if (err.status != null) parts.push(`exit: ${err.status}`);
  if (err.signal) parts.push(`signal: ${err.signal}`);
  if (err.killed) parts.push("killed: true");
  return parts.join(", ");
}

/** Build a descriptive error message from an exec error. */
function describeExecError(err: ExecError): string {
  const diag = diagnosticContext(err);

  if (err.killed || err.signal === "SIGTERM") {
    return (
      "ccusage timed out (took longer than 60 s).\n" +
      "Try running `ccusage daily --json` directly to verify it works.\n" +
      `[${diag}]`
    );
  }
  if (err.code === "EACCES") {
    return (
      "ccusage was found but is not executable.\n" +
      "Fix with: chmod +x $(which ccusage)\n" +
      `[${diag}]`
    );
  }

  // Prefer stderr, then the error message, then generic fallback
  const detail = err.stderr?.trim() || err.message || "unknown error";
  return `ccusage failed: ${detail}\n[${diag}]`;
}

function notInstalledMessage(): string {
  const bin = _ccusageBin ?? "ccusage";
  const pathSnippet = (process.env.PATH ?? "").split(":").slice(0, 5).join(":");
  return (
    "ccusage is not installed or not found on your PATH.\n" +
    "Install it with: npm i -g ccusage\n" +
    "If already installed, make sure it's on your PATH:\n" +
    "  which ccusage\n" +
    `[resolved: ${bin}, PATH (first 5): ${pathSnippet || "(empty)"}]`
  );
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
  const args = ["daily", "--json", "--since", sinceDate, "--until", untilDate];

  let stdout: string;
  try {
    stdout = execFileSync(getCcusageBin(), args, {
      encoding: "utf-8",
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err: unknown) {
    const error = err as ExecError;
    if (isNotFoundError(error)) {
      throw new Error(notInstalledMessage());
    }
    throw new Error(describeExecError(error));
  }

  return parseCcusageOutput(stdout);
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

/**
 * Returns the raw JSON string from ccusage (for hashing).
 */
export function runCcusageRaw(sinceDate: string, untilDate: string): string {
  const args = ["daily", "--json", "--since", sinceDate, "--until", untilDate];

  try {
    return execFileSync(getCcusageBin(), args, {
      encoding: "utf-8",
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err: unknown) {
    const error = err as ExecError;
    if (isNotFoundError(error)) {
      throw new Error(notInstalledMessage());
    }
    throw new Error(describeExecError(error));
  }
}
