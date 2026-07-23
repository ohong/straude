import { describe, it, expect, vi, beforeEach } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import {
  CCUSAGE_CLAUDE_COLLECTOR,
  CCUSAGE_CODEX_COLLECTOR,
  collectCcusageUsageAsync,
  parseCcusageOutput,
  _resetCcusageResolver,
  _setCcusageCommandForTests,
} from "../src/lib/ccusage.js";

const ALL_BUILT_IN_CCUSAGE_AGENTS = [
  "claude",
  "codex",
  "opencode",
  "amp",
  "droid",
  "codebuff",
  "hermes",
  "pi",
  "goose",
  "openclaw",
  "kilo",
  "kimi",
  "qwen",
  "copilot",
  "gemini",
].sort();

function row(overrides: Record<string, unknown> = {}) {
  const base = {
    period: "2026-05-13",
    modelsUsed: ["gpt-5.2-codex"],
    inputTokens: 750,
    outputTokens: 125,
    cacheCreationTokens: 0,
    cacheReadTokens: 250,
    totalTokens: 1200,
    totalCost: 0.00310625,
    modelBreakdowns: [
      {
        modelName: "gpt-5.2-codex",
        inputTokens: 750,
        outputTokens: 125,
        cacheCreationTokens: 0,
        cacheReadTokens: 250,
        totalTokens: 1125,
        cost: 0.00310625,
      },
    ],
    metadata: { agents: ["codex"] },
    agents: [
      {
        agent: "codex",
        modelsUsed: ["gpt-5.2-codex"],
        inputTokens: 750,
        outputTokens: 125,
        cacheCreationTokens: 0,
        cacheReadTokens: 250,
        totalTokens: 1200,
        totalCost: 0.00310625,
        modelBreakdowns: [
          {
            modelName: "gpt-5.2-codex",
            inputTokens: 750,
            outputTokens: 125,
            cacheCreationTokens: 0,
            cacheReadTokens: 250,
            totalTokens: 1125,
            cost: 0.00310625,
          },
        ],
      },
    ],
  };
  return { ...base, ...overrides };
}

function rawOutput(rows: unknown[] = [row()]) {
  return JSON.stringify({ daily: rows });
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetCcusageResolver();
  _setCcusageCommandForTests({ cmd: "/bundled/ccusage", args: [] });
});

describe("parseCcusageOutput", () => {
  it("parses ccusage v20 daily rows and derives reasoning residuals", () => {
    const parsed = parseCcusageOutput(rawOutput(), { version: "20.0.16" });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]).toEqual({
      date: "2026-05-13",
      agents: ["codex"],
      agentBreakdown: [{
        agent: "codex",
        models: ["gpt-5.2-codex"],
        inputTokens: 750,
        outputTokens: 125,
        reasoningOutputTokens: 75,
        cacheCreationTokens: 0,
        cacheReadTokens: 250,
        totalTokens: 1200,
        costUSD: 0.00310625,
        modelBreakdown: [{
          model: "gpt-5.2-codex",
          inputTokens: 750,
          outputTokens: 125,
          reasoningOutputTokens: 75,
          cacheCreationTokens: 0,
          cacheReadTokens: 250,
          totalTokens: 1200,
          cost_usd: 0.00310625,
        }],
      }],
      models: ["gpt-5.2-codex"],
      inputTokens: 750,
      outputTokens: 125,
      cacheCreationTokens: 0,
      cacheReadTokens: 250,
      totalTokens: 1200,
      costUSD: 0.00310625,
      reasoningOutputTokens: 75,
      modelBreakdown: [{
        model: "gpt-5.2-codex",
        inputTokens: 750,
        outputTokens: 125,
        reasoningOutputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 250,
        totalTokens: 1125,
        cost_usd: 0.00310625,
      }],
    });
    expect(parsed.summary.totalReasoningOutputTokens).toBe(75);
    expect(parsed.agents).toEqual(["codex"]);
    expect(parsed.collector).toEqual({
      codex: CCUSAGE_CODEX_COLLECTOR,
      ccusage_version: "20.0.16",
      ccusage_agents: ["codex"],
      pricing_mode: "online",
    });
  });

  it("keeps mixed Claude+Codex rows unified with both collector ids", () => {
    const parsed = parseCcusageOutput(rawOutput([
      row({
        period: "2026-05-12",
        modelsUsed: ["claude-sonnet-4-5-20250929", "gpt-5.2-codex"],
        inputTokens: 1200,
        outputTokens: 400,
        cacheCreationTokens: 100,
        cacheReadTokens: 300,
        totalTokens: 2100,
        totalCost: 0.25,
        modelBreakdowns: [
          { modelName: "claude-sonnet-4-5-20250929", cost: 0.2 },
          { modelName: "gpt-5.2-codex", cost: 0.05 },
        ],
        metadata: { agents: ["claude", "codex"] },
        agents: [
          {
            agent: "claude",
            modelsUsed: ["claude-sonnet-4-5-20250929"],
            inputTokens: 600,
            outputTokens: 200,
            cacheCreationTokens: 100,
            cacheReadTokens: 100,
            totalTokens: 1000,
            totalCost: 0.2,
            modelBreakdowns: [{ modelName: "claude-sonnet-4-5-20250929", cost: 0.2 }],
          },
          {
            agent: "codex",
            modelsUsed: ["gpt-5.2-codex"],
            inputTokens: 600,
            outputTokens: 200,
            cacheCreationTokens: 0,
            cacheReadTokens: 200,
            totalTokens: 1100,
            totalCost: 0.05,
            modelBreakdowns: [{ modelName: "gpt-5.2-codex", cost: 0.05 }],
          },
        ],
      }),
    ]), { version: "20.0.16" });

    expect(parsed.agents).toEqual(["claude", "codex"]);
    expect(parsed.collector).toEqual({
      claude: CCUSAGE_CLAUDE_COLLECTOR,
      codex: CCUSAGE_CODEX_COLLECTOR,
      ccusage_version: "20.0.16",
      ccusage_agents: ["claude", "codex"],
      pricing_mode: "online",
    });
    expect(parsed.data[0]!.reasoningOutputTokens).toBe(100);
    expect(parsed.data[0]!.agents).toEqual(["claude", "codex"]);
  });

  it("preserves every built-in ccusage data source", () => {
    const parsed = parseCcusageOutput(rawOutput([
      row({
        period: "2026-05-11",
        modelsUsed: ["gpt-5.6", "gemini-3-pro"],
        modelBreakdowns: [
          { modelName: "gpt-5.6", cost: 0.002 },
          { modelName: "gemini-3-pro", cost: 0.00110625 },
        ],
        metadata: { agents: ALL_BUILT_IN_CCUSAGE_AGENTS },
        agents: ALL_BUILT_IN_CCUSAGE_AGENTS.map((agent, index) => ({
          agent,
          modelsUsed: index === 0 ? ["gpt-5.6", "gemini-3-pro"] : [],
          inputTokens: index === 0 ? 750 : 0,
          outputTokens: index === 0 ? 125 : 0,
          cacheCreationTokens: 0,
          cacheReadTokens: index === 0 ? 250 : 0,
          totalTokens: index === 0 ? 1200 : 0,
          totalCost: index === 0 ? 0.00310625 : 0,
          modelBreakdowns: index === 0
            ? [
              { modelName: "gpt-5.6", cost: 0.002 },
              { modelName: "gemini-3-pro", cost: 0.00110625 },
            ]
            : [],
        })),
      }),
    ]), { version: "20.0.16" });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]!.agents).toEqual(ALL_BUILT_IN_CCUSAGE_AGENTS);
    expect(parsed.agents).toEqual(ALL_BUILT_IN_CCUSAGE_AGENTS);
    expect(parsed.collector).toEqual({
      claude: CCUSAGE_CLAUDE_COLLECTOR,
      codex: CCUSAGE_CODEX_COLLECTOR,
      ccusage_version: "20.0.16",
      ccusage_agents: ALL_BUILT_IN_CCUSAGE_AGENTS,
      pricing_mode: "online",
    });
  });

  it("rejects rows without metadata agents", () => {
    expect(() => parseCcusageOutput(rawOutput([
      row({ metadata: undefined }),
    ]))).toThrow(/metadata\.agents is required/);
  });

  it("rejects priced rows without modelBreakdowns", () => {
    expect(() => parseCcusageOutput(rawOutput([
      row({ modelBreakdowns: undefined }),
    ]))).toThrow(/priced rows must include modelBreakdowns/);
  });

  it("rejects negative token counts", () => {
    expect(() => parseCcusageOutput(rawOutput([
      row({ inputTokens: -1 }),
    ]))).toThrow(/inputTokens must be non-negative/);
  });

  it("rejects total token mismatches instead of clamping them", () => {
    expect(() => parseCcusageOutput(rawOutput([
      row({ totalTokens: 1 }),
    ]))).toThrow(/below its token categories/);
  });

  it("rejects agent totals that disagree with the daily aggregate", () => {
    expect(() => parseCcusageOutput(rawOutput([
      row({
        agents: [{
          ...(row().agents as Array<Record<string, unknown>>)[0],
          inputTokens: 749,
        }],
      }),
    ]))).toThrow(/agents breakdown does not match daily totals/);
  });

  it("rejects model cost differences above half a cent", () => {
    expect(() => parseCcusageOutput(rawOutput([
      row({
        totalCost: 0.02,
      }),
    ]))).toThrow(/cost differs from its model breakdown/);
  });

  it("rejects explicit missing pricing markers", () => {
    expect(() => parseCcusageOutput(rawOutput([
      row({
        modelBreakdowns: [{
          modelName: "gpt-5.2-codex",
          cost: 0,
          missingPricing: true,
        }],
      }),
    ]))).toThrow(/did not produce live pricing/);
  });

  it("returns empty output for an empty ccusage daily array", () => {
    const parsed = parseCcusageOutput(rawOutput([]), { version: "20.0.16" });
    expect(parsed.data).toEqual([]);
    expect(parsed.agents).toEqual([]);
    expect(parsed.collector).toEqual({
      ccusage_version: "20.0.16",
      ccusage_agents: [],
      pricing_mode: "online",
    });
  });

  it("rejects non-JSON input", () => {
    expect(() => parseCcusageOutput("not json")).toThrow(
      "Failed to parse ccusage output as JSON",
    );
  });
});

describe("version and execution", () => {
  it("invokes the installed ccusage binary with current online pricing by default", async () => {
    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
      cb(null, rawOutput(), "");
    });

    const collected = await collectCcusageUsageAsync("20260513", "20260513", 10_000, {
      timezone: "UTC",
    });

    expect(collected.raw).toBe(rawOutput());
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledWith(
      "/bundled/ccusage",
      [
        "daily",
        "--json",
        "--since",
        "20260513",
        "--until",
        "20260513",
        "--timezone",
        "UTC",
        "--by-agent",
        "--no-offline",
      ],
      expect.objectContaining({
        shell: false,
        env: expect.objectContaining({ LOG_LEVEL: "4" }),
      }),
      expect.any(Function),
    );
    expect(collected.collector.pricing_mode).toBe("online");
  });

  it("can explicitly collect with embedded offline pricing", async () => {
    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
      cb(null, rawOutput(), "");
    });

    const collected = await collectCcusageUsageAsync("20260513", "20260513", 10_000, {
      pricingMode: "offline",
      timezone: "UTC",
    });

    expect(execFileMock).toHaveBeenCalledWith(
      "/bundled/ccusage",
      [
        "daily",
        "--json",
        "--since",
        "20260513",
        "--until",
        "20260513",
        "--timezone",
        "UTC",
        "--by-agent",
        "--offline",
      ],
      expect.objectContaining({ shell: false }),
      expect.any(Function),
    );
    expect(collected.collector.pricing_mode).toBe("offline");
  });

  it("rejects ccusage versions below the v20 accuracy floor", async () => {
    _setCcusageCommandForTests({ cmd: "/bundled/ccusage", args: [], version: "20.0.15" });

    await expect(collectCcusageUsageAsync("20260513", "20260513")).rejects.toThrow(
      /fixture-verified ccusage 20\.0\.16/,
    );
  });

  it("retries live pricing fallback failures at most three times", async () => {
    execFileMock
      .mockImplementationOnce((...args: unknown[]) => {
        const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
        cb(null, rawOutput(), "WARN  Failed to fetch LiteLLM pricing (timeout); using embedded pricing.");
      })
      .mockImplementationOnce((...args: unknown[]) => {
        const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
        cb(null, rawOutput(), "WARN  Failed to fetch LiteLLM pricing (timeout); using embedded pricing.");
      })
      .mockImplementationOnce((...args: unknown[]) => {
        const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
        cb(null, rawOutput(), "");
      });

    const collected = await collectCcusageUsageAsync("20260513", "20260513", undefined, {
      pricingMode: "online",
      timezone: "UTC",
      sleep: () => Promise.resolve(),
      random: () => 0,
    });

    expect(execFileMock).toHaveBeenCalledTimes(3);
    expect(collected.collector.pricing_mode).toBe("online");
  });

  it("fails safely when live pricing remains incomplete", async () => {
    execFileMock.mockImplementation((...args: unknown[]) => {
      const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
      cb(null, rawOutput(), "Missing pricing for model gpt-5.2-codex");
    });

    await expect(collectCcusageUsageAsync("20260513", "20260513", undefined, {
      pricingMode: "online",
      timezone: "UTC",
      sleep: () => Promise.resolve(),
      random: () => 0,
    })).rejects.toThrow(
      /fully priced online cost data/,
    );
    expect(execFileMock).toHaveBeenCalledTimes(3);
  });
});
