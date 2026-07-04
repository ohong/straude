import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/open-stats", () => ({
  refreshOpenStatsSnapshot: vi.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/refresh-open-stats/route";
import { refreshOpenStatsSnapshot } from "@/lib/open-stats";

function request(token?: string) {
  return new NextRequest(
    new URL("/api/cron/refresh-open-stats", "http://localhost"),
    {
      method: "GET",
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    },
  );
}

describe("GET /api/cron/refresh-open-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 without a bearer token", async () => {
    const res = await GET(request());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ error: "Unauthorized" });
    expect(refreshOpenStatsSnapshot).not.toHaveBeenCalled();
  });

  it("returns 401 with the wrong bearer token", async () => {
    const res = await GET(request("wrong-secret"));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ error: "Unauthorized" });
    expect(refreshOpenStatsSnapshot).not.toHaveBeenCalled();
  });

  it("refreshes and returns the persisted snapshot summary", async () => {
    vi.mocked(refreshOpenStatsSnapshot).mockResolvedValue({
      snapshotDate: "2026-07-04",
      totalSpend: 123.45,
      trackedUsers: 12,
    } as any);

    const res = await GET(request("cron-secret"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(refreshOpenStatsSnapshot).toHaveBeenCalledTimes(1);
    expect(json).toEqual({
      ok: true,
      snapshotDate: "2026-07-04",
      totalSpend: 123.45,
      trackedUsers: 12,
    });
  });

  it("returns 500 and logs when the refresh throws", async () => {
    const error = new Error("refresh failed");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(refreshOpenStatsSnapshot).mockRejectedValue(error);

    const res = await GET(request("cron-secret"));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json).toEqual({ error: "refresh failed" });
    expect(consoleError).toHaveBeenCalledWith(
      "refresh open stats snapshot failed:",
      error,
    );

    consoleError.mockRestore();
  });
});
