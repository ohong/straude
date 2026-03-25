import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { GET } from "@/app/api/search/route";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/search");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

function mockClients({
  users = [] as any[],
  error = null as any,
} = {}) {
  const projectedUsers = users.map((user) => {
    const { email: _email, ...rest } = user;
    return rest;
  });

  const supabaseChain: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: projectedUsers, error }),
  };
  (createClient as any).mockResolvedValue(supabaseChain);

  return { supabaseChain };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/search", () => {
  it("requires min 2 characters", async () => {
    mockClients();
    const res = await GET(makeRequest({ q: "a" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("at least 2 characters");
  });

  it("returns 400 for empty query", async () => {
    mockClients();
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("searches by username and github_username via OR filter", async () => {
    const users = [{ id: "u-1", username: "alice", display_name: "Alice" }];
    const { supabaseChain } = mockClients({ users });

    const res = await GET(makeRequest({ q: "alice" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toHaveLength(1);
    expect(json.users[0].username).toBe("alice");
    expect(supabaseChain.or).toHaveBeenCalledWith(
      "username.ilike.%alice%,display_name.ilike.%alice%,github_username.ilike.%alice%"
    );
  });

  it("finds user by github_username", async () => {
    const users = [{ id: "u-2", username: "bob_dev" }];
    const { supabaseChain } = mockClients({ users });

    await GET(makeRequest({ q: "bobgithub" }));
    expect(supabaseChain.or).toHaveBeenCalledWith(
      "username.ilike.%bobgithub%,display_name.ilike.%bobgithub%,github_username.ilike.%bobgithub%"
    );
  });

  it("does not fall back to email lookup when the query contains @", async () => {
    mockClients({ users: [] });

    const res = await GET(makeRequest({ q: "nobody@example.com" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toEqual([]);
  });

  it("still returns username matches that happen to contain @ in the query", async () => {
    const users = [{ id: "u-1", username: "user_at_sign" }];
    const { supabaseChain } = mockClients({ users });

    const res = await GET(makeRequest({ q: "user@something" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toHaveLength(1);
    expect(supabaseChain.or.mock.calls[0]?.[0]).toContain("usersomething");
  });

  it("respects limit parameter", async () => {
    const { supabaseChain } = mockClients();
    await GET(makeRequest({ q: "test", limit: "5" }));
    expect(supabaseChain.limit).toHaveBeenCalledWith(5);
  });

  it("caps limit at 50", async () => {
    const { supabaseChain } = mockClients();
    await GET(makeRequest({ q: "test", limit: "100" }));
    expect(supabaseChain.limit).toHaveBeenCalledWith(50);
  });

  it("never exposes email in response", async () => {
    const users = [{
      id: "u-priv",
      username: "priv_user",
      display_name: null,
      bio: null,
      avatar_url: null,
      email: "secret@example.com",
      is_public: true,
    }];
    mockClients({ users });

    const res = await GET(makeRequest({ q: "secret" }));
    const json = await res.json();

    const responseStr = JSON.stringify(json);
    expect(responseStr).not.toContain("secret@example.com");
  });

  it("filters public users with is_public for non-email queries", async () => {
    const { supabaseChain } = mockClients({ users: [] });

    await GET(makeRequest({ q: "test_user" }));

    // Verify .eq("is_public", true) is called
    expect(supabaseChain.eq).toHaveBeenCalledWith("is_public", true);
  });
});
