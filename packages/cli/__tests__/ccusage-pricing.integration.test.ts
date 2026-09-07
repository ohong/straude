import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CCUSAGE_MIN_VERSION,
  parseCcusageOutput,
} from "../src/lib/ccusage.js";

import { bundledCcusageVersion, runBundledCcusage } from "./helpers/ccusage-binary.js";

let fixtureHome: string;
beforeAll(() => {
  fixtureHome = mkdtempSync(join(tmpdir(), "straude-ccusage-pricing-"));
  cpSync(fileURLToPath(new URL("./fixtures/ccusage-gpt-5.6", import.meta.url)), fixtureHome, { recursive: true });
});
afterAll(() => rmSync(fixtureHome, { recursive: true, force: true }));

function comparableVersion(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
  return major * 1_000_000 + minor * 1_000 + patch;
}

describe("bundled ccusage GPT-5.6 pricing", () => {
  it("logs Codex tokens and LiteLLM API spend for the complete GPT-5.6 family", async () => {
    const { stdout, stderr } = await runBundledCcusage(
      ["daily", "--json", "--by-agent", "--since", "20260709", "--until", "20260709", "--no-offline"],
      fixtureHome,
      { CODEX_HOME: `${fixtureHome}/codex` },
    );
    expect(stderr).not.toMatch(/missing.*pricing|cost excludes/i);
    const usage = parseCcusageOutput(stdout, { version: bundledCcusageVersion, stderr, pricingMode: "online" });

    expect(comparableVersion(usage.version)).toBeGreaterThanOrEqual(
      comparableVersion(CCUSAGE_MIN_VERSION),
    );
    expect(usage.agents).toEqual(["codex"]);
    expect(usage.data).toHaveLength(1);

    const day = usage.data[0]!;
    expect(day).toMatchObject({
      date: "2026-07-09",
      agents: ["codex"],
      inputTokens: 320_000,
      cacheReadTokens: 80_000,
      cacheCreationTokens: 0,
      outputTokens: 40_000,
      reasoningOutputTokens: 0,
      totalTokens: 440_000,
    });

    // Every member of the GPT-5.6 family must resolve to a LiteLLM price.
    // The dollar amounts themselves are owned upstream and change without
    // notice, so assert that each model is priced rather than pinning rates.
    const expectedModels = ["gpt-5.6", "gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"];
    expect([...day.models].sort()).toEqual(expectedModels);
    expect(day.modelBreakdown).toHaveLength(expectedModels.length);

    const breakdowns = day.modelBreakdown ?? [];
    expect(breakdowns.map((breakdown) => breakdown.model).sort()).toEqual(expectedModels);
    for (const breakdown of breakdowns) {
      expect(breakdown.cost_usd, `${breakdown.model} is unpriced`).toBeGreaterThan(0);
    }

    const summedCost = breakdowns.reduce((total, breakdown) => total + breakdown.cost_usd, 0);
    expect(day.costUSD).toBeCloseTo(summedCost, 10);
    expect(usage.summary.totalCostUSD).toBeCloseTo(summedCost, 10);
  });
});
