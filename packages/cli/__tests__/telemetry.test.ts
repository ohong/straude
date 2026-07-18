import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/lib/posthog.js", () => ({
  posthog: {
    capture: vi.fn(),
    captureException: vi.fn(),
    _shutdown: vi.fn(() => Promise.resolve()),
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
        error: "submit failed",
        error_name: "Error",
        command: "push",
        stage: "submit",
      },
    });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("keeps non-push command crashes in PostHog exceptions", () => {
    const error = new Error("login broke");
    reportCliException(
      { token: "tok", username: "alice", api_url: "https://straude.com" },
      error,
      { command: "login" },
    );

    expect(mockCaptureException).toHaveBeenCalledWith(
      error,
      "alice",
      { command: "login" },
    );
  });

  it("swallows the posthog shutdown-timeout rejection instead of propagating it", async () => {
    // @posthog/core rejects _shutdown with this string when flush exceeds the
    // timeout. If it propagates, it becomes an unhandled rejection that
    // exception autocapture re-reports and that skips the final process.exit.
    vi.mocked(posthog._shutdown).mockRejectedValueOnce(
      "Timeout while shutting down PostHog. Some events may not have been sent.",
    );

    await expect(shutdownTelemetryWithTimeout(10)).resolves.toBeTypeOf("number");
  });
});
