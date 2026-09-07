import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockUpdateUserById = vi.fn();
const mockServiceFrom = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({
    from: mockServiceFrom,
    auth: { admin: { updateUserById: mockUpdateUserById } },
  })),
}));

vi.mock("@/lib/constants/regions", () => ({
  COUNTRY_TO_REGION: {},
}));

vi.mock("@/lib/email/send-welcome-email", () => ({
  sendWelcomeEmail: vi.fn(),
}));

vi.mock("@/lib/referral", () => ({
  attributeReferral: vi.fn(),
}));

import { DELETE } from "@/app/api/users/me/route";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest(new URL("http://localhost/api/users/me"), {
    method: "DELETE",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Returns a chainable mock for service client .from(table).delete().eq()/.update().eq() */
function serviceChain(
  result: Record<string, unknown> | Promise<Record<string, unknown>> = { error: null },
) {
  const chain: Record<string, any> = {};
  for (const m of ["select", "delete", "update", "eq", "or", "single"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function mockAuthClient(userId: string | null, profileData?: Record<string, any>) {
  const client: Record<string, any> = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: profileData ?? null,
            error: profileData ? null : { code: "PGRST116" },
          }),
        }),
      }),
    }),
  };
  (createClient as any).mockResolvedValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockServiceFrom.mockReturnValue(serviceChain());
  mockUpdateUserById.mockResolvedValue({ error: null });
});

describe("DELETE /api/users/me", () => {
  const privateUsageTables = [
    "usage_installation_aliases",
    "usage_agent_daily",
    "usage_submission_outcomes",
    "usage_device_reconciliation_decisions",
    "usage_corrections_ledger",
    "usage_device_reconciliation_candidates",
  ];

  it("anonymizes account and bans auth user when username matches", async () => {
    mockAuthClient("user-1", { username: "alice" });

    const res = await DELETE(makeRequest({ username: "alice" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    // Verify posts, follows, notifications, etc. were deleted
    const deletedTables = mockServiceFrom.mock.calls.map((c: any[]) => c[0]);
    expect(deletedTables).toContain("posts");
    expect(deletedTables).toContain("follows");
    expect(deletedTables).toContain("notifications");
    expect(deletedTables).toContain("user_achievements");
    expect(deletedTables).toContain("user_levels");
    expect(deletedTables).toContain("device_usage");

    // Verify daily_usage was NOT deleted
    expect(deletedTables).not.toContain("daily_usage");
    // Verify comments and kudos were NOT deleted
    expect(deletedTables).not.toContain("comments");
    expect(deletedTables).not.toContain("kudos");
    expect(deletedTables).not.toContain("direct_messages");

    // Verify profile was anonymized (users table updated, not deleted)
    const usersCall = mockServiceFrom.mock.calls.find((c: any[]) => c[0] === "users");
    expect(usersCall).toBeDefined();

    // Verify auth user was banned, not deleted
    expect(mockUpdateUserById).toHaveBeenCalledWith("user-1", {
      ban_duration: "876600h",
    });
  });

  it("rejects unauthenticated request", async () => {
    mockAuthClient(null);

    const res = await DELETE(makeRequest({ username: "alice" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });

  it("erases owned v2 usage before anonymizing and waits for decisions before deleting candidates", async () => {
    mockAuthClient("user-1", { username: "alice" });
    let finishDecisionDeletion!: (result: Record<string, unknown>) => void;
    const decisionDeletion = new Promise<Record<string, unknown>>((resolve) => {
      finishDecisionDeletion = resolve;
    });
    const chains = new Map<string, ReturnType<typeof serviceChain>>();
    mockServiceFrom.mockImplementation((table: string) => {
      const chain = serviceChain(
        table === "usage_device_reconciliation_decisions" ? decisionDeletion : { error: null },
      );
      chains.set(table, chain);
      return chain;
    });

    const response = DELETE(makeRequest({ username: "alice" }));
    await vi.waitFor(() => {
      expect(chains.get("usage_device_reconciliation_decisions")?.delete).toHaveBeenCalled();
    });
    expect(chains.has("usage_device_reconciliation_candidates")).toBe(false);
    expect(chains.has("users")).toBe(false);
    expect(mockUpdateUserById).not.toHaveBeenCalled();

    finishDecisionDeletion({ error: null });
    expect((await response).status).toBe(200);

    for (const table of privateUsageTables) {
      const chain = chains.get(table)!;
      expect(chain.delete).toHaveBeenCalledOnce();
      expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(chain.delete.mock.invocationCallOrder[0]).toBeLessThan(
        chains.get("users")!.update.mock.invocationCallOrder[0],
      );
    }
    expect(chains.has("daily_usage")).toBe(false);
    expect(chains.has("usage_repair_batches")).toBe(false);
    expect(chains.get("users")!.delete).not.toHaveBeenCalled();
  });

  it.each(privateUsageTables)("stops anonymization when deleting %s fails", async (failedTable) => {
    mockAuthClient("user-1", { username: "alice" });
    mockServiceFrom.mockImplementation((table: string) => serviceChain({
      error: table === failedTable ? { message: "DB error" } : null,
    }));

    const res = await DELETE(makeRequest({ username: "alice" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to delete account data" });
    expect(mockServiceFrom).not.toHaveBeenCalledWith("users");
    expect(mockUpdateUserById).not.toHaveBeenCalled();
    if (failedTable === "usage_device_reconciliation_decisions") {
      expect(mockServiceFrom).not.toHaveBeenCalledWith("usage_device_reconciliation_candidates");
    }
  });

  it("rejects when username does not match", async () => {
    mockAuthClient("user-1", { username: "alice" });

    const res = await DELETE(makeRequest({ username: "wrong_name" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Username does not match");
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });

  it("rejects when username confirmation is missing", async () => {
    mockAuthClient("user-1");

    const res = await DELETE(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Username confirmation is required");
  });

  it("rejects empty string username", async () => {
    mockAuthClient("user-1");

    const res = await DELETE(makeRequest({ username: "   " }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Username confirmation is required");
  });

  it("returns 500 when deletion fails", async () => {
    mockAuthClient("user-1", { username: "alice" });
    mockServiceFrom.mockReturnValue(serviceChain({ error: { message: "DB error" } }));

    const res = await DELETE(makeRequest({ username: "alice" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to delete account data");
  });

  it("returns 500 when ban fails", async () => {
    mockAuthClient("user-1", { username: "alice" });
    mockUpdateUserById.mockResolvedValue({ error: { message: "Auth error" } });

    const res = await DELETE(makeRequest({ username: "alice" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to disable account");
  });

  it("handles malformed JSON body gracefully", async () => {
    mockAuthClient("user-1");

    const req = new NextRequest(new URL("http://localhost/api/users/me"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Username confirmation is required");
  });
});
