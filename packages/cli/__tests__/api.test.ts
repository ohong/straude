import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiRequest, apiRequestNoAuth, setAuthRefreshStrategy, REFRESHED_TOKEN_HEADER } from "../src/lib/api.js";
import type { StraudeConfig } from "../src/lib/auth.js";

vi.mock("../src/lib/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth.js")>();
  return { ...actual, saveConfig: vi.fn() };
});

vi.mock("../src/lib/prompt.js", () => ({
  isInteractive: vi.fn(() => false),
  promptYesNo: vi.fn(),
}));

import { saveConfig } from "../src/lib/auth.js";
import { isInteractive } from "../src/lib/prompt.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockSaveConfig = vi.mocked(saveConfig);
const mockIsInteractive = vi.mocked(isInteractive);

beforeEach(() => {
  mockFetch.mockReset();
  mockSaveConfig.mockReset();
  mockIsInteractive.mockReset();
  mockIsInteractive.mockReturnValue(false);
  setAuthRefreshStrategy(null);
});

const config: StraudeConfig = {
  token: "tok-abc",
  username: "alice",
  api_url: "https://straude.com",
};

describe("apiRequest", () => {
  it("constructs correct URL from config and path", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: "ok" }),
    });
    await apiRequest(config, "/api/usage");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://straude.com/api/usage",
      expect.anything(),
    );
  });

  it("includes Authorization header with token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await apiRequest(config, "/api/test");
    const callArgs = mockFetch.mock.calls[0]!;
    expect(callArgs[1].headers.Authorization).toBe("Bearer tok-abc");
  });

  it("includes Content-Type header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await apiRequest(config, "/api/test");
    const callArgs = mockFetch.mock.calls[0]!;
    expect(callArgs[1].headers["Content-Type"]).toBe("application/json");
  });

  it("parses JSON response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ foo: "bar" }),
    });
    const result = await apiRequest<{ foo: string }>(config, "/api/test");
    expect(result.foo).toBe("bar");
  });

  it("throws on HTTP error with error message from body", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });
    await expect(apiRequest(config, "/api/test")).rejects.toThrow(
      "Session expired or invalid",
    );
  });

  it("throws with HTTP status when body parse fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("parse error")),
    });
    await expect(apiRequest(config, "/api/test")).rejects.toThrow("HTTP 500");
  });

  it("forwards custom options", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await apiRequest(config, "/api/test", { method: "POST", body: '{"a":1}' });
    const callArgs = mockFetch.mock.calls[0]!;
    expect(callArgs[1].method).toBe("POST");
    expect(callArgs[1].body).toBe('{"a":1}');
  });
});

describe("apiRequest — sliding token refresh", () => {
  it("persists a refreshed token from response header", async () => {
    const mutableConfig: StraudeConfig = { ...config };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      headers: { get: (name: string) => name === REFRESHED_TOKEN_HEADER ? "new-token-xyz" : null },
    });
    await apiRequest(mutableConfig, "/api/test");
    expect(mutableConfig.token).toBe("new-token-xyz");
    expect(mockSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ token: "new-token-xyz" }),
    );
  });

  it("does not save when no refresh header is present", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      headers: { get: () => null },
    });
    await apiRequest(config, "/api/test");
    expect(mockSaveConfig).not.toHaveBeenCalled();
  });

  it("swallows read-only-fs saveConfig errors so the request still resolves", async () => {
    mockSaveConfig.mockImplementation(() => {
      const err = new Error("read-only filesystem") as NodeJS.ErrnoException;
      err.code = "EROFS";
      throw err;
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: { get: () => "new-token" },
    });
    await expect(apiRequest(config, "/api/test")).resolves.toEqual({ ok: true });
  });

  it("propagates unexpected saveConfig errors instead of swallowing them", async () => {
    mockSaveConfig.mockImplementation(() => {
      const err = new Error("disk full") as NodeJS.ErrnoException;
      err.code = "ENOSPC";
      throw err;
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
      headers: { get: () => "new-token" },
    });
    await expect(apiRequest(config, "/api/test")).rejects.toThrow(/disk full/);
  });
});

describe("apiRequest — silent re-auth on 401", () => {
  it("retries once after running the refresh strategy when interactive", async () => {
    mockIsInteractive.mockReturnValue(true);
    const refreshStrategy = vi.fn(async () => ({
      ...config,
      token: "fresh-token",
    }));
    setAuthRefreshStrategy(refreshStrategy);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: "ok" }),
      headers: { get: () => null },
    });

    const mutable: StraudeConfig = { ...config };
    const result = await apiRequest<{ data: string }>(mutable, "/api/test");
    expect(result.data).toBe("ok");
    expect(refreshStrategy).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mutable.token).toBe("fresh-token");
    // Second call uses the new token.
    const secondHeaders = (mockFetch.mock.calls[1]![1] as { headers: Record<string, string> }).headers;
    expect(secondHeaders.Authorization).toBe("Bearer fresh-token");
  });

  it("throws the original error when refresh strategy returns null", async () => {
    mockIsInteractive.mockReturnValue(true);
    setAuthRefreshStrategy(async () => null);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });
    await expect(apiRequest(config, "/api/test")).rejects.toThrow(
      "Session expired or invalid",
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry in non-interactive contexts (auto-push)", async () => {
    mockIsInteractive.mockReturnValue(false);
    const refreshStrategy = vi.fn();
    setAuthRefreshStrategy(refreshStrategy);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });
    await expect(apiRequest(config, "/api/test")).rejects.toThrow(
      "Session expired or invalid",
    );
    expect(refreshStrategy).not.toHaveBeenCalled();
  });

  it("does not retry when no strategy is registered", async () => {
    mockIsInteractive.mockReturnValue(true);
    setAuthRefreshStrategy(null);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });
    await expect(apiRequest(config, "/api/test")).rejects.toThrow(
      "Session expired or invalid",
    );
  });
});

describe("apiRequestNoAuth", () => {
  it("does not include Authorization header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await apiRequestNoAuth("https://straude.com", "/api/public");
    const callArgs = mockFetch.mock.calls[0]!;
    expect(callArgs[1].headers.Authorization).toBeUndefined();
  });

  it("constructs correct URL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await apiRequestNoAuth("https://custom.api", "/health");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://custom.api/health",
      expect.anything(),
    );
  });
});
