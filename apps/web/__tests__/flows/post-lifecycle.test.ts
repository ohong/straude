import { describe, it, expect, vi, beforeEach } from "vitest";

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

const OWNER_ID = "user-owner";
const OTHER_ID = "user-other";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Flow: Post Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns post with default empty title after auto-creation", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: OWNER_ID } },
    });

    const post = {
      id: "post-1",
      user_id: OWNER_ID,
      title: null,
      description: null,
      images: [],
      daily_usage: { date: "2026-02-16", cost_usd: 5.0 },
      user: { id: OWNER_ID, username: "owner" },
      kudos_count: [{ count: 0 }],
      comment_count: [{ count: 0 }],
    };

    const postChain = chainBuilder({ data: post, error: null });
    const kudosCheckChain = chainBuilder();
    (kudosCheckChain.select as ReturnType<typeof vi.fn>).mockReturnValue(kudosCheckChain);
    (kudosCheckChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(kudosCheckChain);
    (kudosCheckChain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null });

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      callCount++;
      if (table === "posts") return postChain;
      if (table === "kudos") return kudosCheckChain;
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/posts/[id]/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-1");
    const res = await GET(req as any, CONTEXT("post-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBeNull();
    expect(data.description).toBeNull();
    expect(data.kudos_count).toBe(0);
    expect(data.comment_count).toBe(0);
    expect(data.has_kudosed).toBe(false);
  });

  it("PATCH adds title, description, and images", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: OWNER_ID } },
    });

    const updatedPost = {
      id: "post-1",
      user_id: OWNER_ID,
      title: "Productive morning",
      description: "Shipped the new dashboard",
      images: ["https://example.com/ss1.png"],
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
        images: ["https://example.com/ss1.png"],
      }),
    });
    const res = await PATCH(req as any, CONTEXT("post-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe("Productive morning");
    expect(data.description).toBe("Shipped the new dashboard");
    expect(data.images).toEqual(["https://example.com/ss1.png"]);

    // Verify correct fields passed to update
    const updateCall = (updateChain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateCall).toEqual({
      title: "Productive morning",
      description: "Shipped the new dashboard",
      images: ["https://example.com/ss1.png"],
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

  it("owner can DELETE their post", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: OWNER_ID } },
    });

    const deleteChain = chainBuilder();
    // The route chains .delete().eq().eq() synchronously, then awaits.
    // Each method must return the chain; the chain itself resolves via `then`.
    (deleteChain as any).then = (res: any, rej: any) =>
      Promise.resolve({ error: null }).then(res, rej);

    mockSupabase.from.mockImplementation(() => deleteChain);

    const { DELETE } = await import("@/app/api/posts/[id]/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-1", { method: "DELETE" });
    const res = await DELETE(req as any, CONTEXT("post-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("GET deleted post returns 404", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: OWNER_ID } },
    });

    const notFoundChain = chainBuilder({ data: null, error: { message: "not found" } });

    mockSupabase.from.mockImplementation(() => notFoundChain);

    const { GET } = await import("@/app/api/posts/[id]/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-1");
    const res = await GET(req as any, CONTEXT("post-1"));

    expect(res.status).toBe(404);
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
