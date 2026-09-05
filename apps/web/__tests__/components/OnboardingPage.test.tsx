import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingPage from "@/app/(onboarding)/onboarding/page";

const { push, track } = vi.hoisted(() => ({ push: vi.fn(), track: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/analytics/client", () => ({ trackActivationEvent: track }));

const usage = {
  has_data: true,
  has_usage: true,
  cost_usd: 12.34,
  total_tokens: 12_000,
  session_count: 3,
  top_model: "gpt-5.4",
  latest_usage_id: "usage-1",
  latest_usage_date: "2026-09-03",
  latest_post_url: "/post/post-1",
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const getStatus = vi.fn();
const completeSetup = vi.fn();
const copy = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;

async function flush() {
  await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  getStatus.mockReset().mockImplementation(() => Promise.resolve(response({ has_data: false })));
  completeSetup.mockReset().mockImplementation(() => Promise.resolve(response({ username: "oscar" })));
  copy.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/api/usage/status") return getStatus(options);
    if (options?.method === "PATCH") return completeSetup(options);
    return Promise.resolve(response({ username: "oscar" }));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("first-sync onboarding", () => {
  it("shows the command immediately without requiring a profile save", async () => {
    render(<OnboardingPage />);
    expect(screen.getByRole("textbox", { name: "Sync command" })).toHaveValue("npx straude@latest");
    expect(screen.queryByRole("textbox", { name: /username/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Ready to sync")).not.toBeInTheDocument();
    await flush();
    expect(completeSetup).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => url.includes("check-username"))).toBe(false);
  });

  it("activates only after confirmed usage and a successful completion save", async () => {
    let resolveCompletion!: (value: Response) => void;
    completeSetup.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveCompletion = resolve; }));
    getStatus.mockResolvedValueOnce(response({ has_data: false })).mockResolvedValueOnce(response(usage));
    render(<OnboardingPage />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Copy sync command" }));
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(screen.getByText("Finishing setup…")).toBeInTheDocument();
    expect(track).not.toHaveBeenCalledWith("activation_completed", expect.anything());
    expect(screen.queryByText("Your first sync is complete")).not.toBeInTheDocument();
    expect(JSON.parse(completeSetup.mock.calls[0][0].body)).toEqual({
      onboarding_completed: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    await act(async () => { resolveCompletion(response({})); });
    expect(screen.getByText("Your first sync is complete")).toBeInTheDocument();
    expect(screen.getByText("$12.34")).toBeInTheDocument();
    expect(screen.getByText("12k")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.4")).toBeInTheDocument();
    expect(screen.getByText("2026-09-03")).toBeInTheDocument();
    expect(screen.queryByText("Sessions")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add a handle/ })).toHaveAttribute("href", "/settings");
    expect(track).toHaveBeenCalledWith("activation_completed", expect.objectContaining({
      has_existing_usage: false,
      session_count: 3,
      "$insert_id": "activation_completed:usage-1",
    }));
    fireEvent.click(screen.getByRole("button", { name: "View your profile" }));
    expect(push).toHaveBeenCalledWith("/u/oscar");
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(completeSetup).toHaveBeenCalledTimes(1);
  });

  it.each(["network", "http"])("recovers from a %s status failure", async (failure) => {
    if (failure === "network") getStatus.mockRejectedValueOnce(new Error("offline"));
    else getStatus.mockResolvedValueOnce(response({}, 503));
    getStatus.mockResolvedValueOnce(response(usage));
    render(<OnboardingPage />);
    await flush();
    expect(screen.getByRole("alert")).toHaveTextContent("could not check your usage");
    expect(completeSetup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await flush();
    expect(screen.getByText("Your first sync is complete")).toBeInTheDocument();
  });

  it.each(["network", "http"])("retries completion after a %s failure without claiming activation", async (failure) => {
    getStatus.mockResolvedValueOnce(response(usage));
    if (failure === "network") completeSetup.mockRejectedValueOnce(new Error("offline"));
    else completeSetup.mockResolvedValueOnce(response({ error: "Unable to verify first sync" }, 500));
    render(<OnboardingPage />);
    await flush();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(track).not.toHaveBeenCalledWith("activation_completed", expect.anything());
    expect(screen.queryByText("Your first sync is complete")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry setup" }));
    await flush();
    expect(screen.getByText("Your first sync is complete")).toBeInTheDocument();
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(completeSetup).toHaveBeenCalledTimes(2);
    expect(track.mock.calls.filter(([event]) => event === "activation_completed")).toHaveLength(1);
  });

  it("offers sign-in recovery with an onboarding return path", async () => {
    getStatus.mockResolvedValueOnce(response({}, 401));
    render(<OnboardingPage />);
    await flush();
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute("href", "/login?next=%2Fonboarding");
    expect(completeSetup).not.toHaveBeenCalled();
  });

  it("keeps the command selectable when clipboard access is refused", async () => {
    copy.mockRejectedValueOnce(new Error("denied"));
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Copy sync command" }));
    await flush();
    expect(screen.getByText(/copy it manually/)).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Sync command" }) as HTMLInputElement;
    fireEvent.focus(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("npx straude@latest".length);
    expect(track).not.toHaveBeenCalledWith("sync_command_copied", expect.anything());
  });

  it("does not activate on explore or act on an in-flight check after unmount", async () => {
    let resolveStatus!: (value: Response) => void;
    getStatus.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveStatus = resolve; }));
    const { unmount } = render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Explore without syncing" }));
    expect(push).toHaveBeenCalledWith("/feed");
    unmount();
    expect(getStatus.mock.calls[0][0].signal.aborted).toBe(true);
    await act(async () => { resolveStatus(response(usage)); });
    expect(completeSetup).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith("activation_completed", expect.anything());
  });

  it("does not overlap slow status requests", async () => {
    let resolveStatus!: (value: Response) => void;
    getStatus.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveStatus = resolve; }));
    render(<OnboardingPage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    expect(getStatus).toHaveBeenCalledTimes(1);
    await act(async () => { resolveStatus(response({ has_data: false })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  it("turns a stalled request into a recoverable error after fifteen seconds", async () => {
    getStatus.mockImplementationOnce((options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new Error("request aborted")));
    }));
    render(<OnboardingPage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("could not check your usage");
    expect(getStatus.mock.calls[0][0].signal.aborted).toBe(true);
    expect(completeSetup).not.toHaveBeenCalled();
    getStatus.mockResolvedValueOnce(response(usage));
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await flush();
    expect(screen.getByText("Your first sync is complete")).toBeInTheDocument();
  });

  it("stops waiting after five minutes and can resume checks", async () => {
    render(<OnboardingPage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("No usage received yet");
    const previousChecks = getStatus.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(getStatus).toHaveBeenCalledTimes(previousChecks);
    getStatus.mockResolvedValueOnce(response(usage));
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await flush();
    expect(screen.getByText("Your first sync is complete")).toBeInTheDocument();
  });
});
