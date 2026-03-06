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

vi.mock("@/lib/og-fonts", () => ({
  loadFonts: vi.fn().mockResolvedValue([
    { name: "Inter", data: new ArrayBuffer(8), style: "normal", weight: 700 },
  ]),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/posts/[id]/share-image/route";
import { createClient } from "@/lib/supabase/server";
import { loadFonts } from "@/lib/og-fonts";

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(params = "theme=accent") {
  return new NextRequest(
    new URL(`/api/posts/post-1/share-image?${params}`, "http://localhost")
  );
}

function mockSupabase(post: Record<string, unknown> | null) {
  const client: Record<string, any> = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== "posts") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(
              post
                ? { data: post, error: null }
                : { data: null, error: { code: "PGRST116" } }
            ),
          }),
        }),
      };
    }),
  };

  (createClient as any).mockResolvedValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/posts/[id]/share-image", () => {
  it("returns PNG for a public post without requiring auth", async () => {
    mockSupabase({
      id: "post-1",
      title: "Morning refactor",
      description: "Shipped the dashboard cleanup.",
      images: [],
      user: {
        username: "alice",
        avatar_url: null,
        display_name: "Alice",
      },
      daily_usage: {
        cost_usd: 12.5,
        input_tokens: 1200,
        output_tokens: 3400,
        models: ["claude-opus-4-20250505"],
        is_verified: true,
      },
    });

    const response = await GET(makeRequest(), makeContext("post-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("image/png");
    expect(response.headers.get("Content-Disposition")).toContain(
      'attachment; filename="straude-post-1.png"'
    );
  });

  it("returns 404 when the post is not visible", async () => {
    mockSupabase(null);

    const response = await GET(makeRequest(), makeContext("missing"));

    expect(response.status).toBe(404);
  });

  it("returns 500 instead of crashing when font loading fails", async () => {
    mockSupabase({
      id: "post-1",
      title: "Morning refactor",
      description: null,
      images: [],
      user: {
        username: "alice",
        avatar_url: null,
        display_name: "Alice",
      },
      daily_usage: {
        cost_usd: 12.5,
        input_tokens: 1200,
        output_tokens: 3400,
        models: ["claude-opus-4-20250505"],
        is_verified: true,
      },
    });
    (loadFonts as any).mockRejectedValueOnce(new Error("font failure"));

    const response = await GET(makeRequest(), makeContext("post-1"));

    expect(response.status).toBe(500);
  });
});
