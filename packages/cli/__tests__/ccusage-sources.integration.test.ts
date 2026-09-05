import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCcusageOutput } from "../src/lib/ccusage.js";
import { bundledCcusageVersion, runBundledCcusage } from "./helpers/ccusage-binary.js";
import supportedAgents from "./fixtures/ccusage-sources.json";

const fixtureRoot = fileURLToPath(new URL("./fixtures/ccusage-sources", import.meta.url));
let fixtureHome: string;

beforeAll(() => {
  fixtureHome = mkdtempSync(join(tmpdir(), "straude-ccusage-sources-"));
  cpSync(fixtureRoot, fixtureHome, { recursive: true });
});

afterAll(() => rmSync(fixtureHome, { recursive: true, force: true }));

const sources = [
  { agent: "gemini", variable: "GEMINI_DATA_DIR", inputTokens: 800, outputTokens: 100, cacheReadTokens: 200, cacheCreationTokens: 0, reasoningOutputTokens: 50, totalTokens: 1150, model: "gemini-2.5-pro" },
  { agent: "qwen", variable: "QWEN_DATA_DIR", inputTokens: 1000, outputTokens: 100, cacheReadTokens: 200, cacheCreationTokens: 0, reasoningOutputTokens: 50, totalTokens: 1350, model: "qwen3-coder-plus" },
  { agent: "grok", variable: "GROK_HOME", inputTokens: 750, outputTokens: 100, cacheReadTokens: 200, cacheCreationTokens: 50, reasoningOutputTokens: 0, totalTokens: 1100, model: "grok-4.5-build" },
];

async function collect(sourceRoots: Record<string, string>) {
  const { stdout, stderr } = await runBundledCcusage(
    ["daily", "--json", "--since", "20260709", "--until", "20260709", "--offline"],
    fixtureHome,
    sourceRoots,
  );
  expect(stderr).not.toMatch(/missing.*pricing|cost excludes/i);
  return parseCcusageOutput(stdout, { version: bundledCcusageVersion, stderr, pricingMode: "offline" });
}

describe("released ccusage sources", () => {
  it("keeps the supported inventory aligned with the installed native binary", async () => {
    const { stdout } = await runBundledCcusage(["--help"], fixtureHome);
    const commands = stdout.split("COMMANDS:\n")[1]!.split("For more info")[0]!;
    const actual = [...commands.matchAll(/^  (\S+)\s+Show .*usage commands$/gm)].map((match) => match[1]).sort();
    expect(actual).toEqual(supportedAgents);
  });

  it.each(sources)("collects $agent without Claude or Codex data", async ({ agent, variable, model, ...tokens }) => {
    const usage = await collect({ [variable]: join(fixtureHome, agent) });
    expect(usage.agents).toEqual([agent]);
    expect(usage.data).toHaveLength(1);
    expect(usage.data[0]).toMatchObject({ date: "2026-07-09", agents: [agent], models: [model], ...tokens });
    expect(usage.collector).toEqual({ ccusage_version: bundledCcusageVersion, ccusage_agents: [agent], pricing_mode: "offline" });
    expect(usage.data[0]!.costUSD).toBeGreaterThan(0);
    expect(usage.data[0]!.modelBreakdown).toEqual([{ model, cost_usd: usage.data[0]!.costUSD }]);
    if (agent === "grok") expect(usage.data[0]!.costUSD).toBeCloseTo(0.0123, 10);
  });

  it("combines sources without losing cache buckets, reasoning, prices, or source IDs", async () => {
    const roots = Object.fromEntries(sources.map(({ agent, variable }) => [variable, join(fixtureHome, agent)]));
    const singles = await Promise.all(sources.map(({ agent, variable }) => collect({ [variable]: join(fixtureHome, agent) })));
    const combined = await collect(roots);
    expect(combined.agents).toEqual(["gemini", "grok", "qwen"]);
    expect(combined.data).toHaveLength(1);
    expect(combined.data[0]).toMatchObject({ inputTokens: 2550, outputTokens: 300, cacheReadTokens: 600, cacheCreationTokens: 50, reasoningOutputTokens: 100, totalTokens: 3600 });
    expect(combined.data[0]!.modelBreakdown).toHaveLength(3);
    expect(combined.summary.totalCostUSD).toBeCloseTo(singles.reduce((sum, usage) => sum + usage.summary.totalCostUSD, 0), 10);
  });
});
