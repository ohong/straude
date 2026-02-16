import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/auth.js", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("../../src/lib/api.js", () => ({
  apiRequest: vi.fn(),
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
  it("fetches and prints status", async () => {
    mockApiRequest.mockResolvedValue({
      username: "alice",
      streak: 5,
      week_cost: 12.5,
      week_tokens: 1_500_000,
      global_rank: 42,
      last_push_date: "2026-02-15",
    });

    await statusCommand();

    expect(mockApiRequest).toHaveBeenCalledWith(fakeConfig, "/api/users/me/status");
    expect(console.log).toHaveBeenCalledWith("@alice");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("5 days"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("$12.50"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("1.5M"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("#42"));
  });

  it("handles API failure", async () => {
    mockApiRequest.mockRejectedValue(new Error("Network error"));

    await expect(statusCommand()).rejects.toThrow(ExitError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("formats tokens and cost correctly", async () => {
    mockApiRequest.mockResolvedValue({
      username: "bob",
      streak: 1,
      week_cost: 0.5,
      week_tokens: 500,
      global_rank: null,
      last_push_date: null,
    });

    await statusCommand();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("1 day"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("$0.50"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("500 tokens"));
    // global_rank is null — should not print rank
    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const rankCalls = logCalls.filter(([msg]: [unknown]) =>
      typeof msg === "string" && msg.includes("rank"),
    );
    expect(rankCalls).toHaveLength(0);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("never"));
  });
});
