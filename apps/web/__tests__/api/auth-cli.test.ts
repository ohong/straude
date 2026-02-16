import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/api/cli-auth", () => ({
  createCliToken: vi.fn(),
}));

import { POST as initPOST } from "@/app/api/auth/cli/init/route";
import { POST as pollPOST } from "@/app/api/auth/cli/poll/route";
import { createClient } from "@/lib/supabase/server";
import { createCliToken } from "@/lib/api/cli-auth";

function mockSupabase(overrides = {}) {
  const client: Record<string, any> = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
  };
  const chain: Record<string, any> = {
    insert: vi.fn().mockReturnValue({ error: null }),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  client.from.mockReturnValue(chain);
  (createClient as any).mockResolvedValue(client);
  return { client, chain };
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
  process.env.NEXT_PUBLIC_APP_URL = "https://straude.com";
});

describe("POST /api/auth/cli/init", () => {
  it("creates a code and returns code + verify_url", async () => {
    const { chain } = mockSupabase();
    chain.insert.mockReturnValue({ error: null });

    const res = await initPOST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(json.verify_url).toBe(
      `https://straude.com/cli/verify?code=${json.code}`
    );
  });

  it("returns 500 when insert fails", async () => {
    const { chain } = mockSupabase();
    chain.insert.mockReturnValue({ error: { message: "DB error" } });

    const res = await initPOST();
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to create auth code");
  });
});

describe("POST /api/auth/cli/poll", () => {
  it("returns error for invalid JSON", async () => {
    mockSupabase();
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
    mockSupabase();
    const res = await pollPOST(mockRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Missing code");
  });

  it("returns expired when code not found", async () => {
    const { chain } = mockSupabase();
    chain.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const res = await pollPOST(mockRequest({ code: "XXXX-YYYY" }));
    const json = await res.json();

    expect(json.status).toBe("expired");
  });

  it("returns pending for a pending code", async () => {
    const futureDate = new Date(Date.now() + 600_000).toISOString();
    const { chain } = mockSupabase();
    chain.single.mockResolvedValue({
      data: { id: "1", code: "AAAA-BBBB", status: "pending", expires_at: futureDate },
      error: null,
    });

    const res = await pollPOST(mockRequest({ code: "AAAA-BBBB" }));
    const json = await res.json();

    expect(json.status).toBe("pending");
  });

  it("returns expired for a time-expired pending code and marks it expired", async () => {
    const pastDate = new Date(Date.now() - 600_000).toISOString();
    const { chain } = mockSupabase();
    chain.single.mockResolvedValue({
      data: {
        id: "1",
        code: "AAAA-BBBB",
        status: "pending",
        expires_at: pastDate,
      },
      error: null,
    });
    // The update chain
    chain.update.mockReturnThis();
    chain.eq.mockReturnThis();

    const res = await pollPOST(mockRequest({ code: "AAAA-BBBB" }));
    const json = await res.json();

    expect(json.status).toBe("expired");
  });

  it("returns expired for already-expired status code", async () => {
    const futureDate = new Date(Date.now() + 600_000).toISOString();
    const { chain } = mockSupabase();
    chain.single.mockResolvedValue({
      data: {
        id: "1",
        code: "AAAA-BBBB",
        status: "expired",
        expires_at: futureDate,
      },
      error: null,
    });

    const res = await pollPOST(mockRequest({ code: "AAAA-BBBB" }));
    const json = await res.json();

    expect(json.status).toBe("expired");
  });

  it("returns completed with token for a completed code", async () => {
    const futureDate = new Date(Date.now() + 600_000).toISOString();
    const { client, chain } = mockSupabase();
    // First .single() call returns the auth code
    chain.single
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
      // Second .single() call returns the user
      .mockResolvedValueOnce({
        data: { username: "testuser" },
        error: null,
      });

    (createCliToken as any).mockReturnValue("jwt-token-123");

    const res = await pollPOST(mockRequest({ code: "AAAA-BBBB" }));
    const json = await res.json();

    expect(json.status).toBe("completed");
    expect(json.token).toBe("jwt-token-123");
    expect(json.username).toBe("testuser");
    expect(createCliToken).toHaveBeenCalledWith("user-abc", "testuser");
  });
});
