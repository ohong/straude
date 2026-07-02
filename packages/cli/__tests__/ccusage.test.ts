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

function row(overrides: Record<string, unknown> = {}) {
  return {
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
        cost: 0.00310625,
      },
    ],
    metadata: { agents: ["codex"] },
    ...overrides,
  };
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
    const parsed = parseCcusageOutput(rawOutput(), { version: "20.0.6" });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]).toEqual({
      date: "2026-05-13",
      models: ["gpt-5.2-codex"],
      inputTokens: 750,
      outputTokens: 125,
      cacheCreationTokens: 0,
      cacheReadTokens: 250,
      totalTokens: 1200,
      costUSD: 0.00310625,
      reasoningOutputTokens: 75,
      modelBreakdown: [{ model: "gpt-5.2-codex", cost_usd: 0.00310625 }],
    });
    expect(parsed.summary.totalReasoningOutputTokens).toBe(75);
    expect(parsed.agents).toEqual(["codex"]);
    expect(parsed.collector).toEqual({
      codex: CCUSAGE_CODEX_COLLECTOR,
      ccusage_version: "20.0.6",
      ccusage_agents: ["codex"],
      pricing_mode: "offline",
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
      }),
    ]), { version: "20.0.6" });

    expect(parsed.agents).toEqual(["claude", "codex"]);
    expect(parsed.collector).toEqual({
      claude: CCUSAGE_CLAUDE_COLLECTOR,
      codex: CCUSAGE_CODEX_COLLECTOR,
      ccusage_version: "20.0.6",
      ccusage_agents: ["claude", "codex"],
      pricing_mode: "offline",
    });
    expect(parsed.data[0]!.reasoningOutputTokens).toBe(100);
  });

  it("rejects unsupported ccusage agents instead of filtering them silently", () => {
    expect(() => parseCcusageOutput(rawOutput([
      row({ metadata: { agents: ["claude", "gemini"] } }),
    ]))).toThrow(/Unsupported ccusage agents detected.*gemini/);
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

  it("returns empty output for an empty ccusage daily array", () => {
    const parsed = parseCcusageOutput(rawOutput([]), { version: "20.0.6" });
    expect(parsed.data).toEqual([]);
    expect(parsed.agents).toEqual([]);
    expect(parsed.collector).toEqual({
      ccusage_version: "20.0.6",
      ccusage_agents: [],
      pricing_mode: "offline",
    });
  });

  it("rejects non-JSON input", () => {
    expect(() => parseCcusageOutput("not json")).toThrow(
      "Failed to parse ccusage output as JSON",
    );
  });
});

describe("version and execution", () => {
  it("invokes the installed ccusage binary with offline unified daily args", async () => {
    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
      cb(null, rawOutput(), "");
    });

    const collected = await collectCcusageUsageAsync("20260513", "20260513", 10_000);

    expect(collected.raw).toBe(rawOutput());
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledWith(
      "/bundled/ccusage",
      ["daily", "--json", "--since", "20260513", "--until", "20260513", "--offline"],
      expect.objectContaining({ shell: false }),
      expect.any(Function),
    );
    expect(collected.collector.pricing_mode).toBe("offline");
  });

  it("can explicitly collect with online pricing", async () => {
    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
      cb(null, rawOutput(), "");
    });

    const collected = await collectCcusageUsageAsync("20260513", "20260513", 10_000, {
      pricingMode: "online",
    });

    expect(execFileMock).toHaveBeenCalledWith(
      "/bundled/ccusage",
      ["daily", "--json", "--since", "20260513", "--until", "20260513", "--no-offline"],
      expect.objectContaining({ shell: false }),
      expect.any(Function),
    );
    expect(collected.collector.pricing_mode).toBe("online");
  });

  it("rejects ccusage versions below the v20 accuracy floor", async () => {
    _setCcusageCommandForTests({ cmd: "/bundled/ccusage", args: [], version: "20.0.4" });

    await expect(collectCcusageUsageAsync("20260513", "20260513")).rejects.toThrow(
      /requires ccusage >=20\.0\.5/,
    );
  });

  it("falls back to online pricing when offline pricing is incomplete", async () => {
    execFileMock
      .mockImplementationOnce((...args: unknown[]) => {
        const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
        cb(null, rawOutput(), "Missing pricing for model gpt-5.2-codex");
      })
      .mockImplementationOnce((...args: unknown[]) => {
        const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
        cb(null, rawOutput(), "");
      });

    const collected = await collectCcusageUsageAsync("20260513", "20260513");

    expect(execFileMock).toHaveBeenCalledTimes(2);
    expect(execFileMock.mock.calls[0]![1]).toContain("--offline");
    expect(execFileMock.mock.calls[1]![1]).toContain("--no-offline");
    expect(collected.collector.pricing_mode).toBe("online");
  });

  it("fails safely when the selected pricing mode remains incomplete", async () => {
    execFileMock.mockImplementationOnce((...args: unknown[]) => {
      const cb = args.at(-1) as (err: Error | null, stdout: string, stderr: string) => void;
      cb(null, rawOutput(), "Missing pricing for model gpt-5.2-codex");
    });

    await expect(collectCcusageUsageAsync("20260513", "20260513", undefined, {
      allowOnlineFallback: false,
    })).rejects.toThrow(
      /fully priced offline cost data/,
    );
  });
});
