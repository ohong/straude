import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(),
}));

import { GET } from "@/app/api/feed/route";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { NextRequest } from "next/server";

function buildChain(terminal: Record<string, any> = {}) {
  const chain: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    ...terminal,
  };
  return chain;
}

function mockSupabase(opts: {
  user?: { id: string } | null;
  posts?: any[];
  postsError?: any;
  kudos?: any[];
  userKudos?: any[];
  comments?: any[];
  profile?: { id: string; is_public: boolean } | null;
  follow?: { id: string } | null;
}) {
  const {
    user = { id: "user-1" },
    posts = [],
    postsError = null,
    kudos = [],
    userKudos,
    comments = [],
    profile = null,
    follow = null,
  } = opts;

  const client: Record<string, any> = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: posts, error: postsError }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "kudos") {
        return buildChain({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: userKudos ?? [],
                error: null,
              }),
            }),
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: kudos,
                  error: null,
                }),
              }),
            }),
          }),
        });
      }
      if (table === "comments") {
        return buildChain({
          select: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: comments,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        });
      }
      if (table === "follows") {
        return buildChain({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: follow,
                  error: null,
                }),
              }),
            }),
          }),
        });
      }
      return buildChain();
    }),
  };

  const serviceClient: Record<string, any> = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "users") {
        return buildChain({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: profile,
                error: null,
              }),
            }),
          }),
        });
      }
      return buildChain();
    }),
  };

  (createClient as any).mockResolvedValue(client);
  (getServiceClient as any).mockReturnValue(serviceClient);
  return client;
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/feed");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/feed", () => {
  it("allows unauthenticated access to global feed", async () => {
    mockSupabase({ user: null, posts: [] });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.posts).toEqual([]);
  });

  it("rejects unauthenticated requests for non-global feed", async () => {
    mockSupabase({ user: null });

    const res = await GET(makeRequest({ type: "following" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("rejects user feed without user_id", async () => {
    mockSupabase({ user: null });

    const res = await GET(makeRequest({ type: "user" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("user_id is required for user feed");
  });

  it("rejects unauthenticated access to a private user feed", async () => {
    mockSupabase({
      user: null,
      profile: { id: "private-user", is_public: false },
    });

    const res = await GET(
      makeRequest({ type: "user", user_id: "private-user" })
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
  });

  it("allows follower access to a private user feed", async () => {
    mockSupabase({
      profile: { id: "private-user", is_public: false },
      follow: { id: "follow-1" },
    });

    const res = await GET(
      makeRequest({ type: "user", user_id: "private-user" })
    );

    expect(res.status).toBe(200);
  });

  it("returns empty array when user follows nobody", async () => {
    mockSupabase({ posts: [] });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.posts).toEqual([]);
    expect(json.next_cursor).toBeUndefined();
  });

  it("returns posts from followed users with enriched fields", async () => {
    const mockPosts = [
      {
        id: "post-1",
        user_id: "followed-1",
        created_at: "2026-01-01T12:00:00Z",
        user: { id: "followed-1", username: "alice" },
        daily_usage: { date: "2026-01-01", cost_usd: 1.5 },
        kudos_count: 5,
        comment_count: 3,
      },
    ];

    mockSupabase({
      posts: mockPosts,
      userKudos: [{ post_id: "post-1" }],
      kudos: [{ post_id: "post-1", user: { avatar_url: null, username: "bob" } }],
      comments: [
        {
          id: "comment-1",
          post_id: "post-1",
          content: "Love this",
          created_at: "2026-01-01T13:00:00Z",
          user: { avatar_url: null, username: "carol" },
        },
      ],
    });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.posts).toHaveLength(1);
    expect(json.posts[0].kudos_count).toBe(5);
    expect(json.posts[0].comment_count).toBe(3);
    expect(json.posts[0].has_kudosed).toBe(true);
    expect(json.posts[0].user.username).toBe("alice");
    expect(json.posts[0].daily_usage.cost_usd).toBe(1.5);
    expect(json.posts[0].kudos_users).toEqual([{ avatar_url: null, username: "bob" }]);
    expect(json.posts[0].recent_comments).toEqual([
      {
        id: "comment-1",
        post_id: "post-1",
        content: "Love this",
        created_at: "2026-01-01T13:00:00Z",
        user: { avatar_url: null, username: "carol" },
      },
    ]);
  });

  it("sets has_kudosed false when user has not kudosed", async () => {
    const mockPosts = [
      {
        id: "post-1",
        user_id: "followed-1",
        created_at: "2026-01-01T12:00:00Z",
        kudos_count: 2,
        comment_count: 0,
      },
    ];

    mockSupabase({ posts: mockPosts, userKudos: [] });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.posts[0].has_kudosed).toBe(false);
  });

  it("includes next_cursor when posts reach limit", async () => {
    const mockPosts = Array.from({ length: 20 }, (_, i) => ({
      id: `post-${i}`,
      user_id: "followed-1",
      created_at: `2026-01-${String(20 - i).padStart(2, "0")}T12:00:00Z`,
      daily_usage: { date: `2026-01-${String(20 - i).padStart(2, "0")}` },
      kudos_count: 0,
      comment_count: 0,
    }));

    mockSupabase({ posts: mockPosts });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.next_cursor).toBeDefined();
    const last = mockPosts[19];
    expect(json.next_cursor).toBe(`${last.daily_usage.date}|${last.created_at}`);
  });
});
