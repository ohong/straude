import { execFileSync } from "node:child_process";
import type { CcusageDailyEntry } from "./ccusage.js";

/** Per-model cost entry for breakdown tracking. */
export interface ModelBreakdownEntry {
  model: string;
  cost_usd: number;
}

export interface CodexOutput {
  data: CcusageDailyEntry[];
}

const CODEX_PKG = "@ccusage/codex@latest";

/**
 * Run `@ccusage/codex daily --json` for the given date range.
 * Always uses bunx/npx — never a global binary (name conflicts with Codex CLI).
 * Returns empty data on any failure — never blocks a push.
 */
export function runCodex(sinceDate: string, untilDate: string): CodexOutput {
  try {
    const raw = execCodex(["daily", "--json", "--since", sinceDate, "--until", untilDate]);
    return parseCodexOutput(raw);
  } catch {
    // Silent fallback — Codex data is optional
    return { data: [] };
  }
}

/** Returns the raw JSON string from @ccusage/codex (for hashing). Empty string on failure. */
export function runCodexRaw(sinceDate: string, untilDate: string): string {
  try {
    return execCodex(["daily", "--json", "--since", sinceDate, "--until", untilDate]);
  } catch {
    return "";
  }
}

function execCodex(args: string[]): string {
  const cmd = process.versions.bun !== undefined ? "bunx" : "npx";
  const prefix = process.versions.bun !== undefined ? ["--bun"] : ["--yes"];

  return execFileSync(cmd, [...prefix, CODEX_PKG, ...args], {
    encoding: "utf-8",
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

/**
 * Raw shape returned by @ccusage/codex (`daily --json`).
 * Mirrors ccusage v18 format.
 */
interface CodexDailyEntry {
  date: string;
  modelsUsed: string[];
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalTokens: number;
  totalCost: number;
}

interface CodexDailyOutput {
  daily: CodexDailyEntry[];
}

export function parseCodexOutput(raw: string): CodexOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: [] };
  }

  // Empty array = no data
  if (Array.isArray(parsed) && (parsed as unknown[]).length === 0) {
    return { data: [] };
  }

  const output = parsed as CodexDailyOutput;
  if (!output.daily || !Array.isArray(output.daily)) {
    return { data: [] };
  }

  const data: CcusageDailyEntry[] = output.daily
    .filter((e) => e.date && typeof e.totalCost === "number" && e.totalCost >= 0)
    .map((e) => ({
      date: e.date,
      models: e.modelsUsed ?? [],
      inputTokens: e.inputTokens ?? 0,
      outputTokens: e.outputTokens ?? 0,
      cacheCreationTokens: e.cacheCreationTokens ?? 0,
      cacheReadTokens: e.cacheReadTokens ?? 0,
      totalTokens: e.totalTokens ?? 0,
      costUSD: e.totalCost,
    }));

  return { data };
}
