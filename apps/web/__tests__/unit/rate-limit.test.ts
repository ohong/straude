import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({ rpc: mockRpc })),
}));

import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the RPC allows the request", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ allowed: true, retry_after_seconds: 0 }],
      error: null,
    });

    const limited = await rateLimit("upload", "user-1", { limit: 10 });

    expect(limited).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith("check_rate_limit", {
      p_name: "upload",
      p_subject: "user-1",
      p_limit: 10,
      p_window_seconds: 60,
    });
  });

  it("returns 429 with Retry-After when the RPC denies the request", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ allowed: false, retry_after_seconds: 17 }],
      error: null,
    });

    const limited = await rateLimit("ai-caption:minute", "user-1", {
      limit: 5,
      windowSeconds: 60,
    });

    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("Retry-After")).toBe("17");
    await expect(limited?.json()).resolves.toEqual({
      error: "Too many requests. Please try again later.",
    });
  });

  it("returns 503 when the RPC fails", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "database unavailable" },
    });

    const limited = await rateLimit("upload", "user-1", { limit: 10 });

    expect(limited?.status).toBe(503);
    await expect(limited?.json()).resolves.toEqual({
      error: "Rate limit check failed",
    });
  });
});
