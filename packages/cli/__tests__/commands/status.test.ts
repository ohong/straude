import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/auth.js", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("../../src/lib/api.js", () => ({
  apiRequest: vi.fn(),
}));

// Mock Ink's render to capture what gets rendered without terminal output
vi.mock("ink", () => ({
  render: vi.fn(() => ({
    waitUntilExit: () => Promise.resolve(),
    unmount: vi.fn(),
  })),
}));

import { statusCommand } from "../../src/commands/status.js";
import { requireAuth } from "../../src/lib/auth.js";
import { apiRequest } from "../../src/lib/api.js";

const mockRequireAuth = vi.mocked(requireAuth);
const mockApiRequest = vi.mocked(apiRequest);

const fakeConfig = { token: "tok", username: "alice", api_url: "https://straude.com" };

class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockReturnValue(fakeConfig);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code as number);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("statusCommand", () => {
  it("fetches dashboard and renders", async () => {
    mockApiRequest.mockResolvedValue({
      username: "alice",
      level: 3,
      streak: 5,
      daily: [{ date: "2026-03-13", cost_usd: 12.5 }],
      week_cost: 12.5,
      prev_week_cost: 8.0,
      leaderboard: { rank: 42, above: [], below: [] },
    });

    await statusCommand();

    expect(mockApiRequest).toHaveBeenCalledWith(fakeConfig, "/api/cli/dashboard");
  });

  it("handles API failure", async () => {
    mockApiRequest.mockRejectedValue(new Error("Network error"));

    await expect(statusCommand()).rejects.toThrow(ExitError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("falls back to plain text when Ink render fails", async () => {
    mockApiRequest.mockResolvedValue({
      username: "bob",
      level: null,
      streak: 1,
      daily: [],
      week_cost: 0.5,
      prev_week_cost: 0,
      leaderboard: null,
    });

    // Make Ink render throw
    const { render } = await import("ink");
    vi.mocked(render).mockImplementationOnce(() => {
      throw new Error("Ink render failed");
    });

    await statusCommand();

    // Falls back to console.log
    expect(console.log).toHaveBeenCalledWith("@bob");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("1 day"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("$0.50"));
  });
});
