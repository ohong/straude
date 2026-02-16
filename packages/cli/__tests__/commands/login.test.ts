import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/api.js", () => ({
  apiRequestNoAuth: vi.fn(),
}));

vi.mock("../../src/lib/auth.js", () => ({
  saveConfig: vi.fn(),
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
  exec: vi.fn(),
}));

import { loginCommand } from "../../src/commands/login.js";
import { apiRequestNoAuth } from "../../src/lib/api.js";
import { saveConfig } from "../../src/lib/auth.js";

const mockApiRequestNoAuth = vi.mocked(apiRequestNoAuth);
const mockSaveConfig = vi.mocked(saveConfig);

class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code as number);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loginCommand", () => {
  it("opens browser and prints verify URL", async () => {
    mockApiRequestNoAuth
      .mockResolvedValueOnce({
        code: "ABCD-EFGH",
        verify_url: "https://straude.com/cli/verify?code=ABCD-EFGH",
      })
      .mockResolvedValueOnce({ status: "completed", token: "tok-123", username: "alice" });

    await loginCommand("https://straude.com");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("https://straude.com/cli/verify?code=ABCD-EFGH"),
    );
    expect(mockSaveConfig).toHaveBeenCalledWith({
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
      })
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "pending" })
      .mockResolvedValueOnce({ status: "completed", token: "tok-456", username: "bob" });

    await loginCommand("https://straude.com");

    expect(mockSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ token: "tok-456", username: "bob" }),
    );
  });

  it("handles expired code", async () => {
    mockApiRequestNoAuth
      .mockResolvedValueOnce({
        code: "ABCD-EFGH",
        verify_url: "https://straude.com/cli/verify?code=ABCD-EFGH",
      })
      .mockResolvedValueOnce({ status: "expired" });

    await expect(loginCommand("https://straude.com")).rejects.toThrow(ExitError);

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(mockSaveConfig).not.toHaveBeenCalled();
  });

  it("handles init failure", async () => {
    mockApiRequestNoAuth.mockRejectedValueOnce(new Error("Network error"));

    await expect(loginCommand("https://straude.com")).rejects.toThrow(ExitError);

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
