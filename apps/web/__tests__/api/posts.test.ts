import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { username: "author" }, error: null }),
    }),
    auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null } }) } },
  })),
}));
vi.mock("@/lib/email/send-comment-email", () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { GET, PATCH, DELETE } from "@/app/api/posts/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function buildChain(overrides: Record<string, any> = {}) {
  const chain: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: null, error: null }),
    ...overrides,
  };
  return chain;
}

function mockSupabase(opts: {
  user?: { id: string } | null;
  tableHandlers?: Record<string, (c: Record<string, any>) => void>;
}) {
  const { user = { id: "user-1" }, tableHandlers = {} } = opts;

  const client: Record<string, any> = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      const chain = buildChain();
      if (tableHandlers[table]) {
        tableHandlers[table](chain);
      }
      return chain;
    }),
  };

  (createClient as any).mockResolvedValue(client);
  return client;
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(
  method: string,
  body?: any
) {
  const url = new URL("http://localhost/api/posts/post-1");
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/posts/[id]", () => {
  it("returns full post with joins", async () => {
    const postData = {
      id: "post-1",
      user_id: "user-2",
      title: "Morning session",
      user: { id: "user-2", username: "alice" },
      daily_usage: { cost_usd: 2.5 },
      kudos_count: [{ count: 10 }],
      comment_count: [{ count: 3 }],
    };

    mockSupabase({
      user: { id: "user-1" },
      tableHandlers: {
        posts: (c) => {
          c.single.mockResolvedValue({ data: postData, error: null });
        },
        kudos: (c) => {
          c.maybeSingle.mockResolvedValue({ data: { id: "k1" }, error: null });
        },
      },
    });

    const res = await GET(makeRequest("GET"), makeContext("post-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("post-1");
    expect(json.kudos_count).toBe(10);
    expect(json.comment_count).toBe(3);
    expect(json.has_kudosed).toBe(true);
    expect(json.user.username).toBe("alice");
  });

  it("returns 404 for non-existent post", async () => {
    mockSupabase({
      tableHandlers: {
        posts: (c) => {
          c.single.mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          });
        },
      },
    });

    const res = await GET(makeRequest("GET"), makeContext("nonexistent"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Post not found");
  });

  it("sets has_kudosed false when no authenticated user", async () => {
    const postData = {
      id: "post-1",
      kudos_count: [{ count: 0 }],
      comment_count: [{ count: 0 }],
    };

    mockSupabase({
      user: null,
      tableHandlers: {
        posts: (c) => {
          c.single.mockResolvedValue({ data: postData, error: null });
        },
      },
    });

    const res = await GET(makeRequest("GET"), makeContext("post-1"));
    const json = await res.json();

    expect(json.has_kudosed).toBe(false);
  });
});

describe("PATCH /api/posts/[id]", () => {
  it("updates title and description", async () => {
    const updatedPost = {
      id: "post-1",
      title: "Updated title",
      description: "Updated desc",
    };

    mockSupabase({
      user: { id: "user-1" },
      tableHandlers: {
        posts: (c) => {
          c.single.mockResolvedValue({ data: updatedPost, error: null });
        },
      },
    });

    const res = await PATCH(
      makeRequest("PATCH", { title: "Updated title", description: "Updated desc" }),
      makeContext("post-1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe("Updated title");
    expect(json.description).toBe("Updated desc");
  });

  it("rejects update from non-owner (returns 404)", async () => {
    mockSupabase({
      user: { id: "user-1" },
      tableHandlers: {
        posts: (c) => {
          // eq("user_id", user.id) filters out non-owner, so single returns null
          c.single.mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          });
        },
      },
    });

    const res = await PATCH(
      makeRequest("PATCH", { title: "Hack" }),
      makeContext("post-1")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Post not found or not yours");
  });

  it("rejects unauthenticated PATCH", async () => {
    mockSupabase({ user: null });

    const res = await PATCH(
      makeRequest("PATCH", { title: "Test" }),
      makeContext("post-1")
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("does not insert mention notifications when only images change", async () => {
    const insertFn = vi.fn().mockReturnValue({ then: (r: any) => r({ error: null }) });

    const client = mockSupabase({
      user: { id: "user-1" },
      tableHandlers: {
        posts: (c) => {
          c.single.mockResolvedValue({
            data: { id: "post-1", description: "hey @alice check this", title: "T" },
            error: null,
          });
        },
      },
    });

    // Wire up users + notifications so that removing the gate would reach insert
    const originalFrom = client.from;
    client.from = vi.fn().mockImplementation((table: string) => {
      if (table === "users") {
        const chain = buildChain();
        chain.in.mockResolvedValue({
          data: [{ id: "alice-id", username: "alice" }],
          error: null,
        });
        return chain;
      }
      if (table === "notifications") {
        return {
          insert: insertFn,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return originalFrom(table);
    });

    // Only images in the body — no description
    const res = await PATCH(
      makeRequest("PATCH", { images: ["img1.jpg"] }),
      makeContext("post-1")
    );

    expect(res.status).toBe(200);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("skips notification query when mentioned users do not exist", async () => {
    const notificationFrom = vi.fn();

    const client = mockSupabase({
      user: { id: "user-1" },
      tableHandlers: {
        posts: (c) => {
          c.single.mockResolvedValue({
            data: { id: "post-1", description: "hey @ghost check this", title: "T" },
            error: null,
          });
        },
      },
    });

    const originalFrom = client.from;
    client.from = vi.fn().mockImplementation((table: string) => {
      if (table === "users") {
        const chain = buildChain();
        // No matching users found in the database
        chain.in.mockResolvedValue({ data: [], error: null });
        return chain;
      }
      if (table === "notifications") {
        notificationFrom();
        return buildChain();
      }
      return originalFrom(table);
    });

    const res = await PATCH(
      makeRequest("PATCH", { description: "hey @ghost check this" }),
      makeContext("post-1")
    );

    expect(res.status).toBe(200);
    expect(notificationFrom).not.toHaveBeenCalled();
  });

  it("inserts mention notifications for new mentions in description", async () => {
    const insertFn = vi.fn().mockReturnValue({ then: (r: any) => r({ error: null }) });

    const client = mockSupabase({
      user: { id: "user-1" },
      tableHandlers: {
        posts: (c) => {
          c.single.mockResolvedValue({
            data: { id: "post-1", description: "hey @alice great work", title: null },
            error: null,
          });
        },
      },
    });

    const originalFrom = client.from;
    client.from = vi.fn().mockImplementation((table: string) => {
      if (table === "users") {
        const chain = buildChain();
        chain.in.mockResolvedValue({
          data: [{ id: "alice-id", username: "alice" }],
          error: null,
        });
        return chain;
      }
      if (table === "notifications") {
        return {
          insert: insertFn,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return originalFrom(table);
    });

    const res = await PATCH(
      makeRequest("PATCH", { description: "hey @alice great work" }),
      makeContext("post-1")
    );

    expect(res.status).toBe(200);
    expect(insertFn).toHaveBeenCalledWith([
      { user_id: "alice-id", actor_id: "user-1", type: "mention", post_id: "post-1" },
    ]);
  });

  it("skips mention notification for already-notified users", async () => {
    const insertFn = vi.fn().mockReturnValue({ then: (r: any) => r({ error: null }) });

    const client = mockSupabase({
      user: { id: "user-1" },
      tableHandlers: {
        posts: (c) => {
          c.single.mockResolvedValue({
            data: { id: "post-1", description: "hey @alice great work", title: null },
            error: null,
          });
        },
      },
    });

    const originalFrom = client.from;
    client.from = vi.fn().mockImplementation((table: string) => {
      if (table === "users") {
        const chain = buildChain();
        chain.in.mockResolvedValue({
          data: [{ id: "alice-id", username: "alice" }],
          error: null,
        });
        return chain;
      }
      if (table === "notifications") {
        return {
          insert: insertFn,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ user_id: "alice-id" }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return originalFrom(table);
    });

    const res = await PATCH(
      makeRequest("PATCH", { description: "hey @alice great work" }),
      makeContext("post-1")
    );

    expect(res.status).toBe(200);
    expect(insertFn).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/posts/[id]", () => {
  it("removes post successfully", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ error: null }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await DELETE(makeRequest("DELETE"), makeContext("post-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("rejects unauthenticated DELETE", async () => {
    mockSupabase({ user: null });

    const res = await DELETE(makeRequest("DELETE"), makeContext("post-1"));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 500 on delete error", async () => {
    mockSupabase({
      user: { id: "user-1" },
      tableHandlers: {
        posts: (c) => {
          // delete().eq().eq() returns error
          c.eq.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              error: { message: "FK constraint" },
            }),
          });
        },
      },
    });

    // The actual route uses chained .eq().eq(), so we need a deeper mock
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              error: { message: "FK constraint" },
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await DELETE(makeRequest("DELETE"), makeContext("post-1"));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("FK constraint");
  });
});
