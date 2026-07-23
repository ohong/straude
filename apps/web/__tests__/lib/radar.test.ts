import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({
    rpc: mocks.rpc,
  })),
}));

import { computeRadarScores } from "@/lib/radar";

describe("computeRadarScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockReturnValue({ single: mocks.single });
  });

  it("reads the service-only profile snapshot RPC once", async () => {
    mocks.single.mockResolvedValue({
      data: {
        output: 91,
        intensity: 72,
        consistency: 63,
        toolkit: 54,
        community: 45,
      },
      error: null,
    });

    await expect(computeRadarScores("user-1")).resolves.toEqual({
      output: 91,
      intensity: 72,
      consistency: 63,
      toolkit: 54,
      community: 45,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_profile_stats", {
      p_user_id: "user-1",
    });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.single).toHaveBeenCalledOnce();
  });

  it("fails closed when the snapshot is unavailable", async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: { message: "snapshot missing" },
    });

    await expect(computeRadarScores("user-1")).rejects.toThrow(
      "snapshot missing"
    );
  });
});
