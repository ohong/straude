import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSessionClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => mockSessionClient),
}));

vi.mock("@/lib/api/cli-auth", () => ({
  createCliToken: vi.fn(() => "mock-cli-jwt-token"),
  verifyCliToken: vi.fn(),
}));

const mockServiceClient = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => mockServiceClient),
}));

import { verifyCliToken } from "@/lib/api/cli-auth";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Flow: CLI Push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://straude.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    vi.stubEnv("CLI_JWT_SECRET", "test-jwt-secret");
  });

  it("CLI init creates an auth code and returns verify URL", async () => {
    const insertChain = chainBuilder({ data: null, error: null });
    (insertChain.insert as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "cli_auth_codes") return insertChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/auth/cli/init/route");
    const req = makeRequest("http://localhost:3000/api/auth/cli/init", {
      method: "POST",
    });
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.code).toBeDefined();
    expect(data.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(data.verify_url).toContain("https://straude.com/cli/verify?code=");
    expect(mockServiceClient.from).toHaveBeenCalledWith("cli_auth_codes");
  });

  it("CLI poll returns pending when code not yet verified", async () => {
    const pendingCode = {
      id: "code-1",
      code: "ABCD-EFGH",
      status: "pending",
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      user_id: null,
    };

    const selectChain = chainBuilder({ data: pendingCode, error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "cli_auth_codes") return selectChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/auth/cli/poll/route");
    const req = makeRequest("http://localhost:3000/api/auth/cli/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ABCD-EFGH" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.status).toBe("pending");
  });

  it("CLI poll returns completed with token after user verifies", async () => {
    const userId = "user-cli-1";
    const completedCode = {
      id: "code-1",
      code: "ABCD-EFGH",
      status: "completed",
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      user_id: userId,
    };

    const codeChain = chainBuilder({ data: completedCode, error: null });
    const userChain = chainBuilder({ data: { username: "cli_user" }, error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "cli_auth_codes") return codeChain;
      if (table === "users") return userChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/auth/cli/poll/route");
    const req = makeRequest("http://localhost:3000/api/auth/cli/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "ABCD-EFGH" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(data.status).toBe("completed");
    expect(data.token).toBe("mock-cli-jwt-token");
    expect(data.username).toBe("cli_user");
  });

  it("CLI pushes usage and creates daily_usage + post", async () => {
    const userId = "user-cli-1";

    (verifyCliToken as ReturnType<typeof vi.fn>).mockReturnValue(userId);
    mockSessionClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    const today = new Date().toISOString().split("T")[0]!;

    const usageChain = chainBuilder({ data: { id: "usage-1" }, error: null });
    const postChain = chainBuilder({ data: { id: "post-1" }, error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "daily_usage") return usageChain;
      if (table === "posts") return postChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/usage/submit/route");
    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-cli-jwt-token",
      },
      body: JSON.stringify({
        entries: [
          {
            date: today,
            data: {
              date: today,
              models: ["claude-sonnet-4-5-20250929"],
              inputTokens: 1000,
              outputTokens: 500,
              cacheCreationTokens: 100,
              cacheReadTokens: 200,
              totalTokens: 1800,
              costUSD: 0.05,
            },
          },
        ],
        hash: "abc123",
        source: "cli",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].usage_id).toBe("usage-1");
    expect(data.results[0].post_id).toBe("post-1");
    expect(data.results[0].post_url).toBe("https://straude.com/post/post-1");

    const upsertCall = (usageChain.upsert as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(upsertCall[0].is_verified).toBe(true);
    expect(upsertCall[0].raw_hash).toBe("abc123");
  });

  it("pushing same date again upserts instead of duplicating", async () => {
    const userId = "user-cli-1";
    (verifyCliToken as ReturnType<typeof vi.fn>).mockReturnValue(userId);
    mockSessionClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    const today = new Date().toISOString().split("T")[0]!;

    const usageChain = chainBuilder({ data: { id: "usage-1" }, error: null });
    const postChain = chainBuilder({ data: { id: "post-1" }, error: null });

    mockServiceClient.from.mockImplementation((table: string) => {
      if (table === "daily_usage") return usageChain;
      if (table === "posts") return postChain;
      return chainBuilder();
    });

    const { POST } = await import("@/app/api/usage/submit/route");
    const entry = {
      date: today,
      data: {
        date: today,
        models: ["claude-sonnet-4-5-20250929"],
        inputTokens: 2000,
        outputTokens: 1000,
        cacheCreationTokens: 200,
        cacheReadTokens: 400,
        totalTokens: 3600,
        costUSD: 0.10,
      },
    };

    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-cli-jwt-token",
      },
      body: JSON.stringify({ entries: [entry], hash: "def456", source: "cli" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    const upsertCall = (usageChain.upsert as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(upsertCall[1]).toEqual({ onConflict: "user_id,date" });
  });

  it("rejects push without authentication", async () => {
    (verifyCliToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
    mockSessionClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("@/app/api/usage/submit/route");
    const req = makeRequest("http://localhost:3000/api/usage/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [{ date: "2026-02-16", data: { costUSD: 1, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, models: [] } }],
        source: "cli",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
