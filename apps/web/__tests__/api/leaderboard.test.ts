import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(),
}));

import { GET } from "@/app/api/leaderboard/route";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { NextRequest } from "next/server";

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/leaderboard");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

function mockSupabase(opts: {
  user?: { id: string } | null;
  entries?: any[];
  levels?: any[];
  userEntry?: any;
  countAbove?: number;
}) {
  const {
    user = null,
    entries = [],
    levels = [],
    userEntry = null,
    countAbove = 0,
  } = opts;

  const client: Record<string, any> = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "user_levels") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: levels,
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockImplementation((sel: string, opts?: any) => {
          // count query
          if (opts?.count === "exact" && opts?.head) {
            return {
              gt: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: countAbove }),
                // No region filter
                then: (resolve: any) => resolve({ count: countAbove }),
              }),
              eq: vi.fn().mockResolvedValue({ count: countAbove }),
            };
          }
          // Regular select
          return {
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lt: vi.fn().mockResolvedValue({
                    data: entries,
                    error: null,
                  }),
                  then: (resolve: any) =>
                    resolve({ data: entries, error: null }),
                }),
                lt: vi.fn().mockResolvedValue({
                  data: entries,
                  error: null,
                }),
                then: (resolve: any) =>
                  resolve({ data: entries, error: null }),
              }),
            }),
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: userEntry,
                error: null,
              }),
            }),
          };
        }),
      };
    }),
  };

  (createClient as any).mockResolvedValue(client);
  (getServiceClient as any).mockReturnValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/leaderboard", () => {
  it("returns entries sorted by total_cost with ranks", async () => {
    const entries = [
      { user_id: "u1", total_cost: 100, username: "alice" },
      { user_id: "u2", total_cost: 50, username: "bob" },
    ];

    // Use a simple mock where the main query returns entries
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation(() => ({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: entries,
              error: null,
            }),
          }),
          in: vi.fn().mockResolvedValue({
            data: [{ user_id: "u1", level: 4 }],
            error: null,
          }),
        })),
      }),
      rpc: vi.fn().mockResolvedValue({ data: [] }),
    };
    (createClient as any).mockResolvedValue(client);
    (getServiceClient as any).mockReturnValue(client);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.entries).toHaveLength(2);
    expect(json.entries[0].rank).toBe(1);
    expect(json.entries[1].rank).toBe(2);
    expect(json.entries[0].total_cost).toBe(100);
    expect(json.entries[0].level).toBe(4);
  });

  it("defaults to week period", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation(() => ({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      }),
    };
    (createClient as any).mockResolvedValue(client);
    (getServiceClient as any).mockReturnValue(client);

    await GET(makeRequest());

    // The from() call should use leaderboard_weekly view
    expect(client.from).toHaveBeenCalledWith("leaderboard_weekly");
  });

  it("filters by period", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation(() => ({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      }),
    };
    (createClient as any).mockResolvedValue(client);
    (getServiceClient as any).mockReturnValue(client);

    await GET(makeRequest({ period: "month" }));
    expect(client.from).toHaveBeenCalledWith("leaderboard_monthly");
  });

  it("rejects invalid period", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn(),
    };
    (createClient as any).mockResolvedValue(client);
    (getServiceClient as any).mockReturnValue(client);

    const res = await GET(makeRequest({ period: "invalid" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid period");
  });

  it("filters by region", async () => {
    const selectMock = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation(() => {
          const chain = selectMock();
          return {
            ...chain,
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);
    (getServiceClient as any).mockReturnValue(client);

    const res = await GET(makeRequest({ region: "north_america" }));
    const json = await res.json();

    expect(res.status).toBe(200);
  });

  it("includes user_rank for current user in page", async () => {
    const entries = [
      { user_id: "u1", total_cost: 100 },
      { user_id: "current-user", total_cost: 50 },
    ];

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "current-user" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation(() => ({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: entries,
              error: null,
            }),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      }),
      rpc: vi.fn().mockResolvedValue({ data: [] }),
    };
    (createClient as any).mockResolvedValue(client);
    (getServiceClient as any).mockReturnValue(client);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.user_rank).toBe(2);
  });

  it("returns next_cursor when entries fill limit", async () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({
      user_id: `u${i}`,
      total_cost: 100 - i,
    }));

    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation(() => ({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: entries,
              error: null,
            }),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      }),
      rpc: vi.fn().mockResolvedValue({ data: [] }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.next_cursor).toBeDefined();
    expect(json.next_cursor).toBe("51");
  });
});
