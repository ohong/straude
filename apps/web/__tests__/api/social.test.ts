import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { POST as followPOST, DELETE as followDELETE } from "@/app/api/follow/[username]/route";
import {
  POST as kudosPOST,
  DELETE as kudosDELETE,
  GET as kudosGET,
} from "@/app/api/posts/[id]/kudos/route";
import {
  POST as commentPOST,
  GET as commentGET,
} from "@/app/api/posts/[id]/comments/route";
import {
  PATCH as commentPATCH,
  DELETE as commentDELETE,
} from "@/app/api/comments/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function makeContext(key: string, value: string) {
  return { params: Promise.resolve({ [key]: value }) };
}

function makeRequest(
  method: string,
  url: string,
  body?: any
) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------- Follow ----------

describe("POST /api/follow/[username]", () => {
  it("creates a follow relationship", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "target-user" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "follows") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await followPOST(
      makeRequest("POST", "/api/follow/alice"),
      makeContext("username", "alice")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.following).toBe(true);
  });

  it("returns error when trying to follow yourself", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "user-1" }, // same as auth user
              error: null,
            }),
          }),
        }),
      })),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await followPOST(
      makeRequest("POST", "/api/follow/myself"),
      makeContext("username", "myself")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Cannot follow yourself");
  });

  it("returns 404 for non-existent user", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await followPOST(
      makeRequest("POST", "/api/follow/nobody"),
      makeContext("username", "nobody")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("User not found");
  });
});

describe("DELETE /api/follow/[username]", () => {
  it("removes a follow relationship", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "target-user" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "follows") {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await followDELETE(
      makeRequest("DELETE", "/api/follow/alice"),
      makeContext("username", "alice")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.following).toBe(false);
  });
});

// ---------- Kudos ----------

describe("POST /api/posts/[id]/kudos", () => {
  it("creates a kudos", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "kudos") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5 }),
            }),
          };
        }
        return {};
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await kudosPOST(
      makeRequest("POST", "/api/posts/post-1/kudos"),
      makeContext("id", "post-1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.kudosed).toBe(true);
    expect(json.count).toBe(5);
  });
});

describe("DELETE /api/posts/[id]/kudos", () => {
  it("removes a kudos", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "kudos") {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 3 }),
            }),
          };
        }
        return {};
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await kudosDELETE(
      makeRequest("DELETE", "/api/posts/post-1/kudos"),
      makeContext("id", "post-1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.kudosed).toBe(false);
    expect(json.count).toBe(3);
  });
});

describe("GET /api/posts/[id]/kudos", () => {
  it("lists users who kudosed", async () => {
    const mockKudos = [
      {
        id: "k-1",
        created_at: "2026-01-01T12:00:00Z",
        user: { id: "u-1", username: "alice" },
      },
    ];

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockKudos,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await kudosGET(
      makeRequest("GET", "/api/posts/post-1/kudos"),
      makeContext("id", "post-1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toHaveLength(1);
    expect(json.users[0].username).toBe("alice");
  });
});

// ---------- Comments ----------

describe("POST /api/posts/[id]/comments", () => {
  it("creates a comment", async () => {
    const mockComment = {
      id: "c-1",
      content: "Great work!",
      user: { id: "user-1", username: "bob" },
    };

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockComment,
              error: null,
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await commentPOST(
      makeRequest("POST", "/api/posts/post-1/comments", {
        content: "Great work!",
      }),
      makeContext("id", "post-1")
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.content).toBe("Great work!");
  });

  it("validates 500 char max", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);

    const longContent = "x".repeat(501);
    const res = await commentPOST(
      makeRequest("POST", "/api/posts/post-1/comments", {
        content: longContent,
      }),
      makeContext("id", "post-1")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("at most 500 characters");
  });

  it("rejects empty content", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await commentPOST(
      makeRequest("POST", "/api/posts/post-1/comments", { content: "" }),
      makeContext("id", "post-1")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
  });
});

describe("GET /api/posts/[id]/comments", () => {
  it("lists comments in ascending order", async () => {
    const mockComments = [
      { id: "c-1", created_at: "2026-01-01T10:00:00Z", content: "first" },
      { id: "c-2", created_at: "2026-01-01T11:00:00Z", content: "second" },
    ];

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockComments,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await commentGET(
      makeRequest("GET", "/api/posts/post-1/comments"),
      makeContext("id", "post-1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.comments).toHaveLength(2);
    expect(json.comments[0].content).toBe("first");
  });
});

// ---------- Comment edit/delete ----------

describe("PATCH /api/comments/[id]", () => {
  it("edits own comment", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "c-1", content: "edited" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await commentPATCH(
      makeRequest("PATCH", "/api/comments/c-1", { content: "edited" }),
      makeContext("id", "c-1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.content).toBe("edited");
  });

  it("returns 404 for non-owner edit (comment not found or not yours)", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: "PGRST116" },
                }),
              }),
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await commentPATCH(
      makeRequest("PATCH", "/api/comments/c-1", { content: "hack" }),
      makeContext("id", "c-1")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Comment not found or not yours");
  });

  it("validates content length on PATCH", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await commentPATCH(
      makeRequest("PATCH", "/api/comments/c-1", { content: "x".repeat(501) }),
      makeContext("id", "c-1")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("at most 500 characters");
  });
});

describe("DELETE /api/comments/[id]", () => {
  it("deletes own comment", async () => {
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

    const res = await commentDELETE(
      makeRequest("DELETE", "/api/comments/c-1"),
      makeContext("id", "c-1")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("rejects unauthenticated DELETE", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(client);

    const res = await commentDELETE(
      makeRequest("DELETE", "/api/comments/c-1"),
      makeContext("id", "c-1")
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });
});
