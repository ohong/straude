import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/lib/posthog.js", () => ({
  posthog: {
    capture: vi.fn(),
    captureException: vi.fn(),
    _shutdown: vi.fn(),
  },
}));

vi.mock("../src/lib/machine-id.js", () => ({
  getDistinctId: vi.fn(() => "alice"),
}));

import { posthog } from "../src/lib/posthog.js";
import {
  errorMessage,
  isPushInvocation,
  reportCliException,
  reportUsagePushFailed,
  shutdownTelemetryWithTimeout,
} from "../src/lib/telemetry.js";

const mockCapture = vi.mocked(posthog.capture);
const mockCaptureException = vi.mocked(posthog.captureException);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("telemetry", () => {
  it("classifies default and explicit push invocations as usage pushes", () => {
    expect(isPushInvocation(null)).toBe(true);
    expect(isPushInvocation("push")).toBe(true);
    expect(isPushInvocation("login")).toBe(false);
  });

  it("formats unknown errors safely", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("plain failure")).toBe("plain failure");
    expect(errorMessage({ nope: true })).toBe("Unknown error");
  });

  it("reports push failures as usage_push_failed, not PostHog exceptions", () => {
    reportUsagePushFailed(
      { token: "tok", username: "alice", api_url: "https://straude.com" },
      new Error("submit failed"),
      { command: "push", stage: "submit" },
    );

    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: "alice",
      event: "usage_push_failed",
      properties: {
        error_name: "Error",
        error_fingerprint: expect.stringMatching(/^[a-f0-9]{24}$/),
        command: "push",
        stage: "submit",
      },
    });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("reports non-push crashes without sending raw exception content", () => {
    const error = new Error("login broke");
    reportCliException(
      { token: "tok", username: "alice", api_url: "https://straude.com" },
      error,
      { command: "login" },
    );

    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: "alice",
      event: "cli_exception",
      properties: {
        error_name: "Error",
        error_fingerprint: expect.stringMatching(/^[a-f0-9]{24}$/),
        command: "login",
      },
    });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("treats telemetry shutdown rejection as best-effort", async () => {
    vi.mocked(posthog._shutdown).mockRejectedValueOnce(new Error("transport failed"));
    await expect(shutdownTelemetryWithTimeout(10)).resolves.toBeGreaterThanOrEqual(0);
  });
});
