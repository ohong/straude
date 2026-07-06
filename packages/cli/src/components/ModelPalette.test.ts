import { describe, expect, it } from "vitest";
import { buildSegments, getModelColor } from "./ModelPalette.js";
import { modelColors } from "./theme.js";

describe("ModelPalette", () => {
  it("promotes Claude Fable above Opus when Fable has higher weekly spend", () => {
    const segments = buildSegments([
      { model: "claude-opus-4-20250505", cost_usd: 10 },
      { model: "claude-fable-5", cost_usd: 30 },
      { model: "claude-sonnet-4-5-20250929", cost_usd: 5 },
    ]);

    expect(segments.map((segment) => segment.name)).toEqual([
      "Claude Fable",
      "Claude Opus",
      "Claude Sonnet",
    ]);
    expect(segments[0]?.pct).toBe(67);
  });

  it("uses deeper orange for Fable and lighter oranges for lower Claude tiers", () => {
    expect(getModelColor("Claude Fable")).toBe(modelColors["Claude Fable"]);
    expect(getModelColor("Claude Fable 5")).toBe(modelColors["Claude Fable"]);
    expect(getModelColor("Claude Opus")).toBe(modelColors["Claude Opus"]);
    expect(getModelColor("Claude Sonnet")).toBe(modelColors["Claude Sonnet"]);
    expect(getModelColor("Claude Haiku")).toBe(modelColors["Claude Haiku"]);
  });
});
