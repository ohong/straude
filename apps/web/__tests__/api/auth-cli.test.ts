import { describe, it, expect, vi, beforeEach } from "vitest";

const mockServiceClient: Record<string, any> = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => mockServiceClient),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/api/cli-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cli-auth")>();
  return {
    ...actual,
    createCliToken: vi.fn(),
  };
});

import { POST as initPOST } from "@/app/api/auth/cli/init/route";
import { POST as pollPOST } from "@/app/api/auth/cli/poll/route";
import { POST as verifyPOST } from "@/app/api/auth/cli/verify/route";
import { createCliToken } from "@/lib/api/cli-auth";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function mockChain(overrides = {}) {
  const chain: Record<string, any> = {
    insert: vi.fn().mockReturnValue({ error: null }),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return chain;
}

function mockRequest(body?: any) {
  return new Request("http://localhost/api/auth/cli/poll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://straude.com");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  mockServiceClient.rpc.mockResolvedValue({
    data: [{ allowed: true, retry_after_seconds: 0 }],
    error: null,
  });
});

function mockAuthenticatedUser(user: { id: string } | null = { id: "user-abc" }) {
  (createClient as any).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  });
}

describe("POST /api/auth/cli/init", () => {
  it("creates a code and returns code + verify_url", async () => {
    const chain = mockChain();
    mockServiceClient.from.mockReturnValue(chain);

    const req = new NextRequest(new URL("http://localhost/api/auth/cli/init"), {
      method: "POST",
    });
    const res = await initPOST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(json.poll_secret).toMatch(/^[A-Za-z0-9_-]+$/);

    const url = new URL(json.verify_url);
    expect(`${url.origin}${url.pathname}`).toBe("https://straude.com/cli/verify");
    expect(url.searchParams.get("code")).toBe(json.code);
    expect(url.searchParams.get("verify_secret")).toMatch(/^[A-Za-z0-9_-]+$/);

    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.code).toBe(json.code);
    expect(insertArg.status).toBe("pending");
    expect(insertArg.poll_secret_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(insertArg.verify_secret_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(insertArg.poll_secret_hash).not.toBe(json.poll_secret);
    expect(insertArg.verify_secret_hash).not.toBe(url.searchParams.get("verify_secret"));
  });

  it("returns 500 when insert fails", async () => {
    const chain = mockChain({
      insert: vi.fn().mockReturnValue({ error: { message: "DB error" } }),
    });
    mockServiceClient.from.mockReturnValue(chain);

    const req = new NextRequest(new URL("http://localhost/api/auth/cli/init"), {
      method: "POST",
    });
    const res = await initPOST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to create auth code");
  });
});

describe("POST /api/auth/cli/poll", () => {
  it("returns error for invalid JSON", async () => {
    const req = new Request("http://localhost/api/auth/cli/poll", {
      method: "POST",
      body: "not json",
    });

    const res = await pollPOST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid JSON");
  });

  it("returns error when code is missing", async () => {
    const res = await pollPOST(mockRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Missing code");
  });

  it("returns error when poll_secret is missing", async () => {
    const res = await pollPOST(mockRequest({ code: "AAAA-BBBB" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Missing poll_secret");
  });

  it("returns expired when code not found", async () => {
    const chain = mockChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
    });
    mockServiceClient.from.mockReturnValue(chain);

    const res = await pollPOST(mockRequest({ code: "XXXX-YYYY", poll_secret: "secret" }));
    const json = await res.json();

    expect(json.status).toBe("expired");
  });

  it("returns pending for a pending code", async () => {
    const futureDate = new Date(Date.now() + 600_000).toISOString();
    const chain = mockChain({
      single: vi.fn().mockResolvedValue({
        data: { id: "1", code: "AAAA-BBBB", status: "pending", expires_at: futureDate },
        error: null,
      }),
    });
    mockServiceClient.from.mockReturnValue(chain);

    const res = await pollPOST(mockRequest({ code: "AAAA-BBBB", poll_secret: "secret" }));
    const json = await res.json();

    expect(json.status).toBe("pending");
  });

  it("returns expired for a time-expired pending code and marks it expired", async () => {
    const pastDate = new Date(Date.now() - 600_000).toISOString();
    const chain = mockChain({
      single: vi.fn().mockResolvedValue({
        data: { id: "1", code: "AAAA-BBBB", status: "pending", expires_at: pastDate },
        error: null,
      }),
    });
    mockServiceClient.from.mockReturnValue(chain);

    const res = await pollPOST(mockRequest({ code: "AAAA-BBBB", poll_secret: "secret" }));
    const json = await res.json();

    expect(json.status).toBe("expired");
  });

  it("returns expired for already-expired status code", async () => {
    const futureDate = new Date(Date.now() + 600_000).toISOString();
    const chain = mockChain({
      single: vi.fn().mockResolvedValue({
        data: { id: "1", code: "AAAA-BBBB", status: "expired", expires_at: futureDate },
        error: null,
      }),
    });
    mockServiceClient.from.mockReturnValue(chain);

    const res = await pollPOST(mockRequest({ code: "AAAA-BBBB", poll_secret: "secret" }));
    const json = await res.json();

    expect(json.status).toBe("expired");
  });

  it("returns completed with token for a completed code", async () => {
    const futureDate = new Date(Date.now() + 600_000).toISOString();
    const chain = mockChain();
    chain.single = vi.fn()
      .mockResolvedValueOnce({
        data: {
          id: "1",
          code: "AAAA-BBBB",
          status: "completed",
          expires_at: futureDate,
          user_id: "user-abc",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user_id: "user-abc" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { username: "testuser" },
        error: null,
      });
    mockServiceClient.from.mockReturnValue(chain);

    (createCliToken as any).mockReturnValue("jwt-token-123");

    const res = await pollPOST(mockRequest({ code: "AAAA-BBBB", poll_secret: "secret" }));
    const json = await res.json();

    expect(json.status).toBe("completed");
    expect(json.token).toBe("jwt-token-123");
    expect(json.username).toBe("testuser");
    expect(createCliToken).toHaveBeenCalledWith("user-abc", "testuser");
    expect(chain.update).toHaveBeenCalledWith({
      status: "used",
      redeemed_at: expect.any(String),
    });
    expect(chain.is).toHaveBeenCalledWith("redeemed_at", null);
  });

  it("does not mint a token when a completed code was already redeemed", async () => {
    const futureDate = new Date(Date.now() + 600_000).toISOString();
    const chain = mockChain();
    chain.single = vi.fn()
      .mockResolvedValueOnce({
        data: {
          id: "1",
          code: "AAAA-BBBB",
          status: "completed",
          expires_at: futureDate,
          user_id: "user-abc",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116", message: "No rows" },
      });
    mockServiceClient.from.mockReturnValue(chain);

    const res = await pollPOST(mockRequest({ code: "AAAA-BBBB", poll_secret: "secret" }));
    const json = await res.json();

    expect(json.status).toBe("expired");
    expect(createCliToken).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/cli/verify", () => {
  it("rejects unauthenticated requests", async () => {
    mockAuthenticatedUser(null);

    const res = await verifyPOST(mockRequest({ code: "AAAA-BBBB", verify_secret: "secret" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns error when code is missing", async () => {
    mockAuthenticatedUser();

    const res = await verifyPOST(mockRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Missing code");
  });

  it("returns error when verify_secret is missing", async () => {
    mockAuthenticatedUser();

    const res = await verifyPOST(mockRequest({ code: "AAAA-BBBB" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Missing verify_secret");
  });

  it("returns error for invalid JSON", async () => {
    mockAuthenticatedUser();

    const req = new Request("http://localhost/api/auth/cli/verify", {
      method: "POST",
      body: "not json",
    });
    const res = await verifyPOST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid JSON");
  });

  it("rejects expired or already-completed zero-row updates", async () => {
    mockAuthenticatedUser();
    const chain = mockChain({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "No rows" },
      }),
    });
    mockServiceClient.from.mockReturnValue(chain);

    const res = await verifyPOST(mockRequest({ code: "AAAA-BBBB", verify_secret: "secret" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Authorization code is invalid or expired");
  });

  it("authorizes a pending unexpired code", async () => {
    mockAuthenticatedUser({ id: "user-abc" });
    const chain = mockChain({
      single: vi.fn().mockResolvedValue({
        data: { id: "code-1" },
        error: null,
      }),
    });
    mockServiceClient.from.mockReturnValue(chain);

    const res = await verifyPOST(mockRequest({ code: " AAAA-BBBB ", verify_secret: "secret" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(chain.update).toHaveBeenCalledWith({
      user_id: "user-abc",
      status: "completed",
    });
    expect(chain.eq).toHaveBeenCalledWith("code", "AAAA-BBBB");
    expect(chain.eq).toHaveBeenCalledWith("verify_secret_hash", expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(chain.eq).toHaveBeenCalledWith("status", "pending");
    expect(chain.gt).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(chain.select).toHaveBeenCalledWith("id");
    expect(chain.single).toHaveBeenCalled();
  });
});
