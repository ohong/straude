import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CommentThread } from "@/components/app/post/CommentThread";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mockCreatedComment(
  username: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "comment-1",
    post_id: "post-1",
    user_id: "user-1",
    parent_comment_id: null,
    content: "Shipped a fix for this.",
    created_at: "2026-03-01T12:00:00.000Z",
    updated_at: "2026-03-01T12:00:00.000Z",
    reaction_count: 0,
    has_reacted: false,
    reply_count: 0,
    user: { username, avatar_url: null },
    ...overrides,
  };
}

describe("CommentThread", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the logged-in username immediately for optimistic comments", async () => {
    const pending = deferred<any>();
    vi.spyOn(global, "fetch" as any).mockReturnValue(pending.promise);

    render(
      <CommentThread
        postId="post-1"
        initialComments={[]}
        userId="user-1"
        currentUser={{ username: "alice", avatar_url: null }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/add a comment/i), {
      target: { value: "Shipped a fix for this." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(screen.getByRole("button", { name: "Post..." })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
      expect(screen.queryByText("anonymous")).not.toBeInTheDocument();
    });

    await act(async () => {
      pending.resolve({
        ok: true,
        json: async () => mockCreatedComment("alice"),
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Post" })).toBeInTheDocument();
    });
  });

  it("never shows anonymous for optimistic self-comments when profile data is missing", async () => {
    const pending = deferred<any>();
    vi.spyOn(global, "fetch" as any).mockReturnValue(pending.promise);

    render(
      <CommentThread
        postId="post-1"
        initialComments={[]}
        userId="user-1"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/add a comment/i), {
      target: { value: "Shipped a fix for this." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    expect(screen.getByRole("button", { name: "Post..." })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("you")).toBeInTheDocument();
      expect(screen.queryByText("anonymous")).not.toBeInTheDocument();
    });

    await act(async () => {
      pending.resolve({
        ok: true,
        json: async () => mockCreatedComment("alice"),
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
    });
  });

  it("keeps replies in the same thread when replying to a nested comment", async () => {
    const fetchMock = vi.spyOn(global, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () =>
        mockCreatedComment("alice", {
          id: "comment-3",
          user_id: "user-1",
          parent_comment_id: "comment-1",
          content: "@carol totally",
        }),
    });

    render(
      <CommentThread
        postId="post-1"
        initialComments={[
          {
            id: "comment-1",
            post_id: "post-1",
            user_id: "user-2",
            parent_comment_id: null,
            content: "Top-level thought",
            created_at: "2026-03-01T12:00:00.000Z",
            updated_at: "2026-03-01T12:00:00.000Z",
            reaction_count: 0,
            has_reacted: false,
            reply_count: 1,
            user: { username: "bob", avatar_url: null } as any,
          },
          {
            id: "comment-2",
            post_id: "post-1",
            user_id: "user-3",
            parent_comment_id: "comment-1",
            content: "Nested reply",
            created_at: "2026-03-01T12:05:00.000Z",
            updated_at: "2026-03-01T12:05:00.000Z",
            reaction_count: 0,
            has_reacted: false,
            reply_count: 0,
            user: { username: "carol", avatar_url: null } as any,
          },
        ]}
        userId="user-1"
        currentUser={{ username: "alice", avatar_url: null }}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Reply" })[1]!);

    const replyBox = document.getElementById("reply-box-comment-2");
    expect(replyBox).not.toBeNull();

    const replyInput = within(replyBox!).getByPlaceholderText(/reply to @carol/i);
    fireEvent.change(replyInput, { target: { value: "@carol totally" } });
    fireEvent.click(within(replyBox!).getByRole("button", { name: "Reply" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/posts/post-1/comments",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            content: "@carol totally",
            parent_comment_id: "comment-1",
          }),
        }),
      );
    });

    const matches = await screen.findAllByText(
      (_, node) => node?.textContent === "@carol totally"
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  it("toggles comment reactions optimistically", async () => {
    const pending = deferred<any>();
    vi.spyOn(global, "fetch" as any).mockReturnValue(pending.promise);

    render(
      <CommentThread
        postId="post-1"
        initialComments={[
          {
            id: "comment-1",
            post_id: "post-1",
            user_id: "user-2",
            parent_comment_id: null,
            content: "Nice one",
            created_at: "2026-03-01T12:00:00.000Z",
            updated_at: "2026-03-01T12:00:00.000Z",
            reaction_count: 0,
            has_reacted: false,
            reply_count: 0,
            user: { username: "bob", avatar_url: null } as any,
          },
        ]}
        userId="user-1"
        currentUser={{ username: "alice", avatar_url: null }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /like comment/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /unlike comment/i })).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    await act(async () => {
      pending.resolve({
        ok: true,
        json: async () => ({ reacted: true, count: 1 }),
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/comments/comment-1/reactions",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
