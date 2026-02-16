import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { GET } from "@/app/api/feed/route";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function buildChain(terminal: Record<string, any> = {}) {
  const chain: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
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
  follows?: any[];
  posts?: any[];
  postsError?: any;
  kudos?: any[];
}) {
  const {
    user = { id: "user-1" },
    follows = [],
    posts = [],
    postsError = null,
    kudos = [],
  } = opts;

  let callCount = 0;
  const client: Record<string, any> = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "follows") {
        return buildChain({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: follows,
                error: null,
              }),
            }),
            // Direct chain for follows query
            data: follows,
            error: null,
          }),
        });
      }
      if (table === "posts") {
        return buildChain({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({
                    data: posts,
                    error: postsError,
                  }),
                  // No cursor case
                  then: (resolve: any) =>
                    resolve({ data: posts, error: postsError }),
                }),
              }),
            }),
          }),
        });
      }
      if (table === "kudos") {
        return buildChain({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: kudos,
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
  it("rejects unauthenticated requests", async () => {
    mockSupabase({ user: null });

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns empty array when user follows nobody", async () => {
    // Mock follows query to return empty
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "follows") {
          const c = buildChain();
          c.select.mockReturnValue(c);
          c.eq.mockResolvedValue({ data: [], error: null });
          return c;
        }
        return buildChain();
      }),
    };
    (createClient as any).mockResolvedValue(client);

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
        daily_usage: { cost_usd: 1.5 },
        kudos_count: [{ count: 5 }],
        comment_count: [{ count: 3 }],
      },
    ];

    // Use a more granular mock
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "follows") {
          const c = buildChain();
          c.select.mockReturnValue(c);
          c.eq.mockResolvedValue({
            data: [{ following_id: "followed-1" }],
            error: null,
          });
          return c;
        }
        if (table === "posts") {
          const c = buildChain();
          c.select.mockReturnValue(c);
          c.in.mockReturnValue(c);
          c.order.mockReturnValue(c);
          c.limit.mockResolvedValue({
            data: mockPosts,
            error: null,
          });
          return c;
        }
        if (table === "kudos") {
          const c = buildChain();
          c.select.mockReturnValue(c);
          c.eq.mockReturnValue(c);
          c.in.mockResolvedValue({
            data: [{ post_id: "post-1" }],
            error: null,
          });
          return c;
        }
        return buildChain();
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.posts).toHaveLength(1);
    expect(json.posts[0].kudos_count).toBe(5);
    expect(json.posts[0].comment_count).toBe(3);
    expect(json.posts[0].has_kudosed).toBe(true);
    expect(json.posts[0].user.username).toBe("alice");
    expect(json.posts[0].daily_usage.cost_usd).toBe(1.5);
  });

  it("sets has_kudosed false when user has not kudosed", async () => {
    const mockPosts = [
      {
        id: "post-1",
        user_id: "followed-1",
        created_at: "2026-01-01T12:00:00Z",
        kudos_count: [{ count: 2 }],
        comment_count: [{ count: 0 }],
      },
    ];

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "follows") {
          const c = buildChain();
          c.select.mockReturnValue(c);
          c.eq.mockResolvedValue({
            data: [{ following_id: "followed-1" }],
            error: null,
          });
          return c;
        }
        if (table === "posts") {
          const c = buildChain();
          c.select.mockReturnValue(c);
          c.in.mockReturnValue(c);
          c.order.mockReturnValue(c);
          c.limit.mockResolvedValue({ data: mockPosts, error: null });
          return c;
        }
        if (table === "kudos") {
          const c = buildChain();
          c.select.mockReturnValue(c);
          c.eq.mockReturnValue(c);
          c.in.mockResolvedValue({ data: [], error: null });
          return c;
        }
        return buildChain();
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.posts[0].has_kudosed).toBe(false);
  });

  it("includes next_cursor when posts reach limit", async () => {
    // Default limit is 20, so return 20 posts
    const mockPosts = Array.from({ length: 20 }, (_, i) => ({
      id: `post-${i}`,
      user_id: "followed-1",
      created_at: `2026-01-${String(20 - i).padStart(2, "0")}T12:00:00Z`,
      kudos_count: [{ count: 0 }],
      comment_count: [{ count: 0 }],
    }));

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "follows") {
          const c = buildChain();
          c.select.mockReturnValue(c);
          c.eq.mockResolvedValue({
            data: [{ following_id: "followed-1" }],
            error: null,
          });
          return c;
        }
        if (table === "posts") {
          const c = buildChain();
          c.select.mockReturnValue(c);
          c.in.mockReturnValue(c);
          c.order.mockReturnValue(c);
          c.limit.mockResolvedValue({ data: mockPosts, error: null });
          return c;
        }
        if (table === "kudos") {
          const c = buildChain();
          c.select.mockReturnValue(c);
          c.eq.mockReturnValue(c);
          c.in.mockResolvedValue({ data: [], error: null });
          return c;
        }
        return buildChain();
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.next_cursor).toBeDefined();
    expect(json.next_cursor).toBe(mockPosts[19].created_at);
  });
});
