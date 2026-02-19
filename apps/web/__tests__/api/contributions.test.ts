import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { GET } from "@/app/api/users/[username]/contributions/route";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function makeContext(username: string) {
  return { params: Promise.resolve({ username }) };
}

function makeRequest(url: string = "/api/users/alice/contributions") {
  return new NextRequest(new URL(url, "http://localhost"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/users/[username]/contributions", () => {
  it("returns contribution data with streak", async () => {
    const usageData = [
      { date: "2026-01-10", cost_usd: 5.0 },
      { date: "2026-01-11", cost_usd: 3.0 },
    ];
    const postsData = [
      {
        daily_usage_id: "du-1",
        daily_usage: { date: "2026-01-10" },
      },
    ];

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "u-1", is_public: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "daily_usage") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: usageData,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "posts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: postsData,
                error: null,
              }),
            }),
          };
        }
        return {};
      }),
      rpc: vi.fn().mockResolvedValue({ data: 5, error: null }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await GET(makeRequest(), makeContext("alice"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].date).toBe("2026-01-10");
    expect(json.data[0].cost_usd).toBe(5);
    expect(json.data[0].has_post).toBe(true);
    expect(json.data[1].has_post).toBe(false);
    expect(json.streak).toBe(5);
  });

  it("returns 404 for non-existent user", async () => {
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

    const res = await GET(makeRequest(), makeContext("nobody"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("User not found");
  });

  it("returns empty data when user has no usage", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "u-1", is_public: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "daily_usage") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "posts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {};
      }),
      rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await GET(makeRequest(), makeContext("alice"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(json.streak).toBe(0);
  });
});
