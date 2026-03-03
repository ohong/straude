import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PendingPostsNudge } from "@/components/app/feed/PendingPostsNudge";
import type { Post } from "@/types";

// Mock localStorage — jsdom may not provide a full implementation
let store: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
  get length() { return Object.keys(store).length; },
  key: (index: number) => Object.keys(store)[index] ?? null,
};

function makePost(id: string, createdAt: string): Post {
  return {
    id,
    user_id: "user-1",
    daily_usage_id: "usage-1",
    title: null,
    description: null,
    images: [],
    created_at: createdAt,
    updated_at: createdAt,
    daily_usage: {
      id: "usage-1",
      user_id: "user-1",
      date: "2026-03-01",
      cost_usd: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 0,
      models: ["claude-sonnet-4"],
      model_breakdown: null,
      session_count: 1,
      is_verified: false,
      raw_hash: null,
      created_at: createdAt,
      updated_at: createdAt,
    },
  };
}

describe("PendingPostsNudge", () => {
  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reappears when new pending sessions arrive after dismiss", async () => {
    const firstBatch = [makePost("post-1", "2026-03-01T10:00:00.000Z")];
    const { rerender } = render(<PendingPostsNudge posts={firstBatch} />);

    await waitFor(() => {
      expect(screen.getByText("You have 1 session without details")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(
      screen.queryByText("You have 1 session without details"),
    ).not.toBeInTheDocument();

    // Same pending sessions remain dismissed after rerender.
    rerender(<PendingPostsNudge posts={firstBatch} />);
    expect(
      screen.queryByText(/session.*without details/),
    ).not.toBeInTheDocument();

    // A new pending session should make the nudge visible again.
    const secondBatch = [
      ...firstBatch,
      makePost("post-2", "2026-03-02T11:00:00.000Z"),
    ];
    rerender(<PendingPostsNudge posts={secondBatch} />);

    expect(screen.getByText("You have 1 session without details")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /add details/i }),
    ).toHaveAttribute("href", "/post/post-2?edit=1");
  });

  it("persists dismissal across remounts and shows only new posts", async () => {
    const post1 = makePost("post-1", "2026-03-01T10:00:00.000Z");
    const { unmount } = render(<PendingPostsNudge posts={[post1]} />);

    await waitFor(() => {
      expect(screen.getByText("You have 1 session without details")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    unmount();

    // Remount with original + new post — only new post should show
    const post2 = makePost("post-2", "2026-03-02T11:00:00.000Z");
    render(<PendingPostsNudge posts={[post1, post2]} />);

    await waitFor(() => {
      expect(screen.getByText("You have 1 session without details")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /add details/i }),
    ).toHaveAttribute("href", "/post/post-2?edit=1");
  });
});
