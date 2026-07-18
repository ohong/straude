import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options?: { httpOnly?: boolean; path?: string };
};

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({
  getMissingSupabaseBrowserEnv: vi.fn(() => []),
  formatSupabaseEnvHelp: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    (
      _url: string,
      _key: string,
      options: { cookies: { setAll: (cookies: CookieToSet[]) => void } }
    ) => {
      options.cookies.setAll([
        {
          name: "sb-test-auth-token",
          value: "refreshed-token",
          options: { httpOnly: true, path: "/" },
        },
      ]);
      return { auth: { getClaims: mocks.getClaims } };
    }
  ),
}));

import { updateSession } from "@/lib/supabase/middleware";

describe("Supabase middleware auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  });

  it("uses verified claims and preserves refreshed cookies on redirects", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "user-123" } },
      error: null,
    });

    const response = await updateSession(
      new NextRequest("https://straude.com/")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://straude.com/feed");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe(
      "refreshed-token"
    );
    expect(response.headers.get("Server-Timing")).toMatch(/^mw-auth;dur=\d+$/);
    expect(mocks.getClaims).toHaveBeenCalledOnce();
  });

  it("redirects an unverified protected request to login", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });

    const response = await updateSession(
      new NextRequest("https://straude.com/messages")
    );

    expect(response.headers.get("location")).toBe("https://straude.com/login");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe(
      "refreshed-token"
    );
  });
});
