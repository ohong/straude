import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/api/cli-auth", () => ({
  verifyCliToken: vi.fn(() => null), // web flow — no CLI token
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockServiceClient),
}));

const mockAnthropicCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: "text",
      text: '{"title": "Morning refactor session", "description": "Cleaned up the auth module"}',
    },
  ],
});

vi.mock("@anthropic-ai/sdk", () => {
  // Must use a named function (not arrow) so it can be called with `new`
  function MockAnthropic() {
    return { messages: { create: mockAnthropicCreate } };
  }
  return { default: MockAnthropic };
});

const mockServiceClient = {
  from: vi.fn(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function chainBuilder(resolved: Record<string, unknown> = {}) {
  const chain: Record<string, any> = {};
  const methods = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "lt", "gte", "lte", "in",
    "order", "limit", "maybeSingle",
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(resolved));
  return chain;
}

function makeRequest(url: string, init?: RequestInit) {
  const parsedUrl = new URL(url, "http://localhost:3000");
  const req = new Request(parsedUrl, init);
  (req as any).nextUrl = parsedUrl;
  return req;
}

const CONTEXT = (id: string) => ({ params: Promise.resolve({ id }) });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Flow: Web JSON Import", () => {
  const userId = "user-web-1";
  const today = new Date().toISOString().split("T")[0]!;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://straude.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  });

  it("submits web usage with is_verified: false and no hash", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    });

    const usageChain = chainBuilder({ data: { id: "usage-w1" }, error: null });
    const postChain = chainBuilder({ data: { id: "post-w1" }, error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "daily_usage") return usageChain;
      if (table === "posts") return postChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/usage/submit/route");
    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [
          {
            date: today,
            data: {
              date: today,
              models: ["claude-sonnet-4-5-20250929"],
              inputTokens: 5000,
              outputTokens: 2000,
              cacheCreationTokens: 500,
              cacheReadTokens: 1000,
              totalTokens: 8500,
              costUSD: 0.25,
            },
          },
        ],
        source: "web",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].post_id).toBe("post-w1");

    // Verify is_verified is false for web source
    const upsertCall = (usageChain.upsert as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(upsertCall[0].is_verified).toBe(false);
    expect(upsertCall[0].raw_hash).toBeNull();
  });

  it("user edits auto-created post with title and description", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    });

    const updatedPost = {
      id: "post-w1",
      user_id: userId,
      title: "Heavy refactor day",
      description: "Migrated the entire auth layer to a new pattern",
    };

    const updateChain = chainBuilder({ data: updatedPost, error: null });
    (updateChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);
    (updateChain.select as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    mockSupabase.from.mockImplementation(() => updateChain);

    const { PATCH } = await import("@/app/api/posts/[id]/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-w1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Heavy refactor day",
        description: "Migrated the entire auth layer to a new pattern",
      }),
    });
    const res = await PATCH(req as any, CONTEXT("post-w1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Heavy refactor day");
  });

  it("generates AI caption from images and usage", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    });

    const { POST } = await import("@/app/api/ai/generate-caption/route");
    const req = makeRequest("http://localhost:3000/api/ai/generate-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        images: ["https://test.supabase.co/storage/v1/object/public/post-images/screenshot1.png"],
        usage: {
          costUSD: 0.25,
          totalTokens: 8500,
          inputTokens: 5000,
          outputTokens: 2000,
          models: ["claude-sonnet-4-5-20250929"],
          sessionCount: 3,
        },
      }),
    });
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Morning refactor session");
    expect(data.description).toBe("Cleaned up the auth module");
  });

  it("AI caption requires at least one image", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    });

    const { POST } = await import("@/app/api/ai/generate-caption/route");
    const req = makeRequest("http://localhost:3000/api/ai/generate-caption", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [], usage: {} }),
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("rejects invalid source", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
    });

    const { POST } = await import("@/app/api/usage/submit/route");
    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [{ date: today, data: { costUSD: 1, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, models: [] } }],
        source: "invalid",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
