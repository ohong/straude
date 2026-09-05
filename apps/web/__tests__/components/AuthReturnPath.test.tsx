import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/(auth)/login/page";
import SignupPage from "@/app/(auth)/signup/page";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  otp: vi.fn(),
  oauth: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp: mocks.otp, signInWithOAuth: mocks.oauth } }),
}));
vi.mock("@/lib/analytics/client", () => ({ trackActivationEvent: vi.fn() }));

const returnTo = "/cli/verify?code=ABCD1234&verify_secret=secret%2Bwith%2Fsymbols%3D";

describe.each([
  { name: "login", Page: LoginPage, link: "Sign up", otherPath: "/signup" },
  { name: "signup", Page: SignupPage, link: "Log in", otherPath: "/login" },
])("$name return path", ({ Page, link, otherPath }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = new URLSearchParams({ next: returnTo });
    mocks.otp.mockResolvedValue({ error: null });
    mocks.oauth.mockResolvedValue({ error: null });
  });
  afterEach(cleanup);

  it("preserves the complete CLI request in the magic link callback", async () => {
    render(<Page />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "dev@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));
    await waitFor(() => expect(mocks.otp).toHaveBeenCalledOnce());
    const callback = new URL(mocks.otp.mock.calls[0][0].options.emailRedirectTo);
    expect(callback.origin).toBe(window.location.origin);
    expect(callback.pathname).toBe("/callback");
    expect(callback.searchParams.get("next")).toBe(returnTo);
    await screen.findByText("Check your email");
  });

  it("preserves the complete CLI request in the GitHub callback", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    expect(mocks.oauth).toHaveBeenCalledOnce();
    expect(mocks.oauth.mock.calls[0][0].provider).toBe("github");
    const callback = new URL(mocks.oauth.mock.calls[0][0].options.redirectTo);
    expect(callback.pathname).toBe("/callback");
    expect(callback.searchParams.get("next")).toBe(returnTo);
  });

  it("keeps the CLI request when switching between login and signup", () => {
    render(<Page />);
    const destination = new URL(screen.getByRole("link", { name: link }).getAttribute("href")!, window.location.origin);
    expect(destination.pathname).toBe(otherPath);
    expect(destination.searchParams.get("next")).toBe(returnTo);
  });

  it("supports returning to onboarding after session recovery", () => {
    mocks.params = new URLSearchParams({ next: "/onboarding" });
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    expect(new URL(mocks.oauth.mock.calls[0][0].options.redirectTo).searchParams.get("next")).toBe("/onboarding");
  });

  it.each([null, "https://evil.example", "/\\evil.example", "//evil.example"])("omits an absent or unsafe return path: %s", (next) => {
    mocks.params = new URLSearchParams(next ? { next } : {});
    render(<Page />);
    expect(screen.getByRole("link", { name: link })).toHaveAttribute("href", otherPath);
    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    expect(mocks.oauth.mock.calls[0][0].options.redirectTo).toBe(`${window.location.origin}/callback`);
  });
});
