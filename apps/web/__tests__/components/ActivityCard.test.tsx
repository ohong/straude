import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityCard } from "@/components/app/feed/ActivityCard";

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    user_id: "user-1",
    daily_usage_id: "usage-1",
    title: "Session",
    description: null,
    images: [],
    created_at: "2026-02-28T12:00:00.000Z",
    updated_at: "2026-02-28T12:00:00.000Z",
    user: {
      id: "user-1",
      username: "alice",
      display_name: "Alice",
      bio: null,
      avatar_url: null,
      country: null,
      region: null,
      link: null,
      github_username: null,
      is_public: true,
      timezone: "America/Vancouver",
      email_notifications: true,
      email_mention_notifications: true,
      streak_freezes: 0,
      created_at: "2026-02-01T00:00:00.000Z",
      updated_at: "2026-02-01T00:00:00.000Z",
    },
    daily_usage: {
      id: "usage-1",
      user_id: "user-1",
      date: "2026-02-28",
      cost_usd: 13,
      input_tokens: 3000,
      output_tokens: 1300,
      cache_creation_tokens: 100,
      cache_read_tokens: 50,
      total_tokens: 4450,
      models: ["claude-opus-4-20250505", "gpt-5-codex"],
      model_breakdown: [
        { model: "claude-opus-4-20250505", cost_usd: 10 },
        { model: "gpt-5-codex", cost_usd: 3 },
      ],
      session_count: 1,
      is_verified: true,
      raw_hash: "abc",
      created_at: "2026-02-28T12:00:00.000Z",
      updated_at: "2026-02-28T12:00:00.000Z",
    },
    kudos_count: 0,
    comment_count: 0,
    kudos_users: [],
    recent_comments: [],
    has_kudosed: false,
    ...overrides,
  };
}

describe("ActivityCard", () => {
  it("renders merged Claude + Codex breakdown labels in session summary", () => {
    render(<ActivityCard post={makePost() as any} />);

    expect(screen.getByText("77% Claude Opus, 23% GPT-5-Codex")).toBeInTheDocument();
  });

  it("renders Codex-only model with full model name in session summary", () => {
    render(
      <ActivityCard
        post={makePost({
          daily_usage: {
            ...makePost().daily_usage,
            models: ["gpt-5-codex"],
            model_breakdown: [{ model: "gpt-5-codex", cost_usd: 3.2 }],
          },
        }) as any}
      />
    );

    expect(screen.getByText("100% GPT-5-Codex")).toBeInTheDocument();
  });

  it("renders GPT-5.3-Codex with full version name in session summary", () => {
    render(
      <ActivityCard
        post={makePost({
          daily_usage: {
            ...makePost().daily_usage,
            models: ["gpt-5.3-codex"],
            model_breakdown: [{ model: "gpt-5.3-codex", cost_usd: 4 }],
          },
        }) as any}
      />
    );

    expect(screen.getByText("100% GPT-5.3-Codex")).toBeInTheDocument();
  });
});
