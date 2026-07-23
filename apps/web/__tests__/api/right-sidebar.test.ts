import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadUsageTotals: vi.fn(),
  loadPublicData: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/auth", () => ({
  getAuthIdentity: mocks.getAuthIdentity,
}));

vi.mock("@/lib/data/usage-totals", () => ({
  loadUsageTotals: mocks.loadUsageTotals,
}));

vi.mock("@/lib/data/right-sidebar", () => ({
  loadRightSidebarPublicData: mocks.loadPublicData,
}));

import { GET } from "@/app/api/app/right-sidebar/route";

function clientFor(userId: string, followingIds: string[]) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: followingIds.map((following_id) => ({ following_id })),
          error: null,
        }),
      })),
    })),
  };
}

describe("GET /api/app/right-sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadUsageTotals.mockImplementation(async (_client: unknown, userId: string) => ({
      totalTokens: userId === "viewer-1" ? 100 : 200,
      totalCost: 0,
    }));
    mocks.loadPublicData.mockResolvedValue({
      activeUsers: [
        { id: "a", username: "a", avatar_url: null, bio: null },
        { id: "b", username: "b", avatar_url: null, bio: null },
        { id: "c", username: "c", avatar_url: null, bio: null },
      ],
      newSignups: [],
      pinnedUsers: [],
      topUsers: [],
    });
  });

  it("keeps follows and usage totals request-scoped across users", async () => {
    mocks.createClient
      .mockResolvedValueOnce(clientFor("viewer-1", ["a"]))
      .mockResolvedValueOnce(clientFor("viewer-2", ["b"]));
    mocks.getAuthIdentity
      .mockResolvedValueOnce({ id: "viewer-1", email: null })
      .mockResolvedValueOnce({ id: "viewer-2", email: null });

    const first = await GET();
    const second = await GET();
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(firstBody.suggested.map((user: { id: string }) => user.id)).toEqual([
      "b",
      "c",
    ]);
    expect(secondBody.suggested.map((user: { id: string }) => user.id)).toEqual([
      "a",
      "c",
    ]);
    expect(firstBody.totalOutputTokens).toBe(100);
    expect(secondBody.totalOutputTokens).toBe(200);
    expect(mocks.loadPublicData).toHaveBeenCalledTimes(2);
    expect(mocks.loadUsageTotals.mock.calls.map((call) => call[1])).toEqual([
      "viewer-1",
      "viewer-2",
    ]);
  });

  it("only admits public pinned users into the shared candidate cache", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/data/right-sidebar.ts"),
      "utf8"
    );

    expect(source).toMatch(
      /from\("users"\)[\s\S]*?\.eq\("is_public", true\)[\s\S]*?\.eq\("is_pinned_suggestion", true\)/
    );
    expect(source).not.toContain("follower_id");
    expect(source).not.toContain("loadUsageTotals");
  });
});
