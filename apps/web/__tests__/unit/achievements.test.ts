import { describe, it, expect } from "vitest";
import { ACHIEVEMENTS, type AchievementStats } from "@/lib/achievements";

function makeStats(overrides: Partial<AchievementStats> = {}): AchievementStats {
  return {
    totalCost: 0,
    totalOutputTokens: 0,
    streak: 0,
    syncCount: 0,
    ...overrides,
  };
}

describe("achievement definitions", () => {
  it("all slugs are unique", () => {
    const slugs = ACHIEVEMENTS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("zero stats earns no badges", () => {
    const stats = makeStats();
    const earned = ACHIEVEMENTS.filter((a) => a.check(stats));
    expect(earned).toHaveLength(0);
  });
});

describe("first-sync", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "first-sync")!;

  it("not earned with 0 syncs", () => {
    expect(badge.check(makeStats({ syncCount: 0 }))).toBe(false);
  });

  it("earned with 1 sync", () => {
    expect(badge.check(makeStats({ syncCount: 1 }))).toBe(true);
  });
});

describe("7-day-streak", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "7-day-streak")!;

  it("not earned with 6-day streak", () => {
    expect(badge.check(makeStats({ streak: 6 }))).toBe(false);
  });

  it("earned with exactly 7-day streak", () => {
    expect(badge.check(makeStats({ streak: 7 }))).toBe(true);
  });
});

describe("30-day-streak", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "30-day-streak")!;

  it("not earned with 29-day streak", () => {
    expect(badge.check(makeStats({ streak: 29 }))).toBe(false);
  });

  it("earned with exactly 30-day streak", () => {
    expect(badge.check(makeStats({ streak: 30 }))).toBe(true);
  });
});

describe("100-club", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "100-club")!;

  it("not earned at $99.99", () => {
    expect(badge.check(makeStats({ totalCost: 99.99 }))).toBe(false);
  });

  it("earned at exactly $100", () => {
    expect(badge.check(makeStats({ totalCost: 100 }))).toBe(true);
  });
});

describe("big-spender", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "big-spender")!;

  it("not earned at $499.99", () => {
    expect(badge.check(makeStats({ totalCost: 499.99 }))).toBe(false);
  });

  it("earned at exactly $500", () => {
    expect(badge.check(makeStats({ totalCost: 500 }))).toBe(true);
  });
});

describe("1m-output", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "1m-output")!;

  it("not earned at 999,999 tokens", () => {
    expect(badge.check(makeStats({ totalOutputTokens: 999_999 }))).toBe(false);
  });

  it("earned at exactly 1,000,000 tokens", () => {
    expect(badge.check(makeStats({ totalOutputTokens: 1_000_000 }))).toBe(true);
  });
});

describe("10m-output", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "10m-output")!;

  it("not earned at 9,999,999 tokens", () => {
    expect(badge.check(makeStats({ totalOutputTokens: 9_999_999 }))).toBe(false);
  });

  it("earned at exactly 10,000,000 tokens", () => {
    expect(badge.check(makeStats({ totalOutputTokens: 10_000_000 }))).toBe(true);
  });
});

describe("100m-output", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "100m-output")!;

  it("not earned at 99,999,999 tokens", () => {
    expect(badge.check(makeStats({ totalOutputTokens: 99_999_999 }))).toBe(false);
  });

  it("earned at exactly 100,000,000 tokens", () => {
    expect(badge.check(makeStats({ totalOutputTokens: 100_000_000 }))).toBe(true);
  });
});
