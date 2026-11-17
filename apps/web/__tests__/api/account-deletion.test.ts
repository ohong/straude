import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({
    rpc,
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
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "account-id" } } }) },
  } as Awaited<ReturnType<typeof createClient>>);
});

describe("DELETE /api/users/me", () => {
  it.each(["alice", null])("accepts explicit confirmation for %s", async username => {
    rpc.mockResolvedValue({ data: true });
    expect((await DELETE(makeRequest({ username }))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("delete_straude_account", { p_user_id: "account-id", p_username: username });
  });
  it("requires explicit confirmation", async () => {
    expect((await DELETE(makeRequest({}))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reports confirmation mismatch and transaction failure", async () => {
    rpc.mockResolvedValueOnce({ data: false }).mockResolvedValueOnce({ error: {} });
    expect((await DELETE(makeRequest({ username: "old" }))).status).toBe(400);
    expect((await DELETE(makeRequest({ username: "alice" }))).status).toBe(500);
  });
});
