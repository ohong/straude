import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/api/cli-auth", () => ({
  verifyCliToken: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { POST } from "@/app/api/usage/submit/route";
import { createClient } from "@/lib/supabase/server";
import { verifyCliToken } from "@/lib/api/cli-auth";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function makeEntry(dateStr: string, overrides: Record<string, any> = {}) {
  return {
    date: dateStr,
    data: {
      date: dateStr,
      models: ["claude-sonnet-4-5-20250929"],
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 1500,
      costUSD: 0.05,
      ...overrides,
    },
  };
}

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0]!;
}

function mockServiceClient(overrides: Record<string, any> = {}) {
  const chain: Record<string, any> = {
    from: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { id: "usage-1" },
      error: null,
    }),
    ...overrides,
  };
  (createServiceClient as any).mockReturnValue(chain);
  return chain;
}

function mockSupabaseAuth(userId: string | null) {
  const client: Record<string, any> = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
  (createClient as any).mockResolvedValue(client);
  return client;
}

function mockRequest(body: any, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/usage/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://straude.com";
  (verifyCliToken as any).mockReturnValue(null);
});

describe("POST /api/usage/submit", () => {
  it("rejects unauthenticated requests", async () => {
    mockSupabaseAuth(null);
    const svc = mockServiceClient();

    const res = await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "web" })
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("handles CLI JWT auth (Bearer token)", async () => {
    (verifyCliToken as any).mockReturnValue("cli-user-id");
    mockSupabaseAuth(null);
    const svc = mockServiceClient();
    // Each entry needs two .single() calls: usage + post
    svc.single
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest(
        { entries: [makeEntry(todayStr())], source: "cli" },
        { authorization: "Bearer some-token" }
      )
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(verifyCliToken).toHaveBeenCalledWith("Bearer some-token");
    expect(json.results).toHaveLength(1);
  });

  it("handles Supabase session auth (cookie/web)", async () => {
    mockSupabaseAuth("web-user-id");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "web" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(1);
  });

  it("submits a single day entry successfully", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    const res = await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "cli" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].date).toBe(todayStr());
    expect(json.results[0].usage_id).toBe("usage-1");
    expect(json.results[0].post_id).toBe("post-1");
    expect(json.results[0].post_url).toBe("https://straude.com/post/post-1");
  });

  it("submits multiple days (batch)", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    // 2 entries, each needing 2 .single() calls
    svc.single
      .mockResolvedValueOnce({ data: { id: "u1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "p1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "u2" }, error: null })
      .mockResolvedValueOnce({ data: { id: "p2" }, error: null });

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr()), makeEntry(daysAgo(1))],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toHaveLength(2);
  });

  it("rejects dates older than 7 days", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    mockServiceClient();

    const res = await POST(
      mockRequest({
        entries: [makeEntry(daysAgo(10))],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("outside the 7-day backfill window");
  });

  it("rejects negative cost", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    mockServiceClient();

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr(), { costUSD: -5 })],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Negative cost");
  });

  it("rejects negative tokens", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    mockServiceClient();

    const res = await POST(
      mockRequest({
        entries: [makeEntry(todayStr(), { inputTokens: -100 })],
        source: "cli",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Negative input tokens");
  });

  it("uses upsert on conflict (user_id,date)", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "cli" })
    );

    // Verify upsert was called with onConflict
    expect(svc.upsert).toHaveBeenCalled();
    const firstUpsertCall = svc.upsert.mock.calls[0];
    expect(firstUpsertCall[1]).toEqual({ onConflict: "user_id,date" });
  });

  it("auto-creates post for each usage entry", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const svc = mockServiceClient();
    svc.single
      .mockResolvedValueOnce({ data: { id: "usage-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "post-1" }, error: null });

    await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "cli" })
    );

    // upsert called twice: once for usage, once for post
    expect(svc.upsert).toHaveBeenCalledTimes(2);
    const postUpsertCall = svc.upsert.mock.calls[1];
    expect(postUpsertCall[0]).toMatchObject({
      user_id: "user-1",
      daily_usage_id: "usage-1",
    });
    expect(postUpsertCall[1]).toEqual({ onConflict: "daily_usage_id" });
  });

  it("rejects invalid JSON body", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const req = new Request("http://localhost/api/usage/submit", {
      method: "POST",
      body: "not json",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid JSON");
  });

  it("rejects empty entries array", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const res = await POST(
      mockRequest({ entries: [], source: "cli" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("No entries provided");
  });

  it("rejects invalid source", async () => {
    (verifyCliToken as any).mockReturnValue("user-1");
    const res = await POST(
      mockRequest({ entries: [makeEntry(todayStr())], source: "invalid" })
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid source");
  });
});
