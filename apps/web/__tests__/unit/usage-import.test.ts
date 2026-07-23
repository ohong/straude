import { describe, expect, it } from "vitest";
import { toLegacyUsageImportEntries } from "@/lib/usage-import";

describe("toLegacyUsageImportEntries", () => {
  const base = {
    date: "2026-07-23",
    models: ["gpt-5.6"],
    inputTokens: 100,
    outputTokens: 20,
    cacheCreationTokens: 0,
    cacheReadTokens: 30,
    totalTokens: 170,
    costUSD: 0.25,
  };

  it("omits absent reasoning tokens so the server can infer the residual", () => {
    const [entry] = toLegacyUsageImportEntries([base]);

    expect(entry?.data).not.toHaveProperty("reasoningOutputTokens");
  });

  it("preserves an explicit reasoning-token value", () => {
    const [entry] = toLegacyUsageImportEntries([{
      ...base,
      reasoningOutputTokens: 20,
    }]);

    expect(entry?.data).toHaveProperty("reasoningOutputTokens", 20);
  });
});
