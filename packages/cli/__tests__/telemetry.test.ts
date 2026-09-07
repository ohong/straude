import { describe, expect, it, vi, beforeEach } from "vitest";
import { PostHog } from "posthog-node";

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
        error_name: "Error",
        error_category: "unexpected_error",
        error_fingerprint: expect.stringMatching(/^[a-f0-9]{24}$/),
        command: "push",
        stage: "submit",
      },
    });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("reports non-push crashes through sanitized PostHog Error Tracking", () => {
    const error = new Error("login broke");
    reportCliException(
      { token: "tok", username: "alice", api_url: "https://straude.com" },
      error,
      { command: "login" },
    );

    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      "alice",
      {
        error_name: "Error",
        error_category: "unexpected_error",
        error_fingerprint: expect.stringMatching(/^[a-f0-9]{24}$/),
        $exception_fingerprint: expect.stringMatching(/^straude:[a-f0-9]{24}$/),
        command: "login",
        stage: "command",
      },
    );
    const captured = mockCaptureException.mock.calls[0]![0] as Error;
    expect(captured).not.toBe(error);
    expect(captured.message).toBe("unexpected_error");
    expect(captured.stack).toBe("Error: unexpected_error");
    expect(captured.cause).toBeUndefined();
  });

  it.each([
    ["ApiTimeoutError", "Request timed out after 15000ms.", "api_timeout"],
    ["PricingUnavailableError", "ccusage stderr with sensitive output", "pricing_unavailable"],
    ["ConfigCorruptError", "invalid config at /Users/private/.straude/config.json", "config_corrupt"],
    ["SyncStateCorruptError", "private outbox path", "sync_state_corrupt"],
    ["InstallationIdentityError", "private machine ID path", "installation_identity"],
    ["CliArgumentError", "Unknown option: secret", "invalid_arguments"],
    ["LoginCommandError", "Failed to start login: private URL", "login_failed"],
    ["Error", "ccusage failed: secret stderr", "collector_execution"],
    ["Error", "ccusage timed out. Try running /private/ccusage", "collector_timeout"],
    ["Error", "ccusage exceeded the configured local scan deadline.", "collector_timeout"],
    ["Error", "Failed to parse ccusage output as JSON: secret JSON", "collector_json"],
    ["Error", "Invalid ccusage row for private date: secret model", "collector_schema"],
    ["Error", "Installed ccusage native binary is missing for private machine", "collector_installation"],
  ])("classifies %s / %s without copying diagnostic text", (name, message, category) => {
    const error = new Error(message);
    error.name = name;
    reportUsagePushFailed(null, error, { stage: "scan" });
    expect(mockCapture.mock.calls[0]![0].properties).toMatchObject({
      stage: "scan",
      error_category: category,
    });
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain(message);
  });

  it("distinguishes HTTP failures with the same stack without copying response bodies", () => {
    for (const status of [401, 429, 503]) {
      const error = Object.assign(new Error("secret response body"), { name: "ApiHttpError", status });
      error.stack = "ApiHttpError: secret response body\n    at request (/private/api.ts:10:2)";
      reportUsagePushFailed(null, error, { stage: "submit" });
    }
    const properties = mockCapture.mock.calls.map(([event]) => event.properties!);
    expect(properties.map((event) => event.http_status)).toEqual([401, 429, 503]);
    expect(new Set(properties.map((event) => event.error_fingerprint)).size).toBe(3);
    expect(JSON.stringify(properties)).not.toContain("secret response body");
  });

  it.each(["https://private/?token=secret", 999, NaN])("omits invalid HTTP status %s", (status) => {
    const error = Object.assign(new Error("secret"), { name: "ApiHttpError", status });
    reportUsagePushFailed(null, error);
    expect(mockCapture.mock.calls[0]![0].properties).not.toHaveProperty("http_status");
  });

  it.each(["ECONNREFUSED", "ENOTFOUND", "EACCES"])("retains allowlisted system cause %s", (code) => {
    const cause = Object.assign(new Error("private hostname or file path"), { code });
    reportCliException(null, new TypeError("fetch failed: private URL", { cause }));
    expect(mockCaptureException.mock.calls[0]![2]).toMatchObject({ system_error_code: code });
    expect(JSON.stringify(mockCaptureException.mock.calls)).not.toContain("private");
  });

  it("drops arbitrary system codes", () => {
    reportCliException(null, Object.assign(new Error("private"), { code: "secret-file-path" }));
    expect(mockCaptureException.mock.calls[0]![2]).not.toHaveProperty("system_error_code");
  });

  it.each(["secret thrown string", { message: "secret thrown object" }, null])(
    "handles non-Error throws without copying their contents: %s",
    (error) => {
      reportCliException(null, error);
      const captured = mockCaptureException.mock.calls[0]![0] as Error;
      expect(captured.message).toBe("unexpected_error");
      expect(JSON.stringify(mockCaptureException.mock.calls)).not.toContain("secret");
    },
  );

  it("never sends custom names, messages, stderr, causes, URLs, or local paths", () => {
    const secret = "sensitive-value";
    const error = Object.assign(new Error(`https://private.test/?token=${secret}`, {
      cause: new Error(`cause ${secret}`),
    }), {
      name: `Custom${secret}`,
      stderr: `raw collector stderr ${secret}`,
      stack: `Error: ${secret}\n    at run (/Volumes/private/${secret}/run.ts:8:4)`,
    });
    reportUsagePushFailed(null, error);
    reportCliException(null, error);
    const captured = mockCaptureException.mock.calls[0]![0] as Error;
    const payload = JSON.stringify({
      events: mockCapture.mock.calls,
      exceptions: mockCaptureException.mock.calls,
      exceptionFields: Object.getOwnPropertyNames(captured).map((key) => Reflect.get(captured, key)),
    });
    expect(payload).not.toContain(secret);
    expect(payload).not.toContain("/Volumes/");
    expect(payload).not.toContain("private.test");
    expect(captured.name).toBe("Error");
    expect(captured.cause).toBeUndefined();
  });

  it("builds real Error Tracking metadata without SDK source-context leakage", async () => {
    const error = new Error("ccusage failed: private stderr", { cause: new Error("private cause") });
    error.stack = "Error: private stderr\n    at run (/private/project/collector.ts:1:1)";
    reportCliException(null, error, { command: "login" });
    const [sanitized, distinctId, properties] = mockCaptureException.mock.calls[0]!;
    const client = new PostHog("test-key", {
      flushInterval: 0,
      enableExceptionAutocapture: false,
    });
    const capture = vi.spyOn(client, "capture").mockImplementation(() => {});
    try {
      client.captureException(sanitized, distinctId, properties);
      await vi.waitFor(() => expect(capture).toHaveBeenCalledOnce());
      const event = capture.mock.calls[0]![0];
      expect(event.event).toBe("$exception");
      expect(event.properties?.$exception_list).toEqual([
        expect.objectContaining({ type: "Error", value: "collector_execution" }),
      ]);
      const payload = JSON.stringify(event);
      expect(payload).not.toContain("private");
      expect(payload).not.toContain("telemetry.ts");
      expect(payload).not.toContain("telemetry.test.ts");
      expect(event.properties?.$exception_fingerprint).toBe(properties?.$exception_fingerprint);
    } finally {
      await client._shutdown(100);
    }
  });

  it("treats telemetry shutdown rejection as best-effort", async () => {
    vi.mocked(posthog._shutdown).mockRejectedValueOnce(new Error("transport failed"));
    await expect(shutdownTelemetryWithTimeout(10)).resolves.toBeGreaterThanOrEqual(0);
  });

  it("treats synchronous telemetry shutdown errors as best-effort", async () => {
    vi.mocked(posthog._shutdown).mockImplementationOnce(() => { throw new Error("transport failed"); });
    await expect(shutdownTelemetryWithTimeout(10)).resolves.toBeGreaterThanOrEqual(0);
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

  it("stays quiet when the local timer wins and the rejection lands later", async () => {
    // posthog's own timeout and ours are both 150 ms, so the rejection can land
    // after the local timer already resolved. Promise.race subscribes to both
    // inputs, so that late rejection is already handled — this pins that down
    // so a refactor away from Promise.race can't silently reintroduce a
    // late unhandled rejection.
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      vi.mocked(posthog._shutdown).mockReturnValueOnce(
        new Promise((_resolve, reject) =>
          setTimeout(
            () =>
              reject(
                "Timeout while shutting down PostHog. Some events may not have been sent.",
              ),
            20,
          ),
        ),
      );

      await expect(shutdownTelemetryWithTimeout(1)).resolves.toBeTypeOf("number");
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});
