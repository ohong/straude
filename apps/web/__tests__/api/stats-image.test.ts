import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse extends Response {
    constructor(_jsx: unknown, _opts: unknown) {
      super("fake-png-data", {
        headers: { "Content-Type": "image/png" },
      });
    }
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(),
}));

vi.mock("@/lib/og-fonts", () => ({
  loadFonts: vi.fn().mockResolvedValue([
    { name: "Inter", data: new ArrayBuffer(8), style: "normal", weight: 700 },
    { name: "Inter", data: new ArrayBuffer(8), style: "normal", weight: 500 },
  ]),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/stats/[username]/image/route";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

function makeContext(username: string) {
  return { params: Promise.resolve({ username }) };
}

function makeRequest(params = "") {
  return new NextRequest(
    new URL(`/api/stats/alice/image?${params}`, "http://localhost")
  );
}

function chainSingle(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  };
}

function mockServiceClient(opts: {
  profile: { id: string; username: string; display_name: string | null; is_public: boolean } | null;
}) {
  const usageRangeRows = [
    { date: "2026-03-01", cost_usd: 12.5 },
    { date: "2026-03-02", cost_usd: 0 },
  ];
  const lifetimeRows = [{ output_tokens: 1000 }, { output_tokens: 2500 }];
  const recentRows = [
    {
      date: "2026-03-01",
      output_tokens: 1000,
      models: ["claude-sonnet-4-20250514"],
    },
    {
      date: "2026-03-02",
      output_tokens: 2500,
      models: ["gpt-5.3-codex"],
    },
  ];

  const client: Record<string, any> = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "users") return chainSingle(opts.profile);

      if (table !== "daily_usage") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: usageRangeRows, error: null }),
            }),
            order: vi.fn().mockResolvedValue({ data: usageRangeRows, error: null }),
            then: undefined,
          }),
        }),
      };
    }),
    rpc: vi.fn().mockResolvedValue({ data: 9, error: null }),
  };

  let dailyUsageCall = 0;
  client.from = vi.fn().mockImplementation((table: string) => {
    if (table === "users") return chainSingle(opts.profile);
    if (table !== "daily_usage") {
      throw new Error(`Unexpected table: ${table}`);
    }

    dailyUsageCall += 1;

    if (dailyUsageCall === 1) {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: usageRangeRows, error: null }),
            }),
          }),
        }),
      };
    }

    if (dailyUsageCall === 2) {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: lifetimeRows, error: null }),
        }),
      };
    }

    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: recentRows, error: null }),
        }),
      }),
    };
  });

  (getServiceClient as any).mockReturnValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/stats/[username]/image", () => {
  it("returns a PNG for a public profile", async () => {
    mockServiceClient({
      profile: {
        id: "user-1",
        username: "alice",
        display_name: "Alice",
        is_public: true,
      },
    });

    const response = await GET(makeRequest(), makeContext("alice"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("image/png");
  });

  it("sets a download header when requested", async () => {
    mockServiceClient({
      profile: {
        id: "user-1",
        username: "alice",
        display_name: "Alice",
        is_public: true,
      },
    });

    const response = await GET(makeRequest("download=1"), makeContext("alice"));

    expect(response.headers.get("Content-Disposition")).toContain(
      'attachment; filename="straude-stats-alice.png"'
    );
  });

  it("returns 404 for a private profile when the viewer is not the owner", async () => {
    mockServiceClient({
      profile: {
        id: "user-1",
        username: "alice",
        display_name: "Alice",
        is_public: false,
      },
    });
    (createClient as any).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const response = await GET(makeRequest(), makeContext("alice"));

    expect(response.status).toBe(404);
  });
});
