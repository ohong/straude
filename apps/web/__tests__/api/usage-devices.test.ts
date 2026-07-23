import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/cli-auth", () => ({
  verifyCliTokenWithRefresh: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const rpc = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({ rpc })),
}));

import { GET } from "@/app/api/usage/devices/route";
import { POST } from "@/app/api/usage/devices/resolve/route";
import { verifyCliTokenWithRefresh } from "@/lib/api/cli-auth";
import { createClient } from "@/lib/supabase/server";

const CANDIDATE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CANDIDATE = {
  id: CANDIDATE_ID,
  device_id_a: "11111111-2222-4333-8444-555555555555",
  device_id_b: "66666666-7777-4888-8999-000000000000",
  normalized_hostname: "work-macbook",
  overlap_dates: ["2026-07-21", "2026-07-22"],
  status: "pending",
  created_at: "2026-07-23T10:00:00.000Z",
};

function cliRequest(url: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: {
      authorization: "Bearer fixture",
      ...init?.headers,
    },
  });
}

function webSession(userId: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyCliTokenWithRefresh).mockReturnValue(null);
  webSession(null);
});

describe("GET /api/usage/devices", () => {
  it("lists only the authenticated CLI user's reconciliation candidates", async () => {
    vi.mocked(verifyCliTokenWithRefresh).mockReturnValue({
      userId: "cli-user",
      username: "cli",
      refreshedToken: "refreshed",
    });
    rpc.mockResolvedValue({ data: [CANDIDATE], error: null });

    const response = await GET(cliRequest("http://localhost/api/usage/devices"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Straude-Refreshed-Token")).toBe("refreshed");
    expect(await response.json()).toEqual({ candidates: [CANDIDATE] });
    expect(rpc).toHaveBeenCalledWith("list_usage_device_candidates", {
      p_user_id: "cli-user",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("supports an authenticated web session", async () => {
    webSession("web-user");
    rpc.mockResolvedValue({ data: [], error: null });

    const response = await GET(new Request("http://localhost/api/usage/devices"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ candidates: [] });
    expect(rpc).toHaveBeenCalledWith("list_usage_device_candidates", {
      p_user_id: "web-user",
    });
  });

  it("does not let an invalid CLI bearer token fall through to cookie auth", async () => {
    webSession("web-user");

    const response = await GET(cliRequest("http://localhost/api/usage/devices"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: "Unauthorized" },
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a stable error without leaking database details", async () => {
    webSession("web-user");
    rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "sensitive database detail" },
    });

    const response = await GET(new Request("http://localhost/api/usage/devices"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "candidate_list_failed",
        message: "Failed to list usage device candidates",
      },
    });
  });
});

describe("POST /api/usage/devices/resolve", () => {
  it.each(["merge", "keep_separate"] as const)(
    "resolves a candidate with the %s decision",
    async (decision) => {
      vi.mocked(verifyCliTokenWithRefresh).mockReturnValue({
        userId: "cli-user",
        username: "cli",
        refreshedToken: null,
      });
      rpc.mockResolvedValue({
        data: {
          id: CANDIDATE_ID,
          status: "resolved",
          decision,
          canonical_device_id:
            decision === "merge" ? CANDIDATE.device_id_a : null,
        },
        error: null,
      });

      const response = await POST(cliRequest(
        "http://localhost/api/usage/devices/resolve",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ candidate_id: CANDIDATE_ID, decision }),
        },
      ));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        candidate: {
          id: CANDIDATE_ID,
          status: "resolved",
          decision,
          ...(decision === "merge"
            ? { canonical_device_id: CANDIDATE.device_id_a }
            : {}),
        },
      });
      expect(rpc).toHaveBeenCalledWith("resolve_usage_device_candidate", {
        p_user_id: "cli-user",
        p_candidate_id: CANDIDATE_ID,
        p_decision: decision,
      });
    },
  );

  it("rejects malformed decisions before authentication or database access", async () => {
    const response = await POST(new Request(
      "http://localhost/api/usage/devices/resolve",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidate_id: CANDIDATE_ID,
          decision: "delete",
        }),
      },
    ));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "decision must be merge or keep_separate",
      },
    });
    expect(verifyCliTokenWithRefresh).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps an inaccessible candidate to a stable 404 response", async () => {
    webSession("web-user");
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "candidate not found" },
    });

    const response = await POST(new Request(
      "http://localhost/api/usage/devices/resolve",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidate_id: CANDIDATE_ID,
          decision: "merge",
        }),
      },
    ));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "candidate_not_found",
        message: "Usage device candidate not found",
      },
    });
  });
});
