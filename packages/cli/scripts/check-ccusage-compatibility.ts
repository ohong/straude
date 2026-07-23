import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PricingUnavailableError,
  _resetCcusageResolver,
  _setCcusageCommandForTests,
  assertSupportedCcusageVersion,
  collectCcusageUsageAsync,
  parseCcusageOutput,
} from "../src/lib/ccusage.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDirArgument = process.argv.indexOf("--package-dir");
const ccusagePackageDir = packageDirArgument === -1
  ? dirname(createRequire(import.meta.url).resolve("ccusage/package.json"))
  : resolve(process.argv[packageDirArgument + 1] ?? "");
const packageJson: unknown = JSON.parse(
  readFileSync(join(ccusagePackageDir, "package.json"), "utf8"),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

if (!isRecord(packageJson) || typeof packageJson.version !== "string") {
  throw new Error("ccusage compatibility canary could not read the installed version.");
}
const ccusageVersion = packageJson.version;
assertSupportedCcusageVersion(ccusageVersion);

const bin = typeof packageJson.bin === "string"
  ? packageJson.bin
  : isRecord(packageJson.bin)
    ? packageJson.bin.ccusage
    : undefined;
if (typeof bin !== "string") {
  throw new Error(`ccusage@${ccusageVersion} does not expose the expected ccusage binary.`);
}

const fixtureRoot = resolve(scriptDir, "../__tests__/fixtures/ccusage-gpt-5.6");
const isolatedVariables = [
  "CLAUDE_CONFIG_DIR",
  "OPENCODE_DATA_DIR",
  "AMP_DATA_DIR",
  "DROID_SESSIONS_DIR",
  "CODEBUFF_DATA_DIR",
  "HERMES_HOME",
  "PI_AGENT_DIR",
  "GOOSE_PATH_ROOT",
  "OPENCLAW_DIR",
  "KILO_DATA_DIR",
  "KIMI_DATA_DIR",
  "QWEN_DATA_DIR",
  "GEMINI_DATA_DIR",
] as const;
const originalEnvironment = new Map<string, string | undefined>();

for (const variable of ["HOME", "CODEX_HOME", ...isolatedVariables]) {
  originalEnvironment.set(variable, process.env[variable]);
}
process.env.HOME = fixtureRoot;
process.env.CODEX_HOME = join(fixtureRoot, "codex");
for (const variable of isolatedVariables) delete process.env[variable];

const maximumDurationMs = Number.parseInt(
  process.env.STRAUDE_CCUSAGE_CANARY_MAX_MS ?? "60000",
  10,
);
if (!Number.isInteger(maximumDurationMs) || maximumDurationMs <= 0) {
  throw new Error("STRAUDE_CCUSAGE_CANARY_MAX_MS must be a positive integer.");
}

try {
  _setCcusageCommandForTests({
    cmd: process.execPath,
    args: [resolve(ccusagePackageDir, bin)],
    version: ccusageVersion,
  });
  const startedAt = performance.now();
  const usage = await collectCcusageUsageAsync(
    "20260709",
    "20260709",
    maximumDurationMs,
    { pricingMode: "online", timezone: "UTC" },
  );
  const durationMs = Math.round(performance.now() - startedAt);
  if (durationMs > maximumDurationMs) {
    throw new Error(
      `ccusage@${ccusageVersion} exceeded the ${maximumDurationMs}ms compatibility budget (${durationMs}ms).`,
    );
  }

  const day = usage.data[0];
  const expectedModels = ["gpt-5.6", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"];
  if (
    usage.data.length !== 1
    || !day
    || day.totalTokens !== 440_000
    || day.costUSD <= 0
    || expectedModels.some((model) => !day.models.includes(model))
  ) {
    throw new Error(
      `ccusage@${ccusageVersion} changed the production fixture result: ${JSON.stringify({
        rows: usage.data.length,
        totalTokens: day?.totalTokens,
        costUSD: day?.costUSD,
        models: day?.models,
      })}`,
    );
  }

  const unknownPaidModel = JSON.stringify({
    daily: [{
      period: "2026-07-09",
      modelsUsed: ["gpt-future-codex"],
      inputTokens: 1,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 1,
      totalCost: 0,
      modelBreakdowns: [{
        modelName: "gpt-future-codex",
        inputTokens: 1,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 1,
        cost: 0,
      }],
      metadata: { agents: ["codex"] },
      agents: [{
        agent: "codex",
        modelsUsed: ["gpt-future-codex"],
        inputTokens: 1,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 1,
        totalCost: 0,
        modelBreakdowns: [{
          modelName: "gpt-future-codex",
          inputTokens: 1,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 1,
          cost: 0,
        }],
      }],
    }],
  });
  try {
    parseCcusageOutput(unknownPaidModel, {
      version: ccusageVersion,
      pricingMode: "online",
    });
    throw new Error("production parser accepted an unpriced Codex model with nonzero tokens.");
  } catch (error) {
    if (!(error instanceof PricingUnavailableError)) throw error;
  }

  console.log(
    `ccusage@${ccusageVersion} compatibility passed: production fixture parsed in ${durationMs}ms and unpriced paid usage failed closed.`,
  );
} finally {
  for (const [variable, value] of originalEnvironment) {
    if (value === undefined) delete process.env[variable];
    else process.env[variable] = value;
  }
  _resetCcusageResolver();
}
