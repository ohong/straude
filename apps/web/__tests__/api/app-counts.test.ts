import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { GET } from "@/app/api/app/counts/route";
import { createClient } from "@/lib/supabase/server";

const createClientMock = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/app/counts", () => {
  it("returns 401 for unauthenticated users", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

});
