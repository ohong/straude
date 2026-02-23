import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/og — ImageResponse is used with `new`, so provide a class
vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse extends Response {
    constructor(_jsx: any, _opts: any) {
      super("fake-png-data", {
        headers: { "Content-Type": "image/png" },
      });
    }
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/og-fonts", () => ({
  loadFonts: vi.fn().mockResolvedValue([
    { name: "Inter", data: new ArrayBuffer(8), style: "normal", weight: 700 },
    { name: "Inter", data: new ArrayBuffer(8), style: "normal", weight: 500 },
  ]),
}));

import { GET } from "@/app/api/recap/image/route";
import { createClient } from "@/lib/supabase/server";
import { loadFonts } from "@/lib/og-fonts";
import { NextRequest } from "next/server";

function makeRequest(params = "period=week&bg=01") {
  return new NextRequest(
    new URL(`/api/recap/image?${params}`, "http://localhost")
  );
}

function mockSupabase(opts: {
  user?: { id: string } | null;
  profile?: { username: string; is_public: boolean } | null;
  usageRows?: any[];
  streak?: number;
}) {
  const {
    user = { id: "u-1" },
    profile = { username: "alice", is_public: true },
    usageRows = [],
    streak = 3,
  } = opts;

  const client: Record<string, any> = {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: profile, error: null }),
            }),
          }),
        };
      }
      if (table === "daily_usage") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  order: vi
                    .fn()
                    .mockResolvedValue({ data: usageRows, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    }),
    rpc: vi.fn().mockResolvedValue({ data: streak, error: null }),
  };

  (createClient as any).mockResolvedValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/recap/image", () => {
  it("returns 401 for unauthenticated requests", async () => {
    mockSupabase({ user: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when profile not found", async () => {
    mockSupabase({ profile: null });
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("returns PNG image with download headers for valid request", async () => {
    mockSupabase({
      usageRows: [
        {
          date: "2026-02-20",
          cost_usd: 5.0,
          output_tokens: 1000,
          session_count: 2,
          models: ["claude-sonnet-4"],
        },
      ],
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/png");
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="straude-recap-week.png"'
    );
  });

  it("returns PNG even with no usage data", async () => {
    mockSupabase({ usageRows: [] });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("accepts month period parameter", async () => {
    mockSupabase({});

    const res = await GET(makeRequest("period=month&bg=03"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain(
      'filename="straude-recap-month.png"'
    );
  });

  it("falls back to default background for invalid bg param", async () => {
    mockSupabase({});

    const res = await GET(makeRequest("period=week&bg=invalid"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/png");
  });

  it("returns 500 instead of crashing when font loading fails", async () => {
    mockSupabase({});
    (loadFonts as any).mockRejectedValueOnce(
      new Error("ENOENT: no such file or directory")
    );

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });

  it("returns 500 instead of crashing when image generation fails", async () => {
    mockSupabase({});

    // Temporarily override ImageResponse to throw
    const og = await import("next/og");
    const Original = og.ImageResponse;
    (og as any).ImageResponse = class {
      constructor() {
        throw new Error("Satori render failed");
      }
    };

    const res = await GET(makeRequest());

    (og as any).ImageResponse = Original;

    expect(res.status).toBe(500);
  });
});
