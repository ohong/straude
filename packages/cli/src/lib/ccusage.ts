import { execFileSync } from "node:child_process";

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

export interface CcusageOutput {
  type: "daily";
  data: CcusageDailyEntry[];
  summary: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheCreationTokens: number;
    totalCacheReadTokens: number;
    totalTokens: number;
    totalCostUSD: number;
  };
}

/**
 * Runs `ccusage daily --json` for the given date range and returns parsed output.
 * Dates should be in YYYYMMDD format (no dashes) as ccusage expects.
 */
export function runCcusage(sinceDate: string, untilDate: string): CcusageOutput {
  const args = ["daily", "--json", "--since", sinceDate, "--until", untilDate];

  let stdout: string;
  try {
    stdout = execFileSync("ccusage", args, {
      encoding: "utf-8",
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err: unknown) {
    const error = err as { status?: number; stderr?: string };
    if (error.status === 127 || (error.stderr && error.stderr.includes("not found"))) {
      throw new Error(
        "ccusage is not installed. Install it with: npm i -g ccusage",
      );
    }
    throw new Error(
      `ccusage failed: ${error.stderr ?? "unknown error"}`,
    );
  }

  return parseCcusageOutput(stdout);
}

export function parseCcusageOutput(raw: string): CcusageOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse ccusage output as JSON");
  }

  const output = parsed as CcusageOutput;
  if (output.type !== "daily" || !Array.isArray(output.data)) {
    throw new Error("Unexpected ccusage output format");
  }

  for (const entry of output.data) {
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

  return output;
}

/**
 * Returns the raw JSON string from ccusage (for hashing).
 */
export function runCcusageRaw(sinceDate: string, untilDate: string): string {
  const args = ["daily", "--json", "--since", sinceDate, "--until", untilDate];

  try {
    return execFileSync("ccusage", args, {
      encoding: "utf-8",
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err: unknown) {
    const error = err as { status?: number; stderr?: string };
    if (error.status === 127 || (error.stderr && error.stderr.includes("not found"))) {
      throw new Error(
        "ccusage is not installed. Install it with: npm i -g ccusage",
      );
    }
    throw new Error(
      `ccusage failed: ${error.stderr ?? "unknown error"}`,
    );
  }
}
