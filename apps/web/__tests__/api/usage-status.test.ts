import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerActivationEvent: vi.fn().mockResolvedValue(true),
}));

import { GET } from "@/app/api/usage/status/route";
import { captureServerActivationEvent } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";

function mockUsageStatus({
  latestUsage,
  totals = { total_cost: 0, total_tokens: 0 },
  latestPost = null,
  latestUsageError = null,
}: {
  latestUsage: unknown;
  totals?: unknown;
  latestPost?: unknown;
  latestUsageError?: unknown;
}) {
  const latestUsageChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: latestUsage,
      error: latestUsageError,
    }),
  };
  const latestPostChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: latestPost,
      error: null,
    }),
  };
  const rpcChain = {
    single: vi.fn().mockResolvedValue({
      data: totals,
      error: null,
    }),
  };
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "daily_usage") return latestUsageChain;
      if (table === "posts") return latestPostChain;
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn(() => rpcChain),
  } as any);

  return { latestUsageChain, latestPostChain, rpcChain };
}

describe("GET /api/usage/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not activate users without usage", async () => {
    const { latestUsageChain } = mockUsageStatus({ latestUsage: null });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ has_data: false, has_usage: false });
    expect(latestUsageChain.limit).toHaveBeenCalledWith(1);
    expect(captureServerActivationEvent).not.toHaveBeenCalled();
  });

  it("captures first sync confirmation when web observes usage", async () => {
    mockUsageStatus({
      latestUsage: {
        id: "usage-1",
        date: "2026-07-02",
        created_at: "2026-07-02T10:00:00.000Z",
        cost_usd: 1.25,
        total_tokens: 2500,
        output_tokens: 1200,
        session_count: 2,
        models: ["claude-sonnet-4-5-20250929"],
      },
      totals: {
        total_cost: 7.75,
        total_tokens: 9000,
      },
      latestPost: { id: "post-1" },
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.has_data).toBe(true);
    expect(json.has_usage).toBe(true);
    expect(json.cost_usd).toBe(7.75);
    expect(json.total_tokens).toBe(9000);
    expect(json.session_count).toBe(2);
    expect(json.latest_usage_id).toBe("usage-1");
    expect(json.latest_usage_at).toBe("2026-07-02T10:00:00.000Z");
    expect(json.latest_post_url).toBe("/post/post-1");
    expect(captureServerActivationEvent).toHaveBeenCalledWith({
      event: "first_sync_confirmed",
      distinctId: "user-1",
      properties: expect.objectContaining({
        surface: "usage_status",
        activation_state: "activated",
        is_authenticated: true,
        session_count: 2,
        total_tokens: 9000,
        total_cost_usd: 7.75,
        "$insert_id": "first_sync_confirmed:user-1:usage-1",
      }),
    });
  });
});
