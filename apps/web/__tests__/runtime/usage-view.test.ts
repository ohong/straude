import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEGACY_TOOL,
  buildUsageViewRows,
  enumerateDates,
  rankTools,
  shiftDate,
  summarizeUsage,
  todayInTimezone,
  totalTokens,
  windowStart,
  type AgentDailyRecord,
} from "@/lib/usage-view";
import { loadUsageView } from "@/lib/data/usage-view";
import { toolColors, toolLabel } from "@/components/app/usage/usage-tools";
import { formatPercent } from "@/lib/utils/format";

function makeRecord(overrides: Partial<AgentDailyRecord> = {}): AgentDailyRecord {
  return {
    date: "2026-11-20",
    agent: "claude",
    input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    cache_creation_tokens: 0,
    cache_read_tokens: 0,
    cost_usd: 0,
    model_breakdown: null,
    ...overrides,
  };
}

describe("usage-view date helpers", () => {
  it("shifts dates across month and leap-year boundaries in UTC", () => {
    expect(shiftDate("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftDate("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftDate("2024-02-29", 1)).toBe("2024-03-01");
    expect(windowStart("2026-11-25", 7)).toBe("2026-11-19");
    expect(enumerateDates("2026-11-23", "2026-11-25")).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
    ]);
  });

  it("formats today in an IANA timezone and falls back to UTC on invalid zones", () => {
    const instant = new Date("2026-11-26T02:30:00Z");
    expect(todayInTimezone("America/Los_Angeles", instant)).toBe("2026-11-25");
    expect(todayInTimezone("Asia/Tokyo", instant)).toBe("2026-11-26");
    expect(todayInTimezone("Not/A_Timezone", instant)).toBe("2026-11-26");
    expect(todayInTimezone(null, instant)).toBe("2026-11-26");
  });
});

describe("buildUsageViewRows", () => {
  it("sums multiple devices for the same date, tool, and model", () => {
    const rows = buildUsageViewRows([
      makeRecord({
        date: "2026-11-25",
        agent: "claude",
        input_tokens: 100,
        output_tokens: 50,
        cost_usd: 1.25,
        model_breakdown: [
          { model: "claude-opus-5-5", input_tokens: 100, output_tokens: 50, cost_usd: 1.25 },
        ],
      }),
      makeRecord({
        date: "2026-11-25",
        agent: "claude",
        input_tokens: "200",
        output_tokens: "150",
        cost_usd: "2.75",
        model_breakdown: [
          { model: "claude-opus-5-5", input_tokens: 200, output_tokens: 150, cost_usd: 2.75 },
        ],
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      date: "2026-11-25",
      tool: "claude",
      model: "claude-opus-5-5",
      cost: 4,
      tokens: {
        input: 300,
        cacheRead: 0,
        cacheWrite: 0,
        output: 200,
        reasoning: 0,
        other: 0,
      },
    });
  });

  it("keeps row totals authoritative by clamping breakdown entries and putting remainders in model ''", () => {
    const rows = buildUsageViewRows([
      makeRecord({
        date: "2026-11-25",
        agent: "codex",
        input_tokens: 100,
        output_tokens: 50,
        cost_usd: 5,
        model_breakdown: [
          // Exceeds row's input_tokens (100) and leaves cost remainder (2) and output remainder (50)
          { model: "gpt-6.2-sol", input_tokens: 999, output_tokens: 0, cost_usd: 3 },
          // Ignored: empty model name
          { model: "", input_tokens: 10, cost_usd: 1 },
        ],
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tool: "codex",
      model: "",
      cost: 2,
      tokens: { input: 0, output: 50, cacheRead: 0, cacheWrite: 0, reasoning: 0, other: 0 },
    });
    expect(rows[1]).toMatchObject({
      tool: "codex",
      model: "gpt-6.2-sol",
      cost: 3,
      tokens: { input: 100, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, other: 0 },
    });
  });

  it("maps legacy-unpartitioned reasoning_output_tokens into tokens.other instead of tokens.reasoning", () => {
    const rows = buildUsageViewRows([
      makeRecord({
        date: "2026-11-01",
        agent: LEGACY_TOOL,
        input_tokens: 100,
        output_tokens: 200,
        reasoning_output_tokens: 300,
        cost_usd: 5,
        model_breakdown: [{ model: "claude-sonnet-5", cost_usd: 4 }],
      }),
    ]);

    const unattributed = rows.find((r) => r.model === "");
    const attributed = rows.find((r) => r.model === "claude-sonnet-5");
    expect(attributed).toMatchObject({ cost: 4 });
    expect(totalTokens(attributed!.tokens)).toBe(0);
    expect(unattributed).toMatchObject({
      tool: LEGACY_TOOL,
      cost: 1,
      tokens: { input: 100, output: 200, reasoning: 0, other: 300, cacheRead: 0, cacheWrite: 0 },
    });
  });

  it("ignores negative, NaN, and malformed breakdown entries safely", () => {
    const rows = buildUsageViewRows([
      makeRecord({
        date: "2026-11-25",
        agent: "claude",
        input_tokens: -50,
        output_tokens: "not-a-number",
        cost_usd: 1,
        model_breakdown: [
          null as unknown as Record<string, unknown>,
          { model: "claude-opus-5-5", cost_usd: 1 },
        ],
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      model: "claude-opus-5-5",
      cost: 1,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, other: 0 },
    });
  });
});

describe("summarizeUsage and rankTools", () => {
  const sampleRows = buildUsageViewRows([
    makeRecord({
      date: "2026-11-25",
      agent: "claude",
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_tokens: 200,
      cache_read_tokens: 8300,
      cost_usd: 12.5,
      model_breakdown: [
        {
          model: "claude-opus-5-5",
          input_tokens: 1000,
          output_tokens: 500,
          cache_creation_tokens: 200,
          cache_read_tokens: 8300,
          cost_usd: 12.5,
        },
      ],
    }),
    makeRecord({
      date: "2026-11-24",
      agent: "codex",
      input_tokens: 2000,
      output_tokens: 1000,
      reasoning_output_tokens: 500,
      cache_read_tokens: 16500,
      cost_usd: 30,
      model_breakdown: [
        {
          model: "gpt-6.2-sol",
          input_tokens: 2000,
          output_tokens: 1000,
          reasoning_output_tokens: 500,
          cache_read_tokens: 16500,
          cost_usd: 29.997,
        },
      ],
    }),
  ]);

  it("computes totals, cache hit rate, tool/model shares, and hides sub-half-cent unattributed rows", () => {
    const summary = summarizeUsage(sampleRows, {
      start: "2026-11-23",
      end: "2026-11-25",
      metric: "cost",
    });

    expect(summary.cost).toBeCloseTo(42.5, 6);
    expect(summary.totalTokens).toBe(30_000);
    expect(summary.activeDays).toBe(2);
    // cacheRead = 8300 + 16500 = 24800; allInput = 3000 + 24800 + 200 = 28000
    expect(summary.cacheHitRate).toBeCloseTo(24_800 / 28_000, 6);
    expect(summary.days.map((d) => d.date)).toEqual(["2026-11-23", "2026-11-24", "2026-11-25"]);
    expect(summary.days[0]).toEqual({ date: "2026-11-23", cost: 0, totalTokens: 0, byTool: {} });

    // Sub-half-cent ($0.003) unattributed remainder on codex stays in headline cost, omitted from models table.
    expect(summary.models.map((m) => m.model)).toEqual(["gpt-6.2-sol", "claude-opus-5-5"]);
    expect(summary.tools.map((t) => t.tool)).toEqual(["codex", "claude"]);
    expect(summary.tools[0]?.costShare).toBeCloseTo(30 / 42.5, 6);
  });

  it("filters by tool and returns null cacheHitRate when there is no input", () => {
    const filtered = summarizeUsage(sampleRows, {
      start: "2026-11-23",
      end: "2026-11-25",
      metric: "tokens",
      tool: "claude",
    });
    expect(filtered.cost).toBeCloseTo(12.5, 6);
    expect(filtered.tools).toHaveLength(1);
    expect(filtered.tools[0]?.tool).toBe("claude");

    const empty = summarizeUsage(sampleRows, {
      start: "2026-11-01",
      end: "2026-11-03",
      metric: "cost",
    });
    expect(empty.cost).toBe(0);
    expect(empty.totalTokens).toBe(0);
    expect(empty.activeDays).toBe(0);
    expect(empty.cacheHitRate).toBeNull();
  });

  it("ranks tools by total cost descending with alphabetical tie-breaking", () => {
    expect(rankTools(sampleRows)).toEqual(["codex", "claude"]);
    const tied = buildUsageViewRows([
      makeRecord({ agent: "pi", cost_usd: 5 }),
      makeRecord({ agent: "droid", cost_usd: 5 }),
    ]);
    expect(rankTools(tied)).toEqual(["droid", "pi"]);
  });
});

describe("loadUsageView", () => {
  it("paginates past 500 rows and advances end when a device is ahead of the profile timezone", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-25T12:00:00Z"));
      const firstPage = Array.from({ length: 500 }, (_, i) =>
        makeRecord({
          date: "2026-11-25",
          agent: "claude",
          cost_usd: 0.01,
          model_breakdown: [{ model: `m-${i}`, cost_usd: 0.01 }],
        }),
      );
      const secondPage = [
        makeRecord({
          date: "2026-11-26",
          agent: "codex",
          cost_usd: 2,
          model_breakdown: [{ model: "gpt-6.2-sol", cost_usd: 2 }],
        }),
      ];

      const ranges: Array<[number, number]> = [];
      const chain = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        order: () => chain,
        range: async (from: number, to: number) => {
          ranges.push([from, to]);
          return { data: from === 0 ? firstPage : secondPage, error: null };
        },
      };
      const db = { from: () => chain } as unknown as SupabaseClient;

      const result = await loadUsageView(db, "user-1", "UTC");
      expect(ranges).toEqual([
        [0, 499],
        [500, 999],
      ]);
      expect(result.end).toBe("2026-11-26");
      expect(result.rows).toHaveLength(501);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws when Supabase returns an error", async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      order: () => chain,
      range: async () => ({ data: null, error: { message: "boom" } }),
    };
    const db = { from: () => chain } as unknown as SupabaseClient;

    await expect(loadUsageView(db, "user-1", "UTC")).rejects.toThrow(
      "Unable to load usage view (boom)",
    );
  });
});

describe("usage-tools and formatPercent", () => {
  it("maps known tool labels and assigns stable colors", () => {
    expect(toolLabel("claude")).toBe("Claude Code");
    expect(toolLabel(LEGACY_TOOL)).toBe("Earlier syncs");
    expect(toolLabel("custom-tool")).toBe("custom-tool");

    const colors = toolColors(["claude", "codex", LEGACY_TOOL, "pi"]);
    expect(colors.claude).toBe("var(--color-accent)");
    expect(colors.codex).toBe("var(--color-foreground)");
    expect(colors[LEGACY_TOOL]).toContain("color-mix");
    expect(colors.pi).toBe("var(--color-secondary-blue)");
  });

  it("formats percentages cleanly", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0.752)).toBe("75.2%");
    expect(formatPercent(0.5)).toBe("50%");
  });
});
