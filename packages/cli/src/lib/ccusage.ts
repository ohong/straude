import { execFileSync, execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import {
  normalizeTokenBuckets,
  summarizeNormalization,
  type NormalizationMeta,
  type NormalizationSummary,
  type TokenNormalizationConfidence,
  type TokenNormalizationMode,
} from "./token-normalization.js";
import { DEFAULT_SUBPROCESS_TIMEOUT_MS } from "../config.js";
import { isInteractive, promptYesNo } from "./prompt.js";
import { posthog } from "./posthog.js";
import { getDistinctId } from "./machine-id.js";
import type { StraudeConfig } from "./auth.js";

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

/** Check if a binary exists on PATH without spawning a subprocess. */
function isOnPath(binary: string): boolean {
  const dirs = (process.env.PATH || "").split(delimiter);
  const suffixes = process.platform === "win32" ? ["", ".cmd", ".exe"] : [""];
  return dirs.some((dir) =>
    suffixes.some((ext) => existsSync(join(dir, binary + ext))),
  );
}

/**
 * Resolve how to run ccusage.
 * For security reasons we only execute an explicitly installed `ccusage`
 * binary from PATH and do not auto-install/execute package-runner fallbacks.
 */
function resolveCcusageCommand(): { cmd: string; args: string[] } {
  if (_resolved) return _resolved;

  // Check if ccusage binary exists on PATH (pure fs, no subprocess)
  if (isOnPath("ccusage")) {
    _resolved = { cmd: "ccusage", args: [] };
    return _resolved;
  }

  throw new Error(
    "ccusage is not installed or not on PATH. Install it globally and retry (e.g. `npm install -g ccusage`).",
  );
}

/** Reset resolver cache — for testing only. */
export function _resetCcusageResolver(): void {
  _resolved = undefined;
}

/** Whether ccusage is currently resolvable on PATH. */
export function isCcusageInstalled(): boolean {
  return isOnPath("ccusage");
}

/**
 * Pick the right global-install command for ccusage. Pure: takes a snapshot of
 * environment state and returns the command/args to run. Extracted so the
 * decision logic is unit-testable without spawning processes or mocking PATH.
 */
export function pickInstallCommand(env: { hasBun: boolean }): { cmd: string; args: string[]; manager: "bun" | "npm" } {
  if (env.hasBun) {
    return { cmd: "bun", args: ["add", "-g", "ccusage"], manager: "bun" };
  }
  return { cmd: "npm", args: ["install", "-g", "ccusage"], manager: "npm" };
}

/**
 * Best-effort install of ccusage globally. Prefers `bun add -g` when bun is
 * present (faster, and Straude is bun-first), falls back to `npm install -g`.
 * stdio is inherited so the user sees install progress.
 */
function installCcusage(): void {
  const { cmd, args } = pickInstallCommand({ hasBun: isOnPath("bun") });
  execFileSync(cmd, args, {
    stdio: "inherit",
    timeout: 5 * 60 * 1000,
  });
}

/**
 * Make sure ccusage is installed and runnable. If missing and we're attached to
 * an interactive TTY, prompt to install. Non-TTY callers (auto-push, CI) get
 * the same throw as before so they can recover by installing manually.
 *
 * Pass `config` so PostHog events are attributed to the logged-in user when
 * possible; falls back to the machine UUID otherwise.
 */
export async function ensureCcusageInstalled(
  config: StraudeConfig | null = null,
): Promise<void> {
  if (isCcusageInstalled()) return;

  const distinctId = getDistinctId(config);

  if (!isInteractive()) {
    posthog.capture({
      distinctId,
      event: "ccusage_install_skipped",
      properties: { reason: "non_interactive" },
    });
    throw new Error(
      "ccusage is not installed or not on PATH. Install it globally and retry (e.g. `npm install -g ccusage`).",
    );
  }

  console.log("\nStraude needs `ccusage` to read your Claude Code usage.");
  const accepted = await promptYesNo(
    "Install ccusage globally now? [Y/n] ",
    true,
  );

  if (!accepted) {
    posthog.capture({
      distinctId,
      event: "ccusage_install_declined",
    });
    throw new Error(
      "ccusage is required. Install it manually with `npm install -g ccusage` and run straude again.",
    );
  }

  posthog.capture({
    distinctId,
    event: "ccusage_install_attempted",
    properties: { manager: pickInstallCommand({ hasBun: isOnPath("bun") }).manager },
  });

  try {
    installCcusage();
  } catch (err) {
    posthog.capture({
      distinctId,
      event: "ccusage_install_failed",
      properties: { error: (err as Error).message?.slice(0, 200) ?? "unknown" },
    });
    throw new Error(
      `Failed to install ccusage automatically: ${(err as Error).message}\n` +
        "Install it manually with `npm install -g ccusage` and run straude again.",
    );
  }

  // Reset resolver cache so the freshly installed binary is picked up.
  _resolved = undefined;

  if (!isCcusageInstalled()) {
    posthog.capture({
      distinctId,
      event: "ccusage_install_failed",
      properties: { error: "not_on_path_after_install" },
    });
    throw new Error(
      "ccusage installed but not found on PATH. You may need to open a new shell, then re-run straude.",
    );
  }

  posthog.capture({
    distinctId,
    event: "ccusage_install_succeeded",
  });
  console.log("ccusage installed successfully.\n");
}

/** Run ccusage via the resolved binary. */
function execCcusage(args: string[], timeoutMs?: number): string {
  const { cmd, args: prefix } = resolveCcusageCommand();
  const cmdArgs = [...prefix, ...args];

  try {
    return execFileSync(cmd, cmdArgs, {
      encoding: "utf-8",
      timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32",
    });
  } catch (err: unknown) {
    const error = err as ExecError;

    if (error.killed || error.signal === "SIGTERM") {
      const hint = `${cmd} ${[...prefix, "daily", "--json"].join(" ")}`;
      throw new Error(
        `ccusage timed out. Try running \`${hint}\` directly to verify it works.`,
      );
    }

    const detail = error.stderr?.trim() || error.message || "unknown error";
    throw new Error(`ccusage failed: ${detail}`);
  }
}

/** Async version of execCcusage — runs ccusage in a child process without blocking. */
function execCcusageAsync(args: string[], timeoutMs?: number): Promise<string> {
  const { cmd, args: prefix } = resolveCcusageCommand();
  const cmdArgs = [...prefix, ...args];

  return new Promise((resolve, reject) => {
    execFileCb(cmd, cmdArgs, {
      encoding: "utf-8",
      timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32",
    }, (err, stdout) => {
      if (!err) {
        resolve(stdout);
        return;
      }
      const error = err as ExecError;
      if (error.killed || error.signal === "SIGTERM") {
        const hint = `${cmd} ${[...prefix, "daily", "--json"].join(" ")}`;
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
  reasoningOutputTokens?: number;
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
  anomalies?: NormalizationAnomaly[];
  normalizationSummary?: NormalizationSummary;
}

export interface NormalizationAnomaly {
  date: string;
  source: "ccusage" | "codex";
  mode: TokenNormalizationMode;
  confidence: TokenNormalizationConfidence;
  consistencyError: number;
  warnings: string[];
}

/**
 * Runs `ccusage daily --json` for the given date range and returns parsed output.
 * Dates should be in YYYYMMDD format (no dashes) as ccusage expects.
 */
export function runCcusage(sinceDate: string, untilDate: string, timeoutMs?: number): CcusageOutput {
  const args = ["daily", "--json", "--breakdown", "--since", sinceDate, "--until", untilDate];
  return parseCcusageOutput(execCcusage(args, timeoutMs));
}

/** Returns the raw JSON string from ccusage (for hashing). */
export function runCcusageRaw(sinceDate: string, untilDate: string, timeoutMs?: number): string {
  const args = ["daily", "--json", "--breakdown", "--since", sinceDate, "--until", untilDate];
  return execCcusage(args, timeoutMs);
}

/** Async version — returns raw JSON string without blocking the event loop. */
export function runCcusageRawAsync(sinceDate: string, untilDate: string, timeoutMs?: number): Promise<string> {
  const args = ["daily", "--json", "--breakdown", "--since", sinceDate, "--until", untilDate];
  return execCcusageAsync(args, timeoutMs);
}

/** Normalize a v18 entry into our canonical format. */
function normalizeEntry(raw: CcusageV18Entry): { entry: CcusageDailyEntry; meta: NormalizationMeta } {
  const normalized = normalizeTokenBuckets(
    {
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
      cacheCreationTokens: raw.cacheCreationTokens,
      cacheReadTokens: raw.cacheReadTokens,
      totalTokens: raw.totalTokens,
    },
    { source: "ccusage", cacheSemantics: "separate" },
  );

  return {
    entry: {
      date: raw.date,
      models: raw.modelsUsed,
      inputTokens: normalized.normalized.inputTokens,
      outputTokens: normalized.normalized.outputTokens,
      cacheCreationTokens: normalized.normalized.cacheCreationTokens,
      cacheReadTokens: normalized.normalized.cacheReadTokens,
      totalTokens: normalized.normalized.totalTokens,
      costUSD: raw.totalCost,
      reasoningOutputTokens: normalized.normalized.reasoningOutputTokens,
      modelBreakdown: raw.modelBreakdowns?.map((b) => ({ model: b.modelName, cost_usd: b.cost })),
    },
    meta: normalized.meta,
  };
}

export function parseCcusageOutput(raw: string): CcusageOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error("Failed to parse ccusage output as JSON", { cause: err });
  }

  // ccusage returns `[]` when there's no data for the period
  if (Array.isArray(parsed) && (parsed as unknown[]).length === 0) {
    return { data: [] };
  }

  const v18 = parsed as CcusageV18Output;
  if (!Array.isArray(v18.daily)) {
    throw new Error("Unexpected ccusage output format (expected 'daily' array)");
  }

  const normalizedRows = v18.daily.map(normalizeEntry);
  const data = normalizedRows.map((row) => row.entry);

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

  const anomalies: NormalizationAnomaly[] = normalizedRows
    .filter((row) => row.meta.mode === "unresolved" || row.meta.confidence !== "high" || row.meta.warnings.length > 0)
    .map((row) => ({
      date: row.entry.date,
      source: "ccusage",
      mode: row.meta.mode,
      confidence: row.meta.confidence,
      consistencyError: row.meta.consistencyError,
      warnings: row.meta.warnings,
    }));

  return {
    data,
    anomalies,
    normalizationSummary: summarizeNormalization(normalizedRows.map((row) => row.meta)),
  };
}
