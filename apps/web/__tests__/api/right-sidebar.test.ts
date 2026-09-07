import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getServiceClient: vi.fn(), loadUsageTotals: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/service", () => ({ getServiceClient: mocks.getServiceClient }));
vi.mock("@/lib/data/usage-totals", () => ({ loadUsageTotals: mocks.loadUsageTotals }));
import { GET } from "@/app/api/app/right-sidebar/route";

function query(data: unknown[]) {
  const result = { data, error: null };
  const chain = {
    select: vi.fn(() => chain), eq: vi.fn(() => chain), not: vi.fn(() => chain),
    order: vi.fn(() => chain), limit: vi.fn(() => chain),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function fixture(userId: string, followingIds: string[]) {
  const top = query([]);
  const follows = query(followingIds.map(following_id => ({ following_id })));
  const pinned = query([]);
  const active = query([
    { users: { id: "public", username: "public", avatar_url: null, bio: null, is_public: true } },
    { users: { id: "private", username: "private", avatar_url: null, bio: null, is_public: false } },
  ]);
  const signup = query([]);
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn((table: string) => table === "follows" ? follows : top),
  };
  const service = { from: vi.fn().mockReturnValueOnce(pinned).mockReturnValueOnce(active).mockReturnValueOnce(signup) };
  return { client, service, pinned, active, signup };
}

describe("GET /api/app/right-sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadUsageTotals.mockImplementation(async (_client: unknown, id: string) => ({ totalTokens: id === "viewer-1" ? 100 : 200, totalCost: 0 }));
  });

  it("keeps follows, exclusions, and totals scoped to each viewer", async () => {
    const first = fixture("viewer-1", ["followed-1"]);
    const second = fixture("viewer-2", ["followed-2"]);
    mocks.createClient.mockResolvedValueOnce(first.client).mockResolvedValueOnce(second.client);
    mocks.getServiceClient.mockReturnValueOnce(first.service).mockReturnValueOnce(second.service);
    const firstBody = await (await GET()).json();
    const secondBody = await (await GET()).json();
    expect(firstBody.totalOutputTokens).toBe(100);
    expect(secondBody.totalOutputTokens).toBe(200);
    expect(first.active.not).toHaveBeenCalledWith("user_id", "in", "(viewer-1,followed-1)");
    expect(second.active.not).toHaveBeenCalledWith("user_id", "in", "(viewer-2,followed-2)");
  });

  it("filters private candidates and only queries public pins and signups", async () => {
    const state = fixture("viewer-1", []);
    mocks.createClient.mockResolvedValue(state.client);
    mocks.getServiceClient.mockReturnValue(state.service);
    const body = await (await GET()).json();
    expect(body.suggested.map((user: { id: string }) => user.id)).toEqual(["public"]);
    expect(state.pinned.eq).toHaveBeenCalledWith("is_public", true);
    expect(state.signup.eq).toHaveBeenCalledWith("is_public", true);
  });

  it("rejects guests before querying sidebar data", async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.getServiceClient).not.toHaveBeenCalled();
  });
});
