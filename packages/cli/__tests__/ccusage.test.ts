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
  PricingUnavailableError,
  collectCcusageUsageAsync,
  parseCcusageOutput,
  _resetCcusageResolver,
  _setCcusageCommandForTests,
} from "../src/lib/ccusage.js";

const SOURCE_IDS = [
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
  "future-agent",
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
    const parsed = parseCcusageOutput(rawOutput(), { version: "20.0.18" });

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
      ccusage_version: "20.0.18",
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
    ]), { version: "20.0.18" });

    expect(parsed.agents).toEqual(["claude", "codex"]);
    expect(parsed.collector).toEqual({
      claude: CCUSAGE_CLAUDE_COLLECTOR,
      codex: CCUSAGE_CODEX_COLLECTOR,
      ccusage_version: "20.0.18",
      ccusage_agents: ["claude", "codex"],
      pricing_mode: "online",
    });
    expect(parsed.data[0]!.reasoningOutputTokens).toBe(100);
    expect(parsed.data[0]!.agents).toEqual(["claude", "codex"]);
  });

  it("preserves current and future ccusage source IDs without an allowlist", () => {
    const parsed = parseCcusageOutput(rawOutput([
      row({
        period: "2026-05-11",
        modelsUsed: ["gpt-5.6", "gemini-3-pro"],
        modelBreakdowns: [
          { modelName: "gpt-5.6", cost: 0.002 },
          { modelName: "gemini-3-pro", cost: 0.00110625 },
        ],
        metadata: { agents: SOURCE_IDS },
        agents: SOURCE_IDS.map((agent, index) => ({
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
    ]), { version: "20.0.18" });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]!.agents).toEqual(SOURCE_IDS);
    expect(parsed.agents).toEqual(SOURCE_IDS);
    expect(parsed.collector).toEqual({
      claude: CCUSAGE_CLAUDE_COLLECTOR,
      codex: CCUSAGE_CODEX_COLLECTOR,
      ccusage_version: "20.0.18",
      ccusage_agents: SOURCE_IDS,
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

  it.each(["claude", "codex"])(
    "fails closed when %s reports a future paid model with tokens but no price",
    (agent) => {
      const model = agent === "claude" ? "claude-fable-6" : "gpt-6-codex";
      expect(() => parseCcusageOutput(rawOutput([
        row({
          modelsUsed: [model],
          totalCost: 0,
          modelBreakdowns: [{
            modelName: model,
            inputTokens: 750,
            outputTokens: 125,
            cacheCreationTokens: 0,
            cacheReadTokens: 250,
            totalTokens: 1125,
            cost: 0,
          }],
          metadata: { agents: [agent] },
          agents: [{
            agent,
            modelsUsed: [model],
            inputTokens: 750,
            outputTokens: 125,
            cacheCreationTokens: 0,
            cacheReadTokens: 250,
            totalTokens: 1200,
            totalCost: 0,
            modelBreakdowns: [{
              modelName: model,
              inputTokens: 750,
              outputTokens: 125,
              cacheCreationTokens: 0,
              cacheReadTokens: 250,
              totalTokens: 1125,
              cost: 0,
            }],
          }],
        }),
      ]))).toThrow(PricingUnavailableError);
    },
  );

  it("fails closed before reasoning-only paid usage can receive residual model tokens", () => {
    expect(() => parseCcusageOutput(rawOutput([
      row({
        modelsUsed: ["gpt-future-reasoning"],
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 50,
        totalCost: 0,
        modelBreakdowns: [{
          modelName: "gpt-future-reasoning",
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 0,
          cost: 0,
        }],
        metadata: { agents: ["codex"] },
        agents: [{
          agent: "codex",
          modelsUsed: ["gpt-future-reasoning"],
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 50,
          totalCost: 0,
          modelBreakdowns: [{
            modelName: "gpt-future-reasoning",
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            totalTokens: 0,
            cost: 0,
          }],
        }],
      }),
    ]))).toThrow(PricingUnavailableError);
  });

  it("fails closed when reasoning allocation gives tokens to an unpriced paid model", () => {
    const modelBreakdowns = [
      {
        modelName: "priced-model",
        inputTokens: 1,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 1,
        cost: 0.1,
      },
      {
        modelName: "aaa-unpriced-model",
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        cost: 0,
      },
    ];
    expect(() => parseCcusageOutput(rawOutput([
      row({
        modelsUsed: ["priced-model", "aaa-unpriced-model"],
        inputTokens: 1,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 2,
        totalCost: 0.1,
        modelBreakdowns,
        metadata: { agents: ["codex"] },
        agents: [{
          agent: "codex",
          modelsUsed: ["priced-model", "aaa-unpriced-model"],
          inputTokens: 1,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 2,
          totalCost: 0.1,
          modelBreakdowns,
        }],
      }),
    ]))).toThrow(PricingUnavailableError);
  });

  it("allows a future source to report legitimately zero-cost usage", () => {
    const parsed = parseCcusageOutput(rawOutput([
      row({
        modelsUsed: ["future-free-model"],
        totalCost: 0,
        modelBreakdowns: [{
          modelName: "future-free-model",
          inputTokens: 750,
          outputTokens: 125,
          cacheCreationTokens: 0,
          cacheReadTokens: 250,
          totalTokens: 1125,
          cost: 0,
        }],
        metadata: { agents: ["future-agent"] },
        agents: [{
          agent: "future-agent",
          modelsUsed: ["future-free-model"],
          inputTokens: 750,
          outputTokens: 125,
          cacheCreationTokens: 0,
          cacheReadTokens: 250,
          totalTokens: 1200,
          totalCost: 0,
          modelBreakdowns: [{
            modelName: "future-free-model",
            inputTokens: 750,
            outputTokens: 125,
            cacheCreationTokens: 0,
            cacheReadTokens: 250,
            totalTokens: 1125,
            cost: 0,
          }],
        }],
      }),
    ]));

    expect(parsed.agents).toEqual(["future-agent"]);
    expect(parsed.data[0]!.models).toEqual(["future-free-model"]);
    expect(parsed.data[0]!.costUSD).toBe(0);
  });

  it("returns empty output for an empty ccusage daily array", () => {
    const parsed = parseCcusageOutput(rawOutput([]), { version: "20.0.18" });
    expect(parsed.data).toEqual([]);
    expect(parsed.agents).toEqual([]);
    expect(parsed.collector).toEqual({
      ccusage_version: "20.0.18",
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

  it.each([
    ["minimum", "20.0.18", true],
    ["later v20 patch", "20.0.99", true],
    ["later v20 minor", "20.9.0", true],
    ["build metadata", "20.0.18+straude.1", true],
    ["below floor", "20.0.17", false],
    ["next major", "21.0.0", true],
    ["later major", "22.1.0", true],
    ["prerelease", "20.0.19-beta.1", false],
    ["leading zero", "20.00.18", false],
    ["incomplete", "20.0", false],
    ["invalid", "latest", false],
  ])("%s version %s is supported: %s", async (_case, version, supported) => {
    _setCcusageCommandForTests({ cmd: "/bundled/ccusage", args: [], version });
    if (!supported) {
      await expect(collectCcusageUsageAsync("20260513", "20260513")).rejects.toThrow(
        /stable ccusage version >=20\.0\.18/,
      );
      return;
    }
    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
      cb(null, rawOutput(), "");
    });
    const collected = await collectCcusageUsageAsync("20260513", "20260513");
    expect(collected.version).toBe(version);
    expect(collected.collector.ccusage_version).toBe(version);
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
