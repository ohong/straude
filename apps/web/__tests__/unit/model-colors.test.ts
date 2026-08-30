import { describe, expect, it } from "vitest";
import { prettifyModel } from "@straude/shared/models";
import {
  MODEL_COLOR_FALLBACK_PALETTE,
  MODEL_COLOR_PATTERNS,
  modelColor,
} from "@/lib/constants/model-colors";

describe("modelColor", () => {
  it("maps every known family to its chip colour", () => {
    // Keyed off prettifyModel output, which is what ActivityCard passes in —
    // a pattern that doesn't match the display names is dead code.
    expect(modelColor(prettifyModel("claude-fable-5"))).toBe("#C2410C");
    expect(modelColor(prettifyModel("claude-opus-5"))).toBe("#DF561F");
    expect(modelColor(prettifyModel("claude-sonnet-5"))).toBe("#F08A5D");
    expect(modelColor(prettifyModel("claude-haiku-4-5-20251001"))).toBe("#F7B267");
    expect(modelColor(prettifyModel("gpt-5.6-codex"))).toBe("#2A9D8F");
    expect(modelColor(prettifyModel("gpt-4o"))).toBe("#4C78A8");
    expect(modelColor(prettifyModel("o3-mini"))).toBe("#3B82F6");
    expect(modelColor(prettifyModel("o4-mini"))).toBe("#6366F1");
  });

  it("keeps Fable ahead of the broader Claude patterns", () => {
    // First match wins, so reordering MODEL_COLOR_PATTERNS silently repaints
    // chips. Fable and Opus share the accent family and are easy to swap.
    const order = MODEL_COLOR_PATTERNS.map(([pattern]) => pattern.source);
    expect(order.indexOf("Claude Fable")).toBeLessThan(order.indexOf("Claude Opus"));
  });

  it("always returns a colour for an unknown model", () => {
    // hashString is a signed 32-bit value, so roughly half of these names
    // hashed negative and indexed off the front of the palette, handing the
    // chip an undefined backgroundColor. Now that collection accepts every
    // ccusage source, these names reach the feed for real.
    const unknown = [
      "kimi-k2",
      "glm-4.6",
      "deepseek-v3",
      "grok-code-fast-1",
      "qwen3-coder",
      "mistral-large",
      "gemini-2.5-pro",
      "llama-4",
    ];

    for (const name of unknown) {
      expect(MODEL_COLOR_FALLBACK_PALETTE).toContain(
        modelColor(prettifyModel(name)),
      );
    }
  });

  it("is stable for the same name", () => {
    expect(modelColor("kimi-k2")).toBe(modelColor("kimi-k2"));
  });

  it("handles the empty name without throwing", () => {
    expect(MODEL_COLOR_FALLBACK_PALETTE).toContain(modelColor(""));
  });
});
