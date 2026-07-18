import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getClaims = vi.fn();
  const single = vi.fn();
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return { getClaims, single, eq, select, from };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mocks.getClaims },
  })),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({ from: mocks.from })),
}));

import { getAuthContext, getAuthIdentity } from "@/lib/supabase/auth";

describe("Supabase auth context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-123",
          email: "person@example.com",
        },
      },
      error: null,
    });
    mocks.single.mockResolvedValue({
      data: {
        username: "person",
        avatar_url: null,
        display_name: "Person",
        team_url: null,
        team_favicon_url: null,
        onboarding_completed: true,
        streak_freezes: 2,
      },
      error: null,
    });
  });

  it("derives a minimal verified identity from JWT claims", async () => {
    await expect(getAuthIdentity()).resolves.toEqual({
      id: "user-123",
      email: "person@example.com",
    });
  });

  it("loads the shell profile once for the verified subject", async () => {
    await expect(getAuthContext()).resolves.toMatchObject({
      identity: { id: "user-123" },
      profile: { username: "person", streak_freezes: 2 },
    });

    expect(mocks.from).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("users");
    expect(mocks.eq).toHaveBeenCalledWith("id", "user-123");
    expect(mocks.single).toHaveBeenCalledOnce();
  });

  it("does not query a profile when verified claims have no subject", async () => {
    mocks.getClaims.mockResolvedValueOnce({
      data: { claims: {} },
      error: null,
    });

    await expect(getAuthContext()).resolves.toEqual({
      identity: null,
      profile: null,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
