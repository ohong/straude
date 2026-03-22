import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockDeleteUser = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({
    auth: { admin: { deleteUser: mockDeleteUser } },
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/users/me", () => {
  it("deletes account when username matches", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { username: "alice" },
              error: null,
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);
    mockDeleteUser.mockResolvedValue({ error: null });

    const res = await DELETE(makeRequest({ username: "alice" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("rejects unauthenticated request", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(client);

    const res = await DELETE(makeRequest({ username: "alice" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("rejects when username does not match", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { username: "alice" },
              error: null,
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);

    const res = await DELETE(makeRequest({ username: "wrong_name" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Username does not match");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("rejects when username confirmation is missing", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(client);

    const res = await DELETE(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Username confirmation is required");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("rejects empty string username", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(client);

    const res = await DELETE(makeRequest({ username: "   " }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Username confirmation is required");
  });

  it("returns 500 when admin.deleteUser fails", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { username: "alice" },
              error: null,
            }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(client);
    mockDeleteUser.mockResolvedValue({ error: { message: "Internal error" } });

    const res = await DELETE(makeRequest({ username: "alice" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to delete account");
  });

  it("handles malformed JSON body gracefully", async () => {
    const client: Record<string, any> = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(client);

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
