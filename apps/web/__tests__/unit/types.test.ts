import { describe, it, expect } from "vitest";
import type {
  User,
  Post,
  DailyUsage,
  Comment,
  CcusageOutput,
  CcusageDailyEntry,
  UsageSubmitRequest,
  UsageSubmitResponse,
} from "@/types";

describe("type shapes", () => {
  it("User object has expected fields", () => {
    const user: User = {
      id: "u1",
      username: "alice",
      display_name: "Alice",
      bio: "Hello",
      avatar_url: "https://example.com/avatar.png",
      country: "US",
      region: "north_america",
      link: "https://alice.dev",
      github_username: "alice",
      is_public: true,
      timezone: "America/New_York",
      email_notifications: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
    expect(user.id).toBe("u1");
    expect(user.is_public).toBe(true);
    expect(user.timezone).toBe("America/New_York");
  });

  it("User allows null optional fields", () => {
    const user: User = {
      id: "u2",
      username: null,
      display_name: null,
      bio: null,
      avatar_url: null,
      country: null,
      region: null,
      link: null,
      github_username: null,
      is_public: false,
      timezone: "UTC",
      email_notifications: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
    expect(user.username).toBeNull();
    expect(user.is_public).toBe(false);
  });

  it("DailyUsage object has expected fields", () => {
    const usage: DailyUsage = {
      id: "d1",
      user_id: "u1",
      date: "2025-06-01",
      cost_usd: 12.5,
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_tokens: 200,
      cache_read_tokens: 100,
      total_tokens: 1800,
      models: ["claude-sonnet-4-5-20250514"],
      session_count: 3,
      is_verified: true,
      raw_hash: "abc123",
      created_at: "2025-06-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
    };
    expect(usage.cost_usd).toBe(12.5);
    expect(usage.models).toContain("claude-sonnet-4-5-20250514");
    expect(usage.is_verified).toBe(true);
  });

  it("Post object has expected fields including optional joined fields", () => {
    const post: Post = {
      id: "p1",
      user_id: "u1",
      daily_usage_id: "d1",
      title: "My day",
      description: "Lots of coding",
      images: ["img1.png"],
      created_at: "2025-06-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
      kudos_count: 5,
      comment_count: 2,
      has_kudosed: false,
    };
    expect(post.images).toHaveLength(1);
    expect(post.kudos_count).toBe(5);
  });

  it("Comment object has expected fields", () => {
    const comment: Comment = {
      id: "c1",
      user_id: "u1",
      post_id: "p1",
      content: "Nice!",
      created_at: "2025-06-01T00:00:00Z",
      updated_at: "2025-06-01T00:00:00Z",
    };
    expect(comment.content).toBe("Nice!");
  });

  it("CcusageDailyEntry has expected fields", () => {
    const entry: CcusageDailyEntry = {
      date: "2025-06-01",
      models: ["claude-sonnet-4-5-20250514"],
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 200,
      cacheReadTokens: 100,
      totalTokens: 1800,
      costUSD: 0.05,
    };
    expect(entry.costUSD).toBe(0.05);
    expect(entry.totalTokens).toBe(1800);
  });

  it("CcusageOutput has expected shape", () => {
    const output: CcusageOutput = {
      type: "daily",
      data: [],
      summary: {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreationTokens: 0,
        totalCacheReadTokens: 0,
        totalTokens: 0,
        totalCostUSD: 0,
      },
    };
    expect(output.type).toBe("daily");
    expect(output.data).toEqual([]);
  });

  it("UsageSubmitRequest has expected shape", () => {
    const req: UsageSubmitRequest = {
      entries: [
        {
          date: "2025-06-01",
          data: {
            date: "2025-06-01",
            models: [],
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            totalTokens: 0,
            costUSD: 0,
          },
        },
      ],
      hash: "abc",
      source: "cli",
    };
    expect(req.source).toBe("cli");
    expect(req.entries).toHaveLength(1);
  });

  it("UsageSubmitResponse has expected shape", () => {
    const res: UsageSubmitResponse = {
      results: [
        {
          date: "2025-06-01",
          usage_id: "u1",
          post_id: "p1",
          post_url: "https://straude.com/p/p1",
          action: "created",
        },
      ],
    };
    expect(res.results).toHaveLength(1);
    expect(res.results[0]!.post_url).toContain("straude.com");
    expect(res.results[0]!.action).toBe("created");
  });
});
