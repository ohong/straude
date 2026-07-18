import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthIdentity: vi.fn(),
  profileSingle: vi.fn(),
  followMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  getAuthIdentity: mocks.getAuthIdentity,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: mocks.followMaybeSingle })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: mocks.profileSingle })),
      })),
    })),
  })),
}));

import { getProfileAccessContext } from "@/lib/profile-access";

describe("profile access loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthIdentity.mockResolvedValue({ id: "viewer-1" });
    mocks.followMaybeSingle.mockResolvedValue({ data: { id: "follow-1" } });
  });

  it("starts the username-scoped follow lookup without waiting for the profile", async () => {
    let resolveProfile: ((value: unknown) => void) | undefined;
    mocks.profileSingle.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );

    const accessPromise = getProfileAccessContext<{ id: string; is_public: boolean }>(
      "alice",
      "id, is_public",
    );
    await vi.waitFor(() => expect(mocks.followMaybeSingle).toHaveBeenCalledOnce());

    resolveProfile?.({
      data: { id: "profile-1", is_public: false },
      error: null,
    });

    await expect(accessPromise).resolves.toMatchObject({
      canView: true,
      isFollowing: true,
    });
  });
});
