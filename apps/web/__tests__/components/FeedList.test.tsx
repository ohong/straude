import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

vi.mock("@/lib/analytics/client", () => ({
  trackActivationEvent: vi.fn(),
}));

import { trackActivationEvent } from "@/lib/analytics/client";

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
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
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

  it("shows a copyable first-sync command for the signed-in empty sessions feed", async () => {
    render(
      <FeedList
        initialPosts={[]}
        userId="user-1"
        feedType="mine"
      />,
    );

    const emptyState = screen.getByRole("region", { name: /sync your first session/i });
    expect(within(emptyState).getByText("Sync your first session")).toBeInTheDocument();
    expect(within(emptyState).getByText("npx straude@latest")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copy first sync command/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("npx straude@latest");
    });
    expect(trackActivationEvent).toHaveBeenCalledWith("sync_command_copied", expect.objectContaining({
      surface: "empty_state",
      cta_location: "feed_empty_state",
      command: "npx straude@latest",
    }));
  });

  it("shows a contextual signup CTA after guest feed content", () => {
    render(
      <FeedList
        initialPosts={[
          makePost("guest-1", { title: "First public session" }),
          makePost("guest-2", { title: "Second public session" }),
        ]}
        userId={null}
      />,
    );

    const cta = screen.getByRole("link", { name: /start your streak/i });
    expect(cta).toHaveAttribute("href", "/signup");

    cta.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(cta);

    expect(trackActivationEvent).toHaveBeenCalledWith("guest_signup_cta_clicked", expect.objectContaining({
      surface: "feed",
      cta_location: "feed_after_posts",
      destination: "/signup",
    }));
  });
});
