import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/api.js", () => ({
  apiRequestNoAuth: vi.fn(),
  ApiHttpError: class ApiHttpError extends Error {
    status: number;
    retryAfterMs: number | null;
    retryable: boolean;
    constructor(message: string, status: number, retryAfterMs: number | null = null) {
      super(message);
      this.status = status;
      this.retryAfterMs = retryAfterMs;
      this.retryable = [408, 425, 429, 500, 502, 503, 504].includes(status);
    }
  },
}));

vi.mock("../../src/lib/auth.js", () => ({
  loadConfig: vi.fn(() => null),
  saveConfig: vi.fn(),
  updateConfig: vi.fn(),
}));

vi.mock("../../src/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/config.js")>();
  return {
    ...actual,
    POLL_INTERVAL_MS: 1,
    POLL_TIMEOUT_MS: 10_000,
  };
});

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
    on: vi.fn(),
  })),
}));

vi.mock("../../src/lib/prompt.js", () => ({
  isInteractive: vi.fn(() => false),
}));

import { LoginCommandError, loginCommand } from "../../src/commands/login.js";
import { ApiHttpError, apiRequestNoAuth } from "../../src/lib/api.js";
import { loadConfig, updateConfig } from "../../src/lib/auth.js";

const mockApiRequestNoAuth = vi.mocked(apiRequestNoAuth);
const mockLoadConfig = vi.mocked(loadConfig);
const mockUpdateConfig = vi.mocked(updateConfig);

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateConfig.mockImplementation((updater) => updater(mockLoadConfig()));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loginCommand", () => {
  it("fails fast when a background caller requires interactive auth", async () => {
    await expect(
      loginCommand("https://straude.com", { requireInteractive: true }),
    ).rejects.toThrow(/interactive terminal/);
    expect(mockApiRequestNoAuth).not.toHaveBeenCalled();
  });

  it("opens browser and prints verify URL", async () => {
    mockApiRequestNoAuth
      .mockResolvedValueOnce({
        code: "ABCD-EFGH",
        verify_url: "https://straude.com/cli/verify?code=ABCD-EFGH",
        poll_secret: "poll-secret-123",
      })
      .mockResolvedValueOnce({ status: "completed", token: "tok-123", username: "alice" });

    await loginCommand("https://straude.com");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("https://straude.com/cli/verify?code=ABCD-EFGH"),
    );
    expect(mockApiRequestNoAuth).toHaveBeenNthCalledWith(
      1,
      "https://straude.com",
      "/api/auth/cli/init",
      expect.objectContaining({ timeoutMs: 10_000 }),
    );
    expect(mockUpdateConfig.mock.results[0]!.value).toEqual({
      token: "tok-123",
      username: "alice",
      api_url: "https://straude.com",
    });
  });

  it("polls until completed, saves config", async () => {
    mockApiRequestNoAuth
      .mockResolvedValueOnce({
        code: "ABCD-EFGH",
        verify_url: "https://straude.com/cli/verify?code=ABCD-EFGH",
        poll_secret: "poll-secret-123",
      })
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "completed", token: "tok-456", username: "bob" });

    await loginCommand("https://straude.com");

    expect(mockUpdateConfig.mock.results[0]!.value).toEqual(
      expect.objectContaining({ token: "tok-456", username: "bob" }),
    );
    expect(mockApiRequestNoAuth).toHaveBeenCalledWith(
      "https://straude.com",
      "/api/auth/cli/poll",
      expect.objectContaining({
        body: JSON.stringify({ code: "ABCD-EFGH", poll_secret: "poll-secret-123" }),
      }),
    );
  });

  it("handles expired code", async () => {
    mockApiRequestNoAuth
      .mockResolvedValueOnce({
        code: "ABCD-EFGH",
        verify_url: "https://straude.com/cli/verify?code=ABCD-EFGH",
        poll_secret: "poll-secret-123",
      })
      .mockResolvedValueOnce({ status: "expired" });

    await expect(loginCommand("https://straude.com")).rejects.toThrow(
      new LoginCommandError("Login code expired. Please try again."),
    );
    expect(mockUpdateConfig).not.toHaveBeenCalled();
  });

  it("stops polling on a permanent HTTP error", async () => {
    mockApiRequestNoAuth
      .mockResolvedValueOnce({
        code: "ABCD-EFGH",
        verify_url: "https://straude.com/cli/verify?code=ABCD-EFGH",
        poll_secret: "poll-secret-123",
      })
      .mockRejectedValueOnce(new ApiHttpError("invalid poll secret", 400));

    await expect(loginCommand("https://straude.com")).rejects.toThrow(
      /invalid poll secret/,
    );
    expect(mockApiRequestNoAuth).toHaveBeenCalledTimes(2);
  });

  it("handles init failure", async () => {
    mockApiRequestNoAuth.mockRejectedValueOnce(new Error("Network error"));

    await expect(loginCommand("https://straude.com")).rejects.toThrow(
      /Failed to start login: Network error/,
    );
  });

  it("rejects init responses without poll_secret", async () => {
    mockApiRequestNoAuth.mockResolvedValueOnce({
      code: "ABCD-EFGH",
      verify_url: "https://straude.com/cli/verify?code=ABCD-EFGH",
    });

    await expect(loginCommand("https://straude.com")).rejects.toThrow(
      /server did not return a poll secret/,
    );
    expect(mockUpdateConfig).not.toHaveBeenCalled();
  });

  it("preserves config fields when re-logging into the same account", async () => {
    mockLoadConfig.mockReturnValueOnce({
      token: "old-tok",
      username: "alice",
      api_url: "https://straude.com",
      last_push_date: "2026-03-20",
      device_id: "dev-123",
      device_name: "my-laptop",
      ccusage_v20_migration_completed_at: "2026-03-21T00:00:00.000Z",
      auto_push: {
        enabled: true,
        time: "21:00",
        scheduler: "launchd",
        mechanism: "scheduler",
      },
    });
    mockApiRequestNoAuth
      .mockResolvedValueOnce({
        code: "ABCD-EFGH",
        verify_url: "https://straude.com/cli/verify?code=ABCD-EFGH",
        poll_secret: "poll-secret-123",
      })
      .mockResolvedValueOnce({ status: "completed", token: "new-tok", username: "alice" });

    await loginCommand("https://straude.com");

    expect(mockUpdateConfig).toHaveBeenCalled();
    const saved = mockUpdateConfig.mock.results[0]!.value;
    expect(saved).toEqual({
      token: "new-tok",
      username: "alice",
      api_url: "https://straude.com",
      last_push_date: "2026-03-20",
      device_id: "dev-123",
      device_name: "my-laptop",
      ccusage_v20_migration_completed_at: "2026-03-21T00:00:00.000Z",
      auto_push: {
        enabled: true,
        time: "21:00",
        scheduler: "launchd",
        mechanism: "scheduler",
      },
    });
  });

  it("drops config fields when logging into a different account", async () => {
    mockLoadConfig.mockReturnValueOnce({
      token: "old-tok",
      username: "alice",
      api_url: "https://straude.com",
      last_push_date: "2026-03-20",
      device_id: "dev-123",
      device_name: "my-laptop",
    });
    mockApiRequestNoAuth
      .mockResolvedValueOnce({
        code: "ABCD-EFGH",
        verify_url: "https://straude.com/cli/verify?code=ABCD-EFGH",
        poll_secret: "poll-secret-123",
      })
      .mockResolvedValueOnce({ status: "completed", token: "new-tok", username: "bob" });

    await loginCommand("https://straude.com");

    expect(mockUpdateConfig.mock.results[0]!.value).toEqual({
      token: "new-tok",
      username: "bob",
      api_url: "https://straude.com",
    });
  });

  it("drops config fields when logging into a different server", async () => {
    mockLoadConfig.mockReturnValueOnce({
      token: "old-tok",
      username: "alice",
      api_url: "https://straude.com",
      last_push_date: "2026-03-20",
      device_id: "dev-123",
      device_name: "my-laptop",
    });
    mockApiRequestNoAuth
      .mockResolvedValueOnce({
        code: "ABCD-EFGH",
        verify_url: "https://other.com/cli/verify?code=ABCD-EFGH",
        poll_secret: "poll-secret-123",
      })
      .mockResolvedValueOnce({ status: "completed", token: "new-tok", username: "alice" });

    await loginCommand("https://other.com");

    expect(mockUpdateConfig.mock.results[0]!.value).toEqual({
      token: "new-tok",
      username: "alice",
      api_url: "https://other.com",
    });
  });
});
