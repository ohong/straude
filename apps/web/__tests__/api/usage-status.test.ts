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

function mockUsageRows(rows: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: rows,
      error: null,
    }),
  };
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
    from: vi.fn(() => chain),
  } as any);
}

describe("GET /api/usage/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not activate users without usage", async () => {
    mockUsageRows([]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ has_data: false });
    expect(captureServerActivationEvent).not.toHaveBeenCalled();
  });

  it("captures first sync confirmation when web observes usage", async () => {
    mockUsageRows([
      {
        id: "usage-1",
        date: "2026-07-02",
        cost_usd: 1.25,
        total_tokens: 2500,
        session_count: 2,
        models: ["claude-sonnet-4-5-20250929"],
      },
    ]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.has_data).toBe(true);
    expect(captureServerActivationEvent).toHaveBeenCalledWith({
      event: "first_sync_confirmed",
      distinctId: "user-1",
      properties: expect.objectContaining({
        surface: "usage_status",
        activation_state: "activated",
        is_authenticated: true,
        session_count: 2,
        total_tokens: 2500,
        total_cost_usd: 1.25,
        "$insert_id": "first_sync_confirmed:user-1:usage-1",
      }),
    });
  });
});
