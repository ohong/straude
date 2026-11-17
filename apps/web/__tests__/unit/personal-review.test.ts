import { describe, expect, it } from "vitest";
import { personalWeekRange, summarizePersonalWeek } from "@/lib/utils/personal-review";

const now = new Date("2026-11-06T18:00:00Z");

describe("personal weekly review", () => {
  it("compares elapsed weekdays across a month boundary without including the prior weekend", () => {
    const review = summarizePersonalWeek([
      { date: "2026-11-02", cost_usd: 12, output_tokens: 120, model_breakdown: [{ model: "claude-sonnet", cost_usd: 12 }] },
      { date: "2026-11-06", cost_usd: 8, output_tokens: 80, model_breakdown: null },
      { date: "2026-10-26", cost_usd: 5, output_tokens: 50, model_breakdown: null },
      { date: "2026-10-31", cost_usd: 1000, output_tokens: 5000, model_breakdown: null },
      { date: "2026-11-07", cost_usd: 1000, output_tokens: 5000, model_breakdown: null },
    ], [
      { date: "2026-11-02", agent: "claude", cost_usd: 12 },
      { date: "2026-11-06", agent: "legacy-unpartitioned", cost_usd: 8 },
    ], now);
    expect(review.current).toEqual({ estimated_value_usd: 20, output_tokens: 200, received_days: 2 });
    expect(review.previous).toEqual({ estimated_value_usd: 5, output_tokens: 50, received_days: 1 });
    expect(review.models).toEqual([{ name: "claude-sonnet", estimated_value_usd: 12 }]);
    expect(review.tools).toEqual([{ name: "claude", estimated_value_usd: 12 }]);
    expect(review.model_unattributed_usd).toBe(8);
    expect(review.tool_unattributed_usd).toBe(8);
  });

  it("keeps recorded zero days distinct from no submissions, and includes every tool and model", () => {
    const review = summarizePersonalWeek([
      { date: "2026-11-02", cost_usd: 0, output_tokens: 0, model_breakdown: [] },
      { date: "2026-11-03", cost_usd: 6, output_tokens: 90, model_breakdown: [{ model: "a", cost_usd: 1 }, { model: "b", cost_usd: 2 }, { model: "c", cost_usd: 3 }] },
    ], [
      { date: "2026-11-03", agent: "claude", cost_usd: 2 },
      { date: "2026-11-03", agent: "codex", cost_usd: 4 },
    ], now);
    expect(review.current.received_days).toBe(2);
    expect(review.previous.received_days).toBe(0);
    expect(review.models.map((row) => row.name)).toEqual(["c", "b", "a"]);
    expect(review.tools.map((row) => row.name)).toEqual(["codex", "claude"]);
    expect(review.model_unattributed_usd).toBe(0);
    expect(review.tool_unattributed_usd).toBe(0);
  });

  it("uses Monday boundaries across year rollover in UTC", () => {
    expect(personalWeekRange(new Date("2027-01-01T00:30:00Z"))).toEqual({
      start: "2026-12-28", end: "2027-01-01", previous_start: "2026-12-21", previous_end: "2026-12-25",
    });
  });
});
