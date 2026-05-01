import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedList } from "@/components/app/feed/FeedList";
import type { Post } from "@/types";

vi.mock("@/components/app/feed/ActivityCard", () => ({
  ActivityCard: ({ post }: { post: Post }) => (
    <article data-testid="activity-card">{post.title ?? post.id}</article>
  ),
}));

vi.mock("@/components/app/feed/PendingPostsNudge", () => ({
  PendingPostsNudge: ({ posts }: { posts: Post[] }) => (
    <aside data-testid="pending-posts">{posts.length} pending</aside>
  ),
}));

let intersectionCallback:
  | ((entries: Array<{ isIntersecting: boolean }>) => void)
  | null = null;

class MockIntersectionObserver {
  constructor(callback: typeof intersectionCallback) {
    intersectionCallback = callback;
  }

  observe = vi.fn();
  disconnect = vi.fn();
}

function makePost(id: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    user_id: "user-1",
    daily_usage_id: `usage-${id}`,
    title: `Post ${id}`,
    description: "Session notes",
    images: [],
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-01-01T12:00:00.000Z",
    daily_usage: {
      id: `usage-${id}`,
      user_id: "user-1",
      date: "2026-01-01",
      cost_usd: 1,
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 150,
      models: ["gpt-5.3-codex"],
      model_breakdown: null,
      session_count: 1,
      is_verified: true,
      raw_hash: null,
      created_at: "2026-01-01T12:00:00.000Z",
      updated_at: "2026-01-01T12:00:00.000Z",
    },
    kudos_count: 0,
    kudos_users: [],
    comment_count: 0,
    recent_comments: [],
    has_kudosed: false,
    ...overrides,
  };
}

describe("FeedList", () => {
  beforeEach(() => {
    intersectionCallback = null;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            posts: [],
            next_cursor: null,
            pending_posts: [],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("switches feed tabs through /api/feed and replaces pending posts from the response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          posts: [makePost("following-1", { title: "Following session" })],
          next_cursor: "2026-01-01|2026-01-01T12:00:00.000Z",
          pending_posts: [makePost("pending-1")],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <FeedList
        initialPosts={[makePost("global-1", { title: "Global session" })]}
        userId="user-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /global/i }));
    fireEvent.click(screen.getByRole("button", { name: /following/i }));

    await waitFor(() => {
      expect(screen.getByText("Following session")).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/feed?type=following&limit=20",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByTestId("pending-posts")).toHaveTextContent("1 pending");
    expect(screen.queryByText("Global session")).not.toBeInTheDocument();
  });

  it("uses the server-provided initial cursor for pagination", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          posts: [makePost("page-2", { title: "Second page" })],
          next_cursor: null,
          pending_posts: [],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <FeedList
        initialPosts={[makePost("page-1", { title: "First page" })]}
        initialNextCursor="2026-01-01|2026-01-01T12:00:00.000Z"
        userId="user-1"
      />,
    );

    await act(async () => {
      intersectionCallback?.([{ isIntersecting: true }]);
    });

    await waitFor(() => {
      expect(screen.getByText("Second page")).toBeInTheDocument();
    });

    const request = vi.mocked(fetch).mock.calls[0]?.[0] as URL;
    expect(request.pathname).toBe("/api/feed");
    expect(request.searchParams.get("cursor")).toBe(
      "2026-01-01|2026-01-01T12:00:00.000Z",
    );
    expect(request.searchParams.get("limit")).toBe("20");
  });
});
