import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(),
}));

import { GET } from "@/app/api/search/route";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { NextRequest } from "next/server";

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/search");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

/**
 * Chainable mock matching the search route's query pattern:
 *   supabase: .from().select().eq().or().limit()  (username search)
 *   service:  .rpc()  →  returns userId
 *             .from().select().eq().maybeSingle()  →  returns user profile
 */
function mockClients({
  users = [] as any[],
  error = null as any,
  rpcResult = null as string | null,
  emailUser = null as any,
} = {}) {
  // Regular client — username/display_name search
  const supabaseChain: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: users, error }),
  };
  (createClient as any).mockResolvedValue(supabaseChain);

  // Service client — email lookup (bypasses RLS)
  const maybeSingle = vi.fn().mockResolvedValue({ data: emailUser });
  const eqForEmail = vi.fn().mockReturnValue({ maybeSingle });
  const serviceChain: any = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqForEmail }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: rpcResult }),
  };
  (getServiceClient as any).mockReturnValue(serviceChain);

  return { supabaseChain, serviceChain };
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

  it("searches by email via service client RPC when query contains @", async () => {
    const emailUser = {
      id: "u-email",
      username: null,
      display_name: null,
      bio: null,
      avatar_url: "https://example.com/avatar.jpg",
      is_public: true,
    };
    const { serviceChain } = mockClients({
      users: [],           // username search returns nothing
      rpcResult: "u-email", // RPC finds the auth user
      emailUser,            // profile lookup returns the user
    });

    const res = await GET(makeRequest({ q: "mark@example.com" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toHaveLength(1);
    expect(json.users[0].id).toBe("u-email");
    // RPC should be called on the SERVICE client (not regular client)
    expect(serviceChain.rpc).toHaveBeenCalledWith("lookup_user_id_by_email", {
      p_email: "mark@example.com",
    });
  });

  it("email lookup uses service client to bypass RLS", async () => {
    const emailUser = {
      id: "u-private",
      username: "private_user",
      display_name: null,
      bio: null,
      avatar_url: null,
      is_public: false, // private user — only findable via service client
    };
    const { serviceChain } = mockClients({
      users: [],
      rpcResult: "u-private",
      emailUser,
    });

    const res = await GET(makeRequest({ q: "private@example.com" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toHaveLength(1);
    expect(json.users[0].id).toBe("u-private");
    // Verify the service client was used for both RPC and profile fetch
    expect(serviceChain.rpc).toHaveBeenCalled();
    expect(serviceChain.from).toHaveBeenCalledWith("users");
  });

  it("email search returns user even without a username", async () => {
    const emailUser = {
      id: "u-new",
      username: null,
      display_name: null,
      bio: null,
      avatar_url: null,
      is_public: true,
    };
    mockClients({ users: [], rpcResult: "u-new", emailUser });

    const res = await GET(makeRequest({ q: "newuser@test.com" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toHaveLength(1);
    expect(json.users[0].username).toBeNull();
  });

  it("email search returns empty when RPC finds no match", async () => {
    mockClients({ users: [], rpcResult: null });

    const res = await GET(makeRequest({ q: "nobody@example.com" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toEqual([]);
  });

  it("skips email search when username results exist", async () => {
    const users = [{ id: "u-1", username: "user_at_sign" }];
    const { serviceChain } = mockClients({ users });

    await GET(makeRequest({ q: "user@something" }));
    // Service client RPC should NOT have been called since username results existed
    expect(serviceChain.rpc).not.toHaveBeenCalled();
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
    const emailUser = {
      id: "u-priv",
      username: "priv_user",
      display_name: null,
      bio: null,
      avatar_url: null,
      is_public: true,
    };
    mockClients({ users: [], rpcResult: "u-priv", emailUser });

    const res = await GET(makeRequest({ q: "secret@example.com" }));
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
