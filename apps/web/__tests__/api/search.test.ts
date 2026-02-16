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

function mockSupabase(users: any[] = [], error: any = null) {
  const client: Record<string, any> = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: users,
              error,
            }),
          }),
        }),
      }),
    }),
  };
  (createClient as any).mockResolvedValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/search", () => {
  it("searches by username (ILIKE)", async () => {
    const users = [
      { id: "u-1", username: "alice", avatar_url: null, bio: "dev" },
      { id: "u-2", username: "alice2", avatar_url: null, bio: null },
    ];
    const client = mockSupabase(users);

    const res = await GET(makeRequest({ q: "alice" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toHaveLength(2);
    expect(json.users[0].username).toBe("alice");

    // Verify ILIKE was called with the correct pattern
    const fromCall = client.from.mock.results[0].value;
    const notCall = fromCall.select.mock.results[0].value.not;
    const ilikeCall = notCall.mock.results[0].value.ilike;
    expect(ilikeCall).toHaveBeenCalledWith("username", "%alice%");
  });

  it("requires min 2 characters", async () => {
    mockSupabase();

    const res = await GET(makeRequest({ q: "a" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("at least 2 characters");
  });

  it("returns error for empty query", async () => {
    mockSupabase();

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(400);
  });

  it("returns max 20 results by default", async () => {
    const users = Array.from({ length: 20 }, (_, i) => ({
      id: `u-${i}`,
      username: `user${i}`,
    }));
    const client = mockSupabase(users);

    const res = await GET(makeRequest({ q: "user" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    // Verify limit was called with 20
    const fromCall = client.from.mock.results[0].value;
    const limitCall =
      fromCall.select.mock.results[0].value.not.mock.results[0].value.ilike.mock
        .results[0].value.limit;
    expect(limitCall).toHaveBeenCalledWith(20);
  });

  it("returns empty array for no matches", async () => {
    mockSupabase([]);

    const res = await GET(makeRequest({ q: "zzzzz" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users).toEqual([]);
  });

  it("returns user objects with avatar and bio", async () => {
    const users = [
      {
        id: "u-1",
        username: "alice",
        avatar_url: "https://img.example.com/a.jpg",
        bio: "I code things",
      },
    ];
    mockSupabase(users);

    const res = await GET(makeRequest({ q: "al" }));
    const json = await res.json();

    expect(json.users[0].avatar_url).toBe("https://img.example.com/a.jpg");
    expect(json.users[0].bio).toBe("I code things");
  });
});
