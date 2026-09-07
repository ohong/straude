import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), or: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import SearchPage from "@/app/(app)/search/page";
import { buildUserSearchFilter } from "@/lib/data/user-search";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ from: mocks.from });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ or: mocks.or });
  mocks.or.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue({ data: [], error: null });
});

describe("server search deep links", () => {
  it.each(["alice_dev", "Alice, (Builder)", 'a"b'])
    ("uses the API's validated filter for %s", async (query) => {
      const search = buildUserSearchFilter(query);
      expect(search.ok).toBe(true);
      await SearchPage({ searchParams: Promise.resolve({ q: query }) });
      expect(mocks.or).toHaveBeenCalledExactlyOnceWith(search.ok ? search.filter : "");
      expect(mocks.eq).toHaveBeenCalledWith("is_public", true);
    });

  it.each(["**", "a".repeat(65), "%%%"])("does not query with unsupported input %s", async (q) => {
    await SearchPage({ searchParams: Promise.resolve({ q }) });
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
