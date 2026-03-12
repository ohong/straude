import { describe, it, expect } from "vitest";
import { prettifyModel } from "@/components/app/feed/ActivityCard";

describe("prettifyModel", () => {
  describe("Claude models", () => {
    it("prettifies claude-opus-4 variants", () => {
      expect(prettifyModel("claude-opus-4-20260301")).toBe("Claude Opus");
      expect(prettifyModel("claude-opus-4")).toBe("Claude Opus");
    });

    it("prettifies claude-sonnet-4 variants", () => {
      expect(prettifyModel("claude-sonnet-4-20260301")).toBe("Claude Sonnet");
      expect(prettifyModel("claude-sonnet-4")).toBe("Claude Sonnet");
    });

    it("prettifies claude-haiku-4 variants", () => {
      expect(prettifyModel("claude-haiku-4-20260301")).toBe("Claude Haiku");
      expect(prettifyModel("claude-haiku-4")).toBe("Claude Haiku");
    });

    it("handles legacy Claude model names via .includes()", () => {
      expect(prettifyModel("anthropic/claude-3-opus")).toBe("Claude Opus");
      expect(prettifyModel("anthropic/claude-3-sonnet")).toBe("Claude Sonnet");
      expect(prettifyModel("anthropic/claude-3-haiku")).toBe("Claude Haiku");
    });
  });

  describe("OpenAI models", () => {
    it("prettifies GPT models preserving full name", () => {
      expect(prettifyModel("gpt-5.3-codex")).toBe("GPT-5.3-Codex");
      expect(prettifyModel("gpt-4o")).toBe("GPT-4o");
      expect(prettifyModel("gpt-5")).toBe("GPT-5");
    });

    it("prettifies o3/o4 models", () => {
      expect(prettifyModel("o3-mini")).toBe("o3");
      expect(prettifyModel("o4-mini")).toBe("o4");
      expect(prettifyModel("o3")).toBe("o3");
      expect(prettifyModel("o4")).toBe("o4");
    });
  });

  describe("whitespace handling (the bug fix)", () => {
    it("trims leading/trailing whitespace before matching", () => {
      expect(prettifyModel("  claude-opus-4  ")).toBe("Claude Opus");
      expect(prettifyModel("\tclaude-sonnet-4\n")).toBe("Claude Sonnet");
    });

    it("trims whitespace for anchor-dependent patterns (o3/o4)", () => {
      expect(prettifyModel("  o3-mini")).toBe("o3");
      expect(prettifyModel("  o4-mini")).toBe("o4");
    });

    it("trims whitespace for GPT patterns", () => {
      expect(prettifyModel("  gpt-5.3-codex  ")).toBe("GPT-5.3-Codex");
    });

    it("returns trimmed string for unknown models", () => {
      expect(prettifyModel("  some-unknown-model  ")).toBe("some-unknown-model");
    });

    it("trims whitespace for legacy .includes() fallbacks", () => {
      expect(prettifyModel("  some-opus-variant  ")).toBe("Claude Opus");
      expect(prettifyModel("  some-sonnet-variant  ")).toBe("Claude Sonnet");
    });
  });

  describe("unknown models", () => {
    it("returns the model name as-is for unrecognized models", () => {
      expect(prettifyModel("gemini-2.0-flash")).toBe("gemini-2.0-flash");
      expect(prettifyModel("qwen-2.5-coder")).toBe("qwen-2.5-coder");
      expect(prettifyModel("mistral-large")).toBe("mistral-large");
    });
  });
});
