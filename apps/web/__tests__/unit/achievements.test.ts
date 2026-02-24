import { describe, it, expect } from "vitest";
import { ACHIEVEMENTS, type AchievementStats } from "@/lib/achievements";

function makeStats(overrides: Partial<AchievementStats> = {}): AchievementStats {
  return {
    totalCost: 0,
    totalOutputTokens: 0,
    totalInputTokens: 0,
    totalCacheTokens: 0,
    totalSessions: 0,
    maxDailyCost: 0,
    streak: 0,
    syncCount: 0,
    verifiedSyncCount: 0,
    kudosReceived: 0,
    kudosSent: 0,
    commentsReceived: 0,
    commentsSent: 0,
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

  it("every achievement has a valid trigger", () => {
    for (const a of ACHIEVEMENTS) {
      expect(["usage", "kudos", "comment"]).toContain(a.trigger);
    }
  });

  it("has 17 usage achievements", () => {
    expect(ACHIEVEMENTS.filter((a) => a.trigger === "usage")).toHaveLength(17);
  });

  it("has 8 kudos achievements", () => {
    expect(ACHIEVEMENTS.filter((a) => a.trigger === "kudos")).toHaveLength(8);
  });

  it("has 8 comment achievements", () => {
    expect(ACHIEVEMENTS.filter((a) => a.trigger === "comment")).toHaveLength(8);
  });
});

describe("trigger filtering correctness", () => {
  const usageBadges = ACHIEVEMENTS.filter((a) => a.trigger === "usage");
  const kudosBadges = ACHIEVEMENTS.filter((a) => a.trigger === "kudos");
  const commentBadges = ACHIEVEMENTS.filter((a) => a.trigger === "comment");

  it("usage badges only depend on usage stats, not social stats", () => {
    // Max social stats, zero usage stats — no usage badge should fire
    const stats = makeStats({
      kudosReceived: 999,
      kudosSent: 999,
      commentsReceived: 999,
      commentsSent: 999,
    });
    const earned = usageBadges.filter((a) => a.check(stats));
    expect(earned).toHaveLength(0);
  });

  it("kudos badges only depend on kudos stats", () => {
    // Max non-kudos stats, zero kudos — no kudos badge should fire
    const stats = makeStats({
      totalCost: 9999,
      totalOutputTokens: 999_999_999,
      commentsReceived: 999,
      commentsSent: 999,
    });
    const earned = kudosBadges.filter((a) => a.check(stats));
    expect(earned).toHaveLength(0);
  });

  it("comment badges only depend on comment stats", () => {
    // Max non-comment stats, zero comments — no comment badge should fire
    const stats = makeStats({
      totalCost: 9999,
      totalOutputTokens: 999_999_999,
      kudosReceived: 999,
      kudosSent: 999,
    });
    const earned = commentBadges.filter((a) => a.check(stats));
    expect(earned).toHaveLength(0);
  });

  it("all kudos badges fire with sufficient kudos stats", () => {
    const stats = makeStats({ kudosReceived: 500, kudosSent: 500 });
    const earned = kudosBadges.filter((a) => a.check(stats));
    expect(earned).toHaveLength(8);
  });

  it("all comment badges fire with sufficient comment stats", () => {
    const stats = makeStats({ commentsReceived: 500, commentsSent: 500 });
    const earned = commentBadges.filter((a) => a.check(stats));
    expect(earned).toHaveLength(8);
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

describe("1m-input", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "1m-input")!;

  it("not earned at 999,999 tokens", () => {
    expect(badge.check(makeStats({ totalInputTokens: 999_999 }))).toBe(false);
  });

  it("earned at exactly 1,000,000 tokens", () => {
    expect(badge.check(makeStats({ totalInputTokens: 1_000_000 }))).toBe(true);
  });
});

describe("10m-input", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "10m-input")!;

  it("not earned at 9,999,999 tokens", () => {
    expect(badge.check(makeStats({ totalInputTokens: 9_999_999 }))).toBe(false);
  });

  it("earned at exactly 10,000,000 tokens", () => {
    expect(badge.check(makeStats({ totalInputTokens: 10_000_000 }))).toBe(true);
  });
});

describe("100m-input", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "100m-input")!;

  it("not earned at 99,999,999 tokens", () => {
    expect(badge.check(makeStats({ totalInputTokens: 99_999_999 }))).toBe(false);
  });

  it("earned at exactly 100,000,000 tokens", () => {
    expect(badge.check(makeStats({ totalInputTokens: 100_000_000 }))).toBe(true);
  });
});

describe("1b-cache", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "1b-cache")!;

  it("not earned at 999,999,999 tokens", () => {
    expect(badge.check(makeStats({ totalCacheTokens: 999_999_999 }))).toBe(false);
  });

  it("earned at exactly 1,000,000,000 tokens", () => {
    expect(badge.check(makeStats({ totalCacheTokens: 1_000_000_000 }))).toBe(true);
  });
});

describe("5b-cache", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "5b-cache")!;

  it("not earned at 4,999,999,999 tokens", () => {
    expect(badge.check(makeStats({ totalCacheTokens: 4_999_999_999 }))).toBe(false);
  });

  it("earned at exactly 5,000,000,000 tokens", () => {
    expect(badge.check(makeStats({ totalCacheTokens: 5_000_000_000 }))).toBe(true);
  });
});

describe("20b-cache", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "20b-cache")!;

  it("not earned at 19,999,999,999 tokens", () => {
    expect(badge.check(makeStats({ totalCacheTokens: 19_999_999_999 }))).toBe(false);
  });

  it("earned at exactly 20,000,000,000 tokens", () => {
    expect(badge.check(makeStats({ totalCacheTokens: 20_000_000_000 }))).toBe(true);
  });
});

describe("session-surge", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "session-surge")!;

  it("not earned at 999 sessions", () => {
    expect(badge.check(makeStats({ totalSessions: 999 }))).toBe(false);
  });

  it("earned at exactly 1,000 sessions", () => {
    expect(badge.check(makeStats({ totalSessions: 1_000 }))).toBe(true);
  });
});

describe("power-session", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "power-session")!;

  it("not earned at $99.99/day", () => {
    expect(badge.check(makeStats({ maxDailyCost: 99.99 }))).toBe(false);
  });

  it("earned at exactly $100/day", () => {
    expect(badge.check(makeStats({ maxDailyCost: 100 }))).toBe(true);
  });
});

describe("verified-contributor", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "verified-contributor")!;

  it("not earned at 49 verified syncs", () => {
    expect(badge.check(makeStats({ verifiedSyncCount: 49 }))).toBe(false);
  });

  it("earned at exactly 50 verified syncs", () => {
    expect(badge.check(makeStats({ verifiedSyncCount: 50 }))).toBe(true);
  });
});

describe("kudos-received-1", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "kudos-received-1")!;

  it("not earned with 0 kudos received", () => {
    expect(badge.check(makeStats({ kudosReceived: 0 }))).toBe(false);
  });

  it("earned with 1 kudos received", () => {
    expect(badge.check(makeStats({ kudosReceived: 1 }))).toBe(true);
  });
});

describe("kudos-received-25", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "kudos-received-25")!;

  it("not earned with 24 kudos received", () => {
    expect(badge.check(makeStats({ kudosReceived: 24 }))).toBe(false);
  });

  it("earned with exactly 25 kudos received", () => {
    expect(badge.check(makeStats({ kudosReceived: 25 }))).toBe(true);
  });
});

describe("kudos-received-100", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "kudos-received-100")!;

  it("not earned with 99 kudos received", () => {
    expect(badge.check(makeStats({ kudosReceived: 99 }))).toBe(false);
  });

  it("earned with exactly 100 kudos received", () => {
    expect(badge.check(makeStats({ kudosReceived: 100 }))).toBe(true);
  });
});

describe("kudos-received-500", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "kudos-received-500")!;

  it("not earned with 499 kudos received", () => {
    expect(badge.check(makeStats({ kudosReceived: 499 }))).toBe(false);
  });

  it("earned with exactly 500 kudos received", () => {
    expect(badge.check(makeStats({ kudosReceived: 500 }))).toBe(true);
  });
});

describe("kudos-sent-1", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "kudos-sent-1")!;

  it("not earned with 0 kudos sent", () => {
    expect(badge.check(makeStats({ kudosSent: 0 }))).toBe(false);
  });

  it("earned with 1 kudos sent", () => {
    expect(badge.check(makeStats({ kudosSent: 1 }))).toBe(true);
  });
});

describe("kudos-sent-25", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "kudos-sent-25")!;

  it("not earned with 24 kudos sent", () => {
    expect(badge.check(makeStats({ kudosSent: 24 }))).toBe(false);
  });

  it("earned with exactly 25 kudos sent", () => {
    expect(badge.check(makeStats({ kudosSent: 25 }))).toBe(true);
  });
});

describe("kudos-sent-100", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "kudos-sent-100")!;

  it("not earned with 99 kudos sent", () => {
    expect(badge.check(makeStats({ kudosSent: 99 }))).toBe(false);
  });

  it("earned with exactly 100 kudos sent", () => {
    expect(badge.check(makeStats({ kudosSent: 100 }))).toBe(true);
  });
});

describe("kudos-sent-500", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "kudos-sent-500")!;

  it("not earned with 499 kudos sent", () => {
    expect(badge.check(makeStats({ kudosSent: 499 }))).toBe(false);
  });

  it("earned with exactly 500 kudos sent", () => {
    expect(badge.check(makeStats({ kudosSent: 500 }))).toBe(true);
  });
});

describe("comments-received-1", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "comments-received-1")!;

  it("not earned with 0 comments received", () => {
    expect(badge.check(makeStats({ commentsReceived: 0 }))).toBe(false);
  });

  it("earned with 1 comment received", () => {
    expect(badge.check(makeStats({ commentsReceived: 1 }))).toBe(true);
  });
});

describe("comments-received-25", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "comments-received-25")!;

  it("not earned with 24 comments received", () => {
    expect(badge.check(makeStats({ commentsReceived: 24 }))).toBe(false);
  });

  it("earned with exactly 25 comments received", () => {
    expect(badge.check(makeStats({ commentsReceived: 25 }))).toBe(true);
  });
});

describe("comments-received-100", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "comments-received-100")!;

  it("not earned with 99 comments received", () => {
    expect(badge.check(makeStats({ commentsReceived: 99 }))).toBe(false);
  });

  it("earned with exactly 100 comments received", () => {
    expect(badge.check(makeStats({ commentsReceived: 100 }))).toBe(true);
  });
});

describe("comments-received-500", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "comments-received-500")!;

  it("not earned with 499 comments received", () => {
    expect(badge.check(makeStats({ commentsReceived: 499 }))).toBe(false);
  });

  it("earned with exactly 500 comments received", () => {
    expect(badge.check(makeStats({ commentsReceived: 500 }))).toBe(true);
  });
});

describe("comments-sent-1", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "comments-sent-1")!;

  it("not earned with 0 comments sent", () => {
    expect(badge.check(makeStats({ commentsSent: 0 }))).toBe(false);
  });

  it("earned with 1 comment sent", () => {
    expect(badge.check(makeStats({ commentsSent: 1 }))).toBe(true);
  });
});

describe("comments-sent-25", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "comments-sent-25")!;

  it("not earned with 24 comments sent", () => {
    expect(badge.check(makeStats({ commentsSent: 24 }))).toBe(false);
  });

  it("earned with exactly 25 comments sent", () => {
    expect(badge.check(makeStats({ commentsSent: 25 }))).toBe(true);
  });
});

describe("comments-sent-100", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "comments-sent-100")!;

  it("not earned with 99 comments sent", () => {
    expect(badge.check(makeStats({ commentsSent: 99 }))).toBe(false);
  });

  it("earned with exactly 100 comments sent", () => {
    expect(badge.check(makeStats({ commentsSent: 100 }))).toBe(true);
  });
});

describe("comments-sent-500", () => {
  const badge = ACHIEVEMENTS.find((a) => a.slug === "comments-sent-500")!;

  it("not earned with 499 comments sent", () => {
    expect(badge.check(makeStats({ commentsSent: 499 }))).toBe(false);
  });

  it("earned with exactly 500 comments sent", () => {
    expect(badge.check(makeStats({ commentsSent: 500 }))).toBe(true);
  });
});
