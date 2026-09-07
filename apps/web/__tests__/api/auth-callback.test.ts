import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/(auth)/callback/route";

const mocks = vi.hoisted(() => ({
  exchange: vi.fn(),
  getUser: vi.fn(),
  profile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { exchangeCodeForSession: mocks.exchange, getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.profile }) }) }),
  }),
}));
vi.mock("@/lib/analytics/server", () => ({
  captureServerActivationEvent: vi.fn(),
  identifyServerActivationUser: vi.fn(),
}));

function callback(next?: string, withCode = true) {
  const url = new URL("https://straude.com/callback");
  if (withCode) url.searchParams.set("code", "oauth-code");
  if (next !== undefined) url.searchParams.set("next", next);
  return GET(new Request(url));
}

describe("auth callback return path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchange.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.profile.mockResolvedValue({ data: { username: "developer", onboarding_completed: true } });
  });

  it.each([false, true])("returns a user with onboarding_completed=%s to explicit CLI approval", async (completed) => {
    mocks.profile.mockResolvedValue({ data: { username: "developer", onboarding_completed: completed } });
    const next = "/cli/verify?code=ABCD1234&verify_secret=secret%2Bwith%2Fsymbols%3D";
    const response = await callback(next);
    expect(response.headers.get("location")).toBe(`https://straude.com${next}`);
    expect(mocks.exchange).toHaveBeenCalledWith("oauth-code");
  });

  it("sends ordinary fresh signups to onboarding", async () => {
    mocks.profile.mockResolvedValue({ data: { username: null, onboarding_completed: false } });
    expect((await callback()).headers.get("location")).toBe("https://straude.com/onboarding");
  });

  it("sends ordinary returning users to feed", async () => {
    expect((await callback()).headers.get("location")).toBe("https://straude.com/feed");
  });

  it("honors an explicit onboarding recovery destination", async () => {
    expect((await callback("/onboarding")).headers.get("location")).toBe("https://straude.com/onboarding");
  });

  it.each([
    "https://evil.example", "//evil.example", "/\\evil.example", "/%5cevil.example",
    "/%2fevil.example", "/\tevil.example", "/%0a/evil.example", "/%0d/evil.example",
    "/%00evil.example", "/%7fevil.example", "javascript:alert(1)", "/%broken",
  ])("rejects an unsafe destination: %s", async (next) => {
    expect((await callback(next)).headers.get("location")).toBe("https://straude.com/feed");
  });

  it.each([true, false])("preserves the CLI return path when auth fails (withCode=%s)", async (withCode) => {
    mocks.exchange.mockResolvedValue({ error: { message: "Expired code" } });
    const next = "/cli/verify?code=ABCD1234&verify_secret=secret";
    const destination = new URL((await callback(next, withCode)).headers.get("location")!);
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("error")).toBe("auth");
    expect(destination.searchParams.get("next")).toBe(next);
  });

  it("does not forward an unsafe destination after an auth failure", async () => {
    mocks.exchange.mockResolvedValue({ error: { message: "Expired code" } });
    expect((await callback("//evil.example")).headers.get("location")).toBe("https://straude.com/login?error=auth");
  });
});
