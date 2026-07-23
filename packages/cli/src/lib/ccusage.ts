import { execFile as execFileCb } from "node:child_process";
import { chmodSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { DEFAULT_SUBPROCESS_TIMEOUT_MS } from "../config.js";

export const CCUSAGE_MIN_VERSION = "20.0.18";
export const CCUSAGE_CLAUDE_COLLECTOR = "ccusage-claude-v20" as const;
export const CCUSAGE_CODEX_COLLECTOR = "ccusage-codex-v20" as const;
export const CCUSAGE_DEFAULT_PRICING_MODE = "online" as const;

export type CcusagePricingMode = "offline" | "online";

const MAX_CCUSAGE_BUFFER = 20 * 1024 * 1024;
const MODEL_COST_TOLERANCE_USD = 0.005;
const PRICING_RECOVERY_BUDGET_MS = 60_000;
const PRICING_RETRY_DELAYS_MS = [1_000, 3_000] as const;
const MISSING_PRICING_RE = /(missing|unavailable|unknown|could not fetch|failed to fetch).{0,80}(pricing|price|cost)|pricing.{0,80}(missing|unavailable|unknown)|cost excludes/i;
const EMBEDDED_PRICING_FALLBACK_RE = /failed to (?:fetch|parse) litellm pricing.*using embedded pricing/i;

export type CcusageAgent = string;

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
  inputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  cost_usd: number;
}

export interface CcusageAgentEntry {
  agent: CcusageAgent;
  models: string[];
  inputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUSD: number;
  modelBreakdown: ModelBreakdownEntry[];
}

/** Normalized entry used throughout the CLI and sent to the API. */
export interface CcusageDailyEntry {
  date: string;
  agents: CcusageAgent[];
  agentBreakdown: CcusageAgentEntry[];
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
  pricing_mode: CcusagePricingMode;
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
  pricingRetryCount?: number;
}

interface ParseOptions {
  version?: string;
  stderr?: string;
  pricingMode?: CcusagePricingMode;
}

interface CollectOptions {
  pricingMode?: CcusagePricingMode;
  timezone?: string;
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  pricingRecoveryBudgetMs?: number;
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
  agents?: unknown;
}

interface CcusageRawModelBreakdown {
  modelName?: unknown;
  model?: unknown;
  cost?: unknown;
  cost_usd?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  reasoningOutputTokens?: unknown;
  cacheCreationTokens?: unknown;
  cacheReadTokens?: unknown;
  totalTokens?: unknown;
  missingPricing?: unknown;
}

interface CcusageRawAgent {
  agent?: unknown;
  modelsUsed?: unknown;
  modelBreakdowns?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  cacheCreationTokens?: unknown;
  cacheReadTokens?: unknown;
  totalTokens?: unknown;
  totalCost?: unknown;
}

export class PricingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingUnavailableError";
  }
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

interface StableSemver {
  major: number;
  minor: number;
  patch: number;
}

function parseStableSemver(version: string): StableSemver | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
    .exec(version);
  if (!match) return undefined;
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  if (
    major === undefined
    || minor === undefined
    || patch === undefined
    || !Number.isSafeInteger(major)
    || !Number.isSafeInteger(minor)
    || !Number.isSafeInteger(patch)
  ) {
    return undefined;
  }
  return { major, minor, patch };
}

function compareSemver(a: StableSemver, b: StableSemver): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function assertSupportedCcusageVersion(version: string): void {
  const parsed = parseStableSemver(version);
  const minimum = parseStableSemver(CCUSAGE_MIN_VERSION);
  if (
    !parsed
    || !minimum
    || compareSemver(parsed, minimum) < 0
  ) {
    throw new Error(
      `ccusage ${version} is unsupported. Straude requires a stable ccusage version >=${CCUSAGE_MIN_VERSION}. Reinstall Straude and retry.`,
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
      env: {
        ...process.env,
        LOG_LEVEL: "4",
      },
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

function hasMissingPricingWarning(stderr: string): boolean {
  return MISSING_PRICING_RE.test(stderr);
}

function rejectMissingPricing(stderr: string, pricingMode: CcusagePricingMode): void {
  if (hasMissingPricingWarning(stderr) || EMBEDDED_PRICING_FALLBACK_RE.test(stderr)) {
    throw new PricingUnavailableError(
      `ccusage did not produce fully priced ${pricingMode} cost data: ${stderr.trim()}`,
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
  const strings = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (strings.length !== value.length || new Set(strings).size !== strings.length) {
    throw new Error(`Invalid ccusage row for ${date}: ${field} must contain unique non-empty strings.`);
  }
  return strings;
}

function parseAgents(row: CcusageRawEntry, date: string): CcusageAgent[] {
  if (!isRecord(row.metadata) || !Array.isArray(row.metadata.agents)) {
    throw new Error(`Invalid ccusage row for ${date}: metadata.agents is required.`);
  }

  const rawAgents = row.metadata.agents;
  if (rawAgents.length === 0 || rawAgents.some((agent) => typeof agent !== "string")) {
    throw new Error(`Invalid ccusage row for ${date}: metadata.agents must contain agent names.`);
  }
  if (new Set(rawAgents).size !== rawAgents.length) {
    throw new Error(`Invalid ccusage row for ${date}: metadata.agents contains duplicate agents.`);
  }

  return [...rawAgents].sort();
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
    if (raw.missingPricing === true) {
      throw new PricingUnavailableError(
        `ccusage did not produce live pricing for ${model} on ${date}.`,
      );
    }
    const inputTokens = asFiniteNumber(
      raw.inputTokens ?? 0,
      `modelBreakdowns[${index}].inputTokens`,
      date,
    );
    const outputTokens = asFiniteNumber(
      raw.outputTokens ?? 0,
      `modelBreakdowns[${index}].outputTokens`,
      date,
    );
    const cacheCreationTokens = asFiniteNumber(
      raw.cacheCreationTokens ?? 0,
      `modelBreakdowns[${index}].cacheCreationTokens`,
      date,
    );
    const cacheReadTokens = asFiniteNumber(
      raw.cacheReadTokens ?? 0,
      `modelBreakdowns[${index}].cacheReadTokens`,
      date,
    );
    const baseTokens = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;
    const totalTokens = asFiniteNumber(
      raw.totalTokens ?? baseTokens,
      `modelBreakdowns[${index}].totalTokens`,
      date,
    );
    if (totalTokens < baseTokens) {
      throw new Error(
        `Invalid ccusage row for ${date}: modelBreakdowns[${index}].totalTokens is below its token categories.`,
      );
    }
    const reasoningOutputTokens = raw.reasoningOutputTokens == null
      ? totalTokens - baseTokens
      : asFiniteNumber(
        raw.reasoningOutputTokens,
        `modelBreakdowns[${index}].reasoningOutputTokens`,
        date,
      );
    if (baseTokens + reasoningOutputTokens !== totalTokens) {
      throw new Error(
        `Invalid ccusage row for ${date}: modelBreakdowns[${index}] token categories do not equal totalTokens.`,
      );
    }
    return {
      model,
      inputTokens,
      outputTokens,
      reasoningOutputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      cost_usd: cost,
    };
  });

  const models = breakdown.map((item) => item.model);
  if (new Set(models).size !== models.length) {
    throw new Error(`Invalid ccusage row for ${date}: modelBreakdowns contains duplicate models.`);
  }
  return breakdown.length > 0 ? breakdown : undefined;
}

function assertTokenTotal(
  values: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
  },
  date: string,
  field: string,
): number {
  const base = values.inputTokens
    + values.outputTokens
    + values.cacheCreationTokens
    + values.cacheReadTokens;
  if (values.totalTokens < base) {
    throw new Error(`Invalid ccusage row for ${date}: ${field}.totalTokens is below its token categories.`);
  }
  return values.totalTokens - base;
}

function assertCostMatches(
  expected: number,
  breakdown: ModelBreakdownEntry[],
  date: string,
  field: string,
): void {
  const breakdownCost = breakdown.reduce((sum, model) => sum + model.cost_usd, 0);
  if (Math.abs(expected - breakdownCost) > MODEL_COST_TOLERANCE_USD) {
    throw new Error(
      `Invalid ccusage row for ${date}: ${field} cost differs from its model breakdown by more than $${MODEL_COST_TOLERANCE_USD.toFixed(3)}.`,
    );
  }
}

function allocateReasoningTokens(
  breakdown: ModelBreakdownEntry[],
  reasoningTokens: number,
): ModelBreakdownEntry[] {
  // ccusage v20 includes per-agent reasoning in totalTokens but omits its
  // private per-model extra_total_tokens field from JSON. Preserve the exact
  // agent total by apportioning that known residual by model output volume.
  const alreadyAllocated = breakdown.reduce(
    (sum, model) => sum + model.reasoningOutputTokens,
    0,
  );
  const residual = reasoningTokens - alreadyAllocated;
  if (residual < 0) {
    throw new Error("Model reasoning tokens exceed the enclosing agent total.");
  }
  if (residual === 0 || breakdown.length === 0) return breakdown;

  const weights = breakdown.map((model) => (
    model.outputTokens > 0 ? model.outputTokens : Math.max(model.totalTokens, 1)
  ));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const allocations = weights.map((weight) => Math.floor((residual * weight) / weightTotal));
  let remainder = residual - allocations.reduce((sum, value) => sum + value, 0);
  const ranked = weights
    .map((weight, index) => ({
      index,
      remainder: (residual * weight) % weightTotal,
    }))
    .sort((left, right) => (
      right.remainder - left.remainder
      || breakdown[left.index]!.model.localeCompare(breakdown[right.index]!.model)
    ));
  for (const candidate of ranked) {
    if (remainder === 0) break;
    allocations[candidate.index]! += 1;
    remainder -= 1;
  }

  return breakdown.map((model, index) => {
    const added = allocations[index]!;
    return {
      ...model,
      reasoningOutputTokens: model.reasoningOutputTokens + added,
      totalTokens: model.totalTokens + added,
    };
  });
}

function parseAgentBreakdown(value: unknown, date: string): CcusageAgentEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid ccusage row for ${date}: agents breakdown is required; run ccusage with --by-agent.`);
  }

  const agents = value.map((item, index): CcusageAgentEntry => {
    if (!isRecord(item)) {
      throw new Error(`Invalid ccusage row for ${date}: agents[${index}] must be an object.`);
    }
    const raw = item as CcusageRawAgent;
    if (typeof raw.agent !== "string" || raw.agent.length === 0) {
      throw new Error(`Invalid ccusage row for ${date}: agents[${index}].agent is required.`);
    }
    const inputTokens = asFiniteNumber(raw.inputTokens, `agents[${index}].inputTokens`, date);
    const outputTokens = asFiniteNumber(raw.outputTokens, `agents[${index}].outputTokens`, date);
    const cacheCreationTokens = asFiniteNumber(
      raw.cacheCreationTokens,
      `agents[${index}].cacheCreationTokens`,
      date,
    );
    const cacheReadTokens = asFiniteNumber(
      raw.cacheReadTokens,
      `agents[${index}].cacheReadTokens`,
      date,
    );
    const totalTokens = asFiniteNumber(raw.totalTokens, `agents[${index}].totalTokens`, date);
    const costUSD = asFiniteNumber(raw.totalCost, `agents[${index}].totalCost`, date);
    const parsedModelBreakdown = parseModelBreakdown(raw.modelBreakdowns, date) ?? [];
    const tokensRequirePaidPricing = raw.agent === "claude" || raw.agent === "codex";
    if (tokensRequirePaidPricing && totalTokens > 0 && costUSD === 0) {
      throw new PricingUnavailableError(
        `ccusage did not provide pricing for ${raw.agent} usage on ${date}.`,
      );
    }
    if (tokensRequirePaidPricing && totalTokens > 0 && parsedModelBreakdown.length === 0) {
      throw new PricingUnavailableError(
        `ccusage did not provide model pricing for ${raw.agent} usage on ${date}.`,
      );
    }
    if (costUSD > 0 && parsedModelBreakdown.length === 0) {
      throw new Error(`Invalid ccusage row for ${date}: agents[${index}] priced usage requires modelBreakdowns.`);
    }
    const reasoningOutputTokens = assertTokenTotal({
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
    }, date, `agents[${index}]`);
    assertCostMatches(costUSD, parsedModelBreakdown, date, `agents[${index}]`);
    const modelBreakdown = allocateReasoningTokens(
      parsedModelBreakdown,
      reasoningOutputTokens,
    );
    for (const model of modelBreakdown) {
      if (tokensRequirePaidPricing && model.totalTokens > 0 && model.cost_usd === 0) {
        throw new PricingUnavailableError(
          `ccusage did not provide pricing for ${raw.agent} model ${model.model} on ${date}.`,
        );
      }
    }

    const models = asStringArray(raw.modelsUsed, `agents[${index}].modelsUsed`, date);
    const allModels = new Set(models);
    for (const model of modelBreakdown) allModels.add(model.model);
    return {
      agent: raw.agent,
      models: [...allModels].sort(),
      inputTokens,
      outputTokens,
      reasoningOutputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      costUSD,
      modelBreakdown,
    };
  });

  const names = agents.map((agent) => agent.agent);
  if (new Set(names).size !== names.length) {
    throw new Error(`Invalid ccusage row for ${date}: agents breakdown contains duplicate agents.`);
  }
  return agents.sort((a, b) => a.agent.localeCompare(b.agent));
}

function normalizeRawDaily(raw: unknown): CcusageRawEntry[] {
  if (Array.isArray(raw)) return raw as CcusageRawEntry[];
  if (isRecord(raw) && Array.isArray(raw.daily)) return raw.daily as CcusageRawEntry[];
  throw new Error("Unexpected ccusage output format: expected a JSON object with a daily array.");
}

function collectorForAgents(
  agents: CcusageAgent[],
  version: string,
  pricingMode: CcusagePricingMode,
): CcusageCollectorMeta {
  const collector: CcusageCollectorMeta = {
    ccusage_version: version,
    ccusage_agents: agents,
    pricing_mode: pricingMode,
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
  const data = rawRows.flatMap((row, index) => {
    if (!isRecord(row)) {
      throw new Error(`Invalid ccusage row at index ${index}: expected an object.`);
    }

    const date = row.period ?? row.date;
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid ccusage row at index ${index}: period must be YYYY-MM-DD.`);
    }

    const rowAgents = parseAgents(row, date);
    rowAgents.forEach((agent) => seenAgents.add(agent));
    const agentBreakdown = parseAgentBreakdown(row.agents, date);
    const breakdownNames = agentBreakdown.map((agent) => agent.agent);
    if (
      rowAgents.length !== breakdownNames.length
      || rowAgents.some((agent) => !breakdownNames.includes(agent))
    ) {
      throw new Error(`Invalid ccusage row for ${date}: metadata.agents does not match agents breakdown.`);
    }

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
    const reasoningOutputTokens = assertTokenTotal({
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
    }, date, "daily");
    assertCostMatches(costUSD, modelBreakdown ?? [], date, "daily");

    const agentTotals = agentBreakdown.reduce((totals, agent) => ({
      inputTokens: totals.inputTokens + agent.inputTokens,
      outputTokens: totals.outputTokens + agent.outputTokens,
      reasoningOutputTokens: totals.reasoningOutputTokens + agent.reasoningOutputTokens,
      cacheCreationTokens: totals.cacheCreationTokens + agent.cacheCreationTokens,
      cacheReadTokens: totals.cacheReadTokens + agent.cacheReadTokens,
      totalTokens: totals.totalTokens + agent.totalTokens,
      costUSD: totals.costUSD + agent.costUSD,
    }), {
      inputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 0,
      costUSD: 0,
    });
    if (
      agentTotals.inputTokens !== inputTokens
      || agentTotals.outputTokens !== outputTokens
      || agentTotals.reasoningOutputTokens !== reasoningOutputTokens
      || agentTotals.cacheCreationTokens !== cacheCreationTokens
      || agentTotals.cacheReadTokens !== cacheReadTokens
      || agentTotals.totalTokens !== totalTokens
      || Math.abs(agentTotals.costUSD - costUSD) > MODEL_COST_TOLERANCE_USD
    ) {
      throw new Error(`Invalid ccusage row for ${date}: agents breakdown does not match daily totals.`);
    }

    const modelNames = new Set<string>(models);
    for (const breakdown of modelBreakdown ?? []) modelNames.add(breakdown.model);
    return [{
      date,
      agents: rowAgents,
      agentBreakdown,
      models: [...modelNames],
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      totalTokens,
      costUSD,
      reasoningOutputTokens,
      modelBreakdown,
    }];
  });

  data.sort((a, b) => a.date.localeCompare(b.date));
  for (let index = 1; index < data.length; index += 1) {
    if (data[index - 1]!.date === data[index]!.date) {
      throw new Error(`Invalid ccusage output: duplicate date ${data[index]!.date}.`);
    }
  }

  const agents = [...seenAgents].sort();
  const version = options.version ?? "unknown";
  const pricingMode = options.pricingMode ?? CCUSAGE_DEFAULT_PRICING_MODE;

  return {
    data,
    summary: summarizeEntries(data),
    agents,
    collector: collectorForAgents(agents, version, pricingMode),
    version,
    raw,
    stderr: options.stderr ?? "",
  };
}

function argsForPricingMode(
  sinceDate: string,
  untilDate: string,
  pricingMode: CcusagePricingMode,
  timezone: string,
): string[] {
  return [
    "daily",
    "--json",
    "--since",
    sinceDate,
    "--until",
    untilDate,
    "--timezone",
    timezone,
    "--by-agent",
    pricingMode === "offline" ? "--offline" : "--no-offline",
  ];
}

export function resolveLocalTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (typeof timezone !== "string" || timezone.length === 0) {
    throw new Error("Unable to resolve the local IANA timezone.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new Error(`Unsupported local IANA timezone: ${timezone}`);
  }
  return timezone;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function collectCcusageUsageAsync(
  sinceDate: string,
  untilDate: string,
  timeoutMs?: number,
  options: CollectOptions = {},
): Promise<CcusageOutput> {
  const { version } = resolveInstalledCcusageCommand();
  assertSupportedCcusageVersion(version);
  const pricingMode = options.pricingMode ?? CCUSAGE_DEFAULT_PRICING_MODE;
  const timezone = options.timezone ?? resolveLocalTimezone();
  const startedAt = Date.now();
  const recoveryBudgetMs = options.pricingRecoveryBudgetMs ?? PRICING_RECOVERY_BUDGET_MS;
  const outerDeadline = startedAt + (timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS);
  const wait = options.sleep ?? sleep;
  const random = options.random ?? Math.random;
  let pricingDeadline: number | undefined;
  for (let attempt = 0; attempt < PRICING_RETRY_DELAYS_MS.length + 1; attempt += 1) {
    const deadline = pricingDeadline ?? outerDeadline;
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      if (pricingDeadline !== undefined) {
        throw new PricingUnavailableError(
          `Live pricing did not recover inside the ${Math.round(recoveryBudgetMs / 1_000)}-second budget.`,
        );
      }
      throw new Error("ccusage exceeded the configured local scan deadline.");
    }
    try {
      const result = await execCcusageAsync(
        argsForPricingMode(sinceDate, untilDate, pricingMode, timezone),
        Math.min(timeoutMs ?? DEFAULT_SUBPROCESS_TIMEOUT_MS, remaining),
      );
      rejectMissingPricing(result.stderr, pricingMode);
      const parsed = parseCcusageOutput(result.stdout, {
        version,
        stderr: result.stderr,
        pricingMode,
      });
      return { ...parsed, pricingRetryCount: attempt };
    } catch (error) {
      if (!(error instanceof PricingUnavailableError) || attempt >= PRICING_RETRY_DELAYS_MS.length) {
        throw error;
      }
      pricingDeadline ??= Math.min(Date.now() + recoveryBudgetMs, outerDeadline);
      const cap = PRICING_RETRY_DELAYS_MS[attempt]!;
      const delay = Math.floor(Math.max(0, Math.min(1, random())) * cap);
      if (Date.now() + delay >= pricingDeadline) {
        throw new PricingUnavailableError(
          `Live pricing did not recover inside the ${Math.round(recoveryBudgetMs / 1_000)}-second budget.`,
        );
      }
      await wait(delay);
    }
  }

  throw new PricingUnavailableError("Live pricing collection did not produce a result.");
}
