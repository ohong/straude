import { execFile as execFileCb } from "node:child_process";
import { chmodSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { DEFAULT_SUBPROCESS_TIMEOUT_MS } from "../config.js";

export const CCUSAGE_MIN_VERSION = "20.0.5";
export const CCUSAGE_CLAUDE_COLLECTOR = "ccusage-claude-v20" as const;
export const CCUSAGE_CODEX_COLLECTOR = "ccusage-codex-v20" as const;
export const CCUSAGE_PRICING_MODE = "online" as const;

const SUPPORTED_AGENTS = ["claude", "codex"] as const;
const MAX_CCUSAGE_BUFFER = 20 * 1024 * 1024;
const MISSING_PRICING_RE = /(missing|unavailable|unknown|could not fetch|failed to fetch).{0,80}(pricing|price|cost)|pricing.{0,80}(missing|unavailable|unknown)|cost excludes/i;

export type CcusageAgent = typeof SUPPORTED_AGENTS[number];

/** Type-safe representation of the error surfaced by execFile. */
interface ExecError extends Error {
  code?: string;
  status?: number | null;
  stderr?: string | Buffer;
  stdout?: string | Buffer;
  signal?: string | null;
  killed?: boolean;
}

interface ExecResult {
  stdout: string;
  stderr: string;
}

interface ResolvedCcusageCommand {
  cmd: string;
  args: string[];
  version: string;
}

let resolvedCommand: ResolvedCcusageCommand | undefined;
let forcedCommandForTests: ResolvedCcusageCommand | undefined;

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

export interface CcusageCollectorMeta {
  claude?: typeof CCUSAGE_CLAUDE_COLLECTOR;
  codex?: typeof CCUSAGE_CODEX_COLLECTOR;
  ccusage_version: string;
  ccusage_agents: CcusageAgent[];
  pricing_mode: typeof CCUSAGE_PRICING_MODE;
}

export interface CcusageOutput {
  data: CcusageDailyEntry[];
  summary: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalReasoningOutputTokens: number;
    totalCacheCreationTokens: number;
    totalCacheReadTokens: number;
    totalTokens: number;
    totalCostUSD: number;
  };
  agents: CcusageAgent[];
  collector: CcusageCollectorMeta;
  version: string;
  raw: string;
  stderr: string;
}

interface ParseOptions {
  version?: string;
  stderr?: string;
}

interface CcusageRawEntry {
  period?: unknown;
  date?: unknown;
  modelsUsed?: unknown;
  modelBreakdowns?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  cacheCreationTokens?: unknown;
  cacheReadTokens?: unknown;
  totalTokens?: unknown;
  totalCost?: unknown;
  costUSD?: unknown;
  metadata?: unknown;
}

interface CcusageRawModelBreakdown {
  modelName?: unknown;
  model?: unknown;
  cost?: unknown;
  cost_usd?: unknown;
}

function packageNameForPlatform(platform = process.platform, arch = process.arch): string | undefined {
  if (platform === "darwin") {
    if (arch === "arm64") return "@ccusage/ccusage-darwin-arm64";
    if (arch === "x64") return "@ccusage/ccusage-darwin-x64";
  }
  if (platform === "linux") {
    if (arch === "arm64") return "@ccusage/ccusage-linux-arm64";
    if (arch === "x64") return "@ccusage/ccusage-linux-x64";
  }
  if (platform === "win32") {
    if (arch === "arm64") return "@ccusage/ccusage-win32-arm64";
    if (arch === "x64") return "@ccusage/ccusage-win32-x64";
  }
  return undefined;
}

function binaryRelativePath(platform = process.platform): string {
  return platform === "win32" ? "bin/ccusage.exe" : "bin/ccusage";
}

function ensureExecutable(path: string): void {
  if (process.platform === "win32") return;
  try {
    const mode = statSync(path).mode;
    if ((mode & 0o111) !== 0) return;
    chmodSync(path, mode | 0o755);
  } catch {
    // Let execFile surface the actionable failure.
  }
}

function resolveInstalledCcusageCommand(): ResolvedCcusageCommand {
  if (forcedCommandForTests) return forcedCommandForTests;
  if (resolvedCommand) return resolvedCommand;

  const projectRequire = createRequire(import.meta.url);
  let ccusagePackageJson: string;
  let version = "unknown";
  try {
    ccusagePackageJson = projectRequire.resolve("ccusage/package.json");
    const packageJson = JSON.parse(readFileSync(ccusagePackageJson, "utf8")) as { version?: string };
    if (typeof packageJson.version === "string") version = packageJson.version;
  } catch {
    throw new Error(
      "Installed ccusage dependency is missing. Reinstall Straude dependencies and retry.",
    );
  }

  const nativePackage = packageNameForPlatform();
  if (!nativePackage) {
    throw new Error(
      `ccusage native binary is not available for ${process.platform}-${process.arch}.`,
    );
  }

  const ccusageRequire = createRequire(ccusagePackageJson);
  let binaryPath: string;
  try {
    binaryPath = ccusageRequire.resolve(`${nativePackage}/${binaryRelativePath()}`);
  } catch {
    throw new Error(
      `Installed ccusage native binary is missing for ${process.platform}-${process.arch}. Reinstall Straude so optional ccusage dependencies are installed.`,
    );
  }

  ensureExecutable(binaryPath);
  resolvedCommand = { cmd: binaryPath, args: [], version };
  return resolvedCommand;
}

/** Reset resolver cache — for testing only. */
export function _resetCcusageResolver(): void {
  resolvedCommand = undefined;
  forcedCommandForTests = undefined;
}

/** Override resolver — for testing only. */
export function _setCcusageCommandForTests(command: { cmd: string; args: string[]; version?: string }): void {
  forcedCommandForTests = { ...command, version: command.version ?? CCUSAGE_MIN_VERSION };
  resolvedCommand = undefined;
}

function compareSemver(a: string, b: string): number {
  const left = a.split(".").map((part) => Number(part));
  const right = b.split(".").map((part) => Number(part));
  for (let i = 0; i < 3; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function assertSupportedVersion(version: string): void {
  if (compareSemver(version, CCUSAGE_MIN_VERSION) < 0) {
    throw new Error(
      `ccusage ${version} is unsupported. Straude requires ccusage >=${CCUSAGE_MIN_VERSION} for accurate Codex accounting.`,
    );
  }
}

function stringifyBuffer(value: unknown): string {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return typeof value === "string" ? value : "";
}

function formatCommand(args: string[]): string {
  const { cmd, args: prefix } = resolveInstalledCcusageCommand();
  return [cmd, ...prefix, ...args].join(" ");
}

function execCcusageAsync(args: string[], timeoutMs?: number): Promise<ExecResult> {
  const { cmd, args: prefix } = resolveInstalledCcusageCommand();
  const cmdArgs = [...prefix, ...args];

  return new Promise((resolve, reject) => {
    execFileCb(cmd, cmdArgs, {
      encoding: "utf-8",
      timeout: timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS,
      maxBuffer: MAX_CCUSAGE_BUFFER,
      shell: false,
    }, (err, stdout, stderr) => {
      if (!err) {
        resolve({ stdout, stderr });
        return;
      }
      const error = err as ExecError;
      if (error.killed || error.signal === "SIGTERM") {
        reject(new Error(
          `ccusage timed out. Try running \`${formatCommand(["daily", "--json"])}\` directly to verify it works.`,
        ));
        return;
      }
      const detail = stderr.trim()
        || stringifyBuffer(error.stderr).trim()
        || stringifyBuffer(error.stdout).trim()
        || error.message
        || "unknown error";
      reject(new Error(`ccusage failed: ${detail}`));
    });
  });
}

function rejectMissingPricing(stderr: string): void {
  if (MISSING_PRICING_RE.test(stderr)) {
    throw new Error(
      `ccusage did not produce fully priced online cost data: ${stderr.trim()}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown, field: string, date: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ccusage row for ${date}: ${field} must be a finite number.`);
  }
  if (value < 0) {
    throw new Error(`Invalid ccusage row for ${date}: ${field} must be non-negative.`);
  }
  return value;
}

function asStringArray(value: unknown, field: string, date: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ccusage row for ${date}: ${field} must be an array.`);
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function parseAgents(row: CcusageRawEntry, date: string): CcusageAgent[] {
  if (!isRecord(row.metadata) || !Array.isArray(row.metadata.agents)) {
    throw new Error(`Invalid ccusage row for ${date}: metadata.agents is required.`);
  }

  const rawAgents = row.metadata.agents;
  if (rawAgents.length === 0 || rawAgents.some((agent) => typeof agent !== "string")) {
    throw new Error(`Invalid ccusage row for ${date}: metadata.agents must contain agent names.`);
  }

  const unsupported = rawAgents.filter((agent): agent is string =>
    typeof agent === "string" && !SUPPORTED_AGENTS.includes(agent as CcusageAgent),
  );
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported ccusage agents detected for ${date}: ${[...new Set(unsupported)].join(", ")}. Straude currently supports Claude Code and Codex only.`,
    );
  }

  return [...new Set(rawAgents as CcusageAgent[])].sort((a, b) =>
    SUPPORTED_AGENTS.indexOf(a) - SUPPORTED_AGENTS.indexOf(b),
  );
}

function parseModelBreakdown(value: unknown, date: string): ModelBreakdownEntry[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ccusage row for ${date}: modelBreakdowns must be an array.`);
  }

  const breakdown = value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Invalid ccusage row for ${date}: modelBreakdowns[${index}] must be an object.`);
    }
    const raw = item as CcusageRawModelBreakdown;
    const model = raw.modelName ?? raw.model;
    if (typeof model !== "string" || model.length === 0) {
      throw new Error(`Invalid ccusage row for ${date}: modelBreakdowns[${index}].modelName is required.`);
    }
    const cost = asFiniteNumber(raw.cost ?? raw.cost_usd, `modelBreakdowns[${index}].cost`, date);
    return { model, cost_usd: cost };
  });

  return breakdown.length > 0 ? breakdown : undefined;
}

function normalizeRawDaily(raw: unknown): CcusageRawEntry[] {
  if (Array.isArray(raw)) return raw as CcusageRawEntry[];
  if (isRecord(raw) && Array.isArray(raw.daily)) return raw.daily as CcusageRawEntry[];
  throw new Error("Unexpected ccusage output format: expected a JSON object with a daily array.");
}

function collectorForAgents(agents: CcusageAgent[], version: string): CcusageCollectorMeta {
  const collector: CcusageCollectorMeta = {
    ccusage_version: version,
    ccusage_agents: agents,
    pricing_mode: CCUSAGE_PRICING_MODE,
  };
  if (agents.includes("claude")) collector.claude = CCUSAGE_CLAUDE_COLLECTOR;
  if (agents.includes("codex")) collector.codex = CCUSAGE_CODEX_COLLECTOR;
  return collector;
}

function summarizeEntries(entries: CcusageDailyEntry[]): CcusageOutput["summary"] {
  return entries.reduce<CcusageOutput["summary"]>((summary, entry) => {
    summary.totalInputTokens += entry.inputTokens;
    summary.totalOutputTokens += entry.outputTokens;
    summary.totalReasoningOutputTokens += entry.reasoningOutputTokens ?? 0;
    summary.totalCacheCreationTokens += entry.cacheCreationTokens;
    summary.totalCacheReadTokens += entry.cacheReadTokens;
    summary.totalTokens += entry.totalTokens;
    summary.totalCostUSD += entry.costUSD;
    return summary;
  }, {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalReasoningOutputTokens: 0,
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
    totalTokens: 0,
    totalCostUSD: 0,
  });
}

export function parseCcusageOutput(raw: string, options: ParseOptions = {}): CcusageOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ccusage output as JSON: ${(err as Error).message}`);
  }

  const rawRows = normalizeRawDaily(parsed);
  const seenAgents = new Set<CcusageAgent>();
  const data = rawRows.map((row, index) => {
    if (!isRecord(row)) {
      throw new Error(`Invalid ccusage row at index ${index}: expected an object.`);
    }

    const date = row.period ?? row.date;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid ccusage row at index ${index}: period must be YYYY-MM-DD.`);
    }

    const rowAgents = parseAgents(row, date);
    rowAgents.forEach((agent) => seenAgents.add(agent));

    const inputTokens = asFiniteNumber(row.inputTokens, "inputTokens", date);
    const outputTokens = asFiniteNumber(row.outputTokens, "outputTokens", date);
    const cacheCreationTokens = asFiniteNumber(row.cacheCreationTokens, "cacheCreationTokens", date);
    const cacheReadTokens = asFiniteNumber(row.cacheReadTokens, "cacheReadTokens", date);
    const totalTokens = asFiniteNumber(row.totalTokens, "totalTokens", date);
    const costUSD = asFiniteNumber(row.totalCost ?? row.costUSD, "totalCost", date);
    const modelBreakdown = parseModelBreakdown(row.modelBreakdowns, date);
    const models = asStringArray(row.modelsUsed, "modelsUsed", date);

    if (costUSD > 0 && (!modelBreakdown || modelBreakdown.length === 0)) {
      throw new Error(`Invalid ccusage row for ${date}: priced rows must include modelBreakdowns.`);
    }

    const modelNames = new Set<string>(models);
    for (const breakdown of modelBreakdown ?? []) modelNames.add(breakdown.model);
    const reasoningOutputTokens = Math.max(
      totalTokens - inputTokens - outputTokens - cacheCreationTokens - cacheReadTokens,
      0,
    );

    return {
      date,
      models: [...modelNames],
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      costUSD,
      reasoningOutputTokens,
      modelBreakdown,
    };
  });

  data.sort((a, b) => a.date.localeCompare(b.date));

  const agents = [...seenAgents].sort((a, b) =>
    SUPPORTED_AGENTS.indexOf(a) - SUPPORTED_AGENTS.indexOf(b),
  );
  const version = options.version ?? "unknown";

  return {
    data,
    summary: summarizeEntries(data),
    agents,
    collector: collectorForAgents(agents, version),
    version,
    raw,
    stderr: options.stderr ?? "",
  };
}

export async function collectCcusageUsageAsync(
  sinceDate: string,
  untilDate: string,
  timeoutMs?: number,
): Promise<CcusageOutput> {
  const { version } = resolveInstalledCcusageCommand();
  assertSupportedVersion(version);

  const result = await execCcusageAsync(
    ["daily", "--json", "--since", sinceDate, "--until", untilDate, "--no-offline"],
    timeoutMs,
  );
  rejectMissingPricing(result.stderr);

  return parseCcusageOutput(result.stdout, {
    version,
    stderr: result.stderr,
  });
}
