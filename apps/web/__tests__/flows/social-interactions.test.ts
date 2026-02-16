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
function chainBuilder(resolvedData: Record<string, unknown> = { data: null, error: null }) {
  let _resolved = resolvedData;
  const chain: Record<string, any> = {};
  const methods = [
    "select", "insert", "update", "upsert", "delete",
    "eq", "neq", "gt", "lt", "gte", "lte", "in",
    "order", "limit", "maybeSingle",
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(_resolved));
  chain.then = (resolve: any, reject: any) => Promise.resolve(_resolved).then(resolve, reject);
  chain._setResolved = (val: Record<string, unknown>) => { _resolved = val; };
  return chain;
}

function makeRequest(url: string, init?: RequestInit) {
  const parsedUrl = new URL(url, "http://localhost:3000");
  const req = new Request(parsedUrl, init);
  (req as any).nextUrl = parsedUrl;
  return req;
}

const CONTEXT = (id: string) => ({ params: Promise.resolve({ id }) });
const USERNAME_CTX = (u: string) => ({ params: Promise.resolve({ username: u }) });

const USER_A = { id: "user-a", username: "alice" };
const USER_B = { id: "user-b", username: "bob" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Flow: Social Interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("User A follows User B", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_A.id } },
    });

    const usersChain = chainBuilder({ data: { id: USER_B.id }, error: null });
    const followsChain = chainBuilder({ error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "users") return usersChain;
      if (table === "follows") return followsChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/follow/[username]/route");
    const req = makeRequest("http://localhost:3000/api/follow/bob", { method: "POST" });
    const res = await POST(req as any, USERNAME_CTX("bob"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.following).toBe(true);
    expect(followsChain.insert).toHaveBeenCalledWith({
      follower_id: USER_A.id,
      following_id: USER_B.id,
    });
  });

  it("User A sees User B's post in feed after following", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_A.id } },
    });

    const bobPost = {
      id: "post-b1",
      user_id: USER_B.id,
      title: "Morning session",
      created_at: "2026-02-16T10:00:00Z",
      kudos_count: [{ count: 0 }],
      comment_count: [{ count: 0 }],
    };

    const followsChain = chainBuilder({ data: [{ following_id: USER_B.id }] });
    const postsChain = chainBuilder({ data: [bobPost], error: null });
    const kudosChain = chainBuilder({ data: [] });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "follows") return followsChain;
      if (table === "posts") return postsChain;
      if (table === "kudos") return kudosChain;
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/feed/route");
    const req = makeRequest("http://localhost:3000/api/feed");
    const res = await GET(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].id).toBe("post-b1");
    expect(data.posts[0].has_kudosed).toBe(false);
  });

  it("User A gives kudos to User B's post", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_A.id } },
    });

    const kudosInsertChain = chainBuilder({ error: null });
    const kudosCountChain = chainBuilder({ count: 1 });

    let callIdx = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "kudos") {
        return callIdx++ === 0 ? kudosInsertChain : kudosCountChain;
      }
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/posts/[id]/kudos/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-b1/kudos", { method: "POST" });
    const res = await POST(req as any, CONTEXT("post-b1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.kudosed).toBe(true);
    expect(data.count).toBe(1);
  });

  it("User A comments on User B's post", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_A.id } },
    });

    const commentData = {
      id: "comment-1",
      user_id: USER_A.id,
      post_id: "post-b1",
      content: "Great session!",
      user: { id: USER_A.id, username: "alice" },
    };

    const commentChain = chainBuilder({ data: commentData, error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "comments") return commentChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/posts/[id]/comments/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-b1/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Great session!" }),
    });
    const res = await POST(req as any, CONTEXT("post-b1"));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.content).toBe("Great session!");
    expect(data.id).toBe("comment-1");
  });

  it("comment appears in GET /api/posts/[id]/comments", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_A.id } },
    });

    const comments = [
      {
        id: "comment-1",
        user_id: USER_A.id,
        post_id: "post-b1",
        content: "Great session!",
        created_at: "2026-02-16T12:00:00Z",
        user: { id: USER_A.id, username: "alice" },
      },
    ];

    const commentsChain = chainBuilder({ data: comments, error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "comments") return commentsChain;
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/posts/[id]/comments/route");
    const req = makeRequest("http://localhost:3000/api/posts/post-b1/comments");
    const res = await GET(req as any, CONTEXT("post-b1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.comments).toHaveLength(1);
    expect(data.comments[0].content).toBe("Great session!");
  });

  it("User A edits their comment", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_A.id } },
    });

    const updatedComment = {
      id: "comment-1",
      user_id: USER_A.id,
      content: "Updated: Great session!",
    };

    const updateChain = chainBuilder({ data: updatedComment, error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "comments") return updateChain;
      return chainBuilder();
    });

    const { PATCH } = await import("@/app/api/comments/[id]/route");
    const req = makeRequest("http://localhost:3000/api/comments/comment-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Updated: Great session!" }),
    });
    const res = await PATCH(req as any, CONTEXT("comment-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.content).toBe("Updated: Great session!");
  });

  it("User A unfollows User B and feed no longer shows their posts", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_A.id } },
    });

    // Unfollow — the route does: .from("users").select("id").eq("username", ...).single()
    // then: .from("follows").delete().eq("follower_id", ...).eq("following_id", ...)
    const usersChain = chainBuilder({ data: { id: USER_B.id }, error: null });
    const deleteChain = chainBuilder({ error: null }); // thenable chain: .delete().eq().eq() then await

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "users") return usersChain;
      if (table === "follows") return deleteChain;
      return chainBuilder();
    });

    const { DELETE } = await import("@/app/api/follow/[username]/route");
    const delReq = makeRequest("http://localhost:3000/api/follow/bob", { method: "DELETE" });
    const delRes = await DELETE(delReq as any, USERNAME_CTX("bob"));
    const delData = await delRes.json();

    expect(delRes.status).toBe(200);
    expect(delData.following).toBe(false);

    // Feed now empty
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_A.id } },
    });

    const followsChain = chainBuilder({ data: [] });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "follows") return followsChain;
      return chainBuilder();
    });

    const { GET } = await import("@/app/api/feed/route");
    const feedReq = makeRequest("http://localhost:3000/api/feed");
    const feedRes = await GET(feedReq as any);
    const feedData = await feedRes.json();

    expect(feedRes.status).toBe(200);
    expect(feedData.posts).toEqual([]);
  });
});
