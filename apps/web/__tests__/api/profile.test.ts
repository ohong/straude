import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/constants/regions", () => ({
  COUNTRY_TO_REGION: {
    US: "north_america",
    GB: "europe",
    JP: "asia",
  },
}));

import { GET } from "@/app/api/users/[username]/route";
import { PATCH } from "@/app/api/users/me/route";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function makeContext(username: string) {
  return { params: Promise.resolve({ username }) };
}

function makeRequest(method: string, url: string, body?: any) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/users/[username]", () => {
  it("returns profile with stats", async () => {
    const profile = {
      id: "u-1",
      username: "alice",
      is_public: true,
      region: "north_america",
    };

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "viewer-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: profile,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "follows") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "daily_usage") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ cost_usd: 5 }, { cost_usd: 10 }],
                error: null,
              }),
            }),
          };
        }
        if (table === "posts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 3 }),
            }),
          };
        }
        if (table === "leaderboard_weekly") {
          return {
            select: vi.fn().mockImplementation((sel: string, opts?: any) => {
              if (opts?.count) {
                return {
                  gt: vi.fn().mockResolvedValue({ count: 2 }),
                  eq: vi.fn().mockReturnValue({
                    gt: vi.fn().mockResolvedValue({ count: 0 }),
                  }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { total_cost: 15 },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0, data: [] }),
          }),
        };
      }),
      rpc: vi.fn().mockResolvedValue({ data: 7, error: null }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await GET(
      makeRequest("GET", "/api/users/alice"),
      makeContext("alice")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.username).toBe("alice");
    expect(json.streak).toBe(7);
    expect(json.total_cost).toBe(15);
  });

  it("returns 404 for non-existent username", async () => {
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
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await GET(
      makeRequest("GET", "/api/users/nobody"),
      makeContext("nobody")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("User not found");
  });
});

describe("PATCH /api/users/me", () => {
  it("updates profile fields", async () => {
    const updatedProfile = {
      id: "u-1",
      username: "new_name",
      bio: "New bio",
    };

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updatedProfile,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", {
        username: "new_name",
        bio: "New bio",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.username).toBe("new_name");
  });

  it("validates username format", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);

    // Too short
    let res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { username: "ab" })
    );
    let json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toContain("3-20 alphanumeric");

    // Invalid chars
    res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { username: "bad user!" })
    );
    json = await res.json();
    expect(res.status).toBe(400);

    // Too long
    res = await PATCH(
      makeRequest("PATCH", "/api/users/me", {
        username: "a".repeat(21),
      })
    );
    json = await res.json();
    expect(res.status).toBe(400);
  });

  it("validates bio length (max 160)", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { bio: "x".repeat(161) })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("160 characters");
  });

  it("auto-derives region from country", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "u-1", country: "US", region: "north_america" },
            error: null,
          }),
        }),
      }),
    });

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({ update: updateMock }),
    };
    (createClient as any).mockResolvedValue(client);

    await PATCH(
      makeRequest("PATCH", "/api/users/me", { country: "US" })
    );

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        country: "US",
        region: "north_america",
      })
    );
  });

  it("rejects duplicate username (409)", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "23505", message: "unique violation" },
              }),
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { username: "taken_name" })
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("Username already taken");
  });

  it("rejects unauthenticated request", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(client);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { bio: "hi" })
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("rejects empty update", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u-1" } },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await PATCH(
      makeRequest("PATCH", "/api/users/me", { nonexistent_field: "value" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("No fields to update");
  });
});
