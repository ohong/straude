import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------
const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({
    from: (table: string) => mockSupabase.from(table),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

vi.mock("@/lib/achievements", () => ({
  checkAndAwardAchievements: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function chainBuilder(resolved: Record<string, unknown> = {}) {
  const chain: Record<string, any> = {};
  const methods = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "lt", "gte", "lte", "in", "is",
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

const OWNER_ID = "user-owner";
const OTHER_ID = "user-other";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Flow: Post Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("PATCH adds title, description, and images", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: OWNER_ID } },
    });

    const updatedPost = {
      id: "post-1",
      user_id: OWNER_ID,
      title: "Productive morning",
      usage_generated_title: false,
      description: "Shipped the new dashboard",
      images: ["https://test.supabase.co/storage/v1/object/public/post-images/user-owner/ss1.png"],
    };

    const updateChain = chainBuilder({ data: updatedPost, error: null });
    (updateChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);
    (updateChain.select as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    mockSupabase.from.mockImplementation(() => updateChain);

    const { PATCH } = await import("@/app/api/posts/[id]/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Productive morning",
        description: "Shipped the new dashboard",
        images: ["https://test.supabase.co/storage/v1/object/public/post-images/user-owner/ss1.png"],
      }),
    });
    const res = await PATCH(req as any, CONTEXT("post-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Productive morning");
    expect(data.description).toBe("Shipped the new dashboard");
    expect(data.images).toEqual([
      "https://test.supabase.co/storage/v1/object/public/post-images/user-owner/ss1.png",
    ]);

    // Verify correct fields passed to update
    const updateCall = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toEqual({
      title: "Productive morning",
      usage_generated_title: false,
      description: "Shipped the new dashboard",
      images: ["https://test.supabase.co/storage/v1/object/public/post-images/user-owner/ss1.png"],
    });
  });

  it("another user trying PATCH gets 404 (not yours)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: OTHER_ID } },
    });

    // The .eq("user_id", OTHER_ID) won't match — simulated by returning null
    const updateChain = chainBuilder({ data: null, error: { message: "not found" } });
    (updateChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);
    (updateChain.select as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    mockSupabase.from.mockImplementation(() => updateChain);

    const { PATCH } = await import("@/app/api/posts/[id]/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hijacked" }),
    });
    const res = await PATCH(req as any, CONTEXT("post-1"));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("not yours");
  });

  it("unauthenticated user cannot PATCH", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const { PATCH } = await import("@/app/api/posts/[id]/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nope" }),
    });
    const res = await PATCH(req as any, CONTEXT("post-1"));

    expect(res.status).toBe(401);
  });

  it("unauthenticated user cannot DELETE", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const { DELETE } = await import("@/app/api/posts/[id]/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-1", { method: "DELETE" });
    const res = await DELETE(req as any, CONTEXT("post-1"));

    expect(res.status).toBe(401);
  });
});
