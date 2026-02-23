import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  function MockAnthropic() {
    return { messages: { create: mockCreate } };
  }
  return { default: MockAnthropic };
});

import { POST } from "@/app/api/ai/generate-caption/route";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function mockSupabaseUser(user: { id: string } | null) {
  const client: Record<string, any> = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
  (createClient as any).mockResolvedValue(client);
  return client;
}

function mockAnthropicResponse(responseText: string) {
  mockCreate.mockResolvedValue({
    content: [{ type: "text", text: responseText }],
  });
}

function makeRequest(body: any) {
  return new NextRequest(new URL("http://localhost/api/ai/generate-caption"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
});

describe("POST /api/ai/generate-caption", () => {
  it("returns title and description", async () => {
    mockSupabaseUser({ id: "user-1" });
    mockAnthropicResponse(
      JSON.stringify({
        title: "Morning refactor session",
        description: "Cleaned up the auth module",
      })
    );

    const res = await POST(
      makeRequest({
        images: ["https://test.supabase.co/storage/v1/object/public/screenshots/1.png"],
        usage: { costUSD: 2.5, totalTokens: 10000 },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe("Morning refactor session");
    expect(json.description).toBe("Cleaned up the auth module");
  });

  it("handles JSON in a code block", async () => {
    mockSupabaseUser({ id: "user-1" });
    mockAnthropicResponse(
      '```json\n{"title": "Bug fix sprint", "description": "Fixed login flow"}\n```'
    );

    const res = await POST(
      makeRequest({
        images: ["https://test.supabase.co/storage/v1/object/public/screenshots/1.png"],
        usage: { costUSD: 1 },
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title).toBe("Bug fix sprint");
    expect(json.description).toBe("Fixed login flow");
  });

  it("rejects unauthenticated requests", async () => {
    mockSupabaseUser(null);

    const res = await POST(
      makeRequest({
        images: ["https://test.supabase.co/storage/v1/object/public/screenshots/1.png"],
        usage: {},
      })
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("validates images array is present", async () => {
    mockSupabaseUser({ id: "user-1" });

    const res = await POST(makeRequest({ usage: { costUSD: 1 } }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("image");
  });

  it("validates images array is not empty", async () => {
    mockSupabaseUser({ id: "user-1" });

    const res = await POST(
      makeRequest({ images: [], usage: { costUSD: 1 } })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("image");
  });

  it("returns 503 when API key is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockSupabaseUser({ id: "user-1" });

    const res = await POST(
      makeRequest({
        images: ["https://test.supabase.co/storage/v1/object/public/screenshots/1.png"],
        usage: {},
      })
    );
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toBe("AI service not configured");
  });

  it("returns 500 when AI response is unparseable", async () => {
    mockSupabaseUser({ id: "user-1" });
    mockAnthropicResponse("I cannot parse this as JSON at all, sorry.");

    const res = await POST(
      makeRequest({
        images: ["https://test.supabase.co/storage/v1/object/public/screenshots/1.png"],
        usage: {},
      })
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to parse AI response");
  });

  it("truncates title to 100 chars and description to 5000 chars", async () => {
    mockSupabaseUser({ id: "user-1" });
    mockAnthropicResponse(
      JSON.stringify({
        title: "A".repeat(200),
        description: "B".repeat(6000),
      })
    );

    const res = await POST(
      makeRequest({
        images: ["https://test.supabase.co/storage/v1/object/public/screenshots/1.png"],
        usage: {},
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.title.length).toBe(100);
    expect(json.description.length).toBe(5000);
  });
});
