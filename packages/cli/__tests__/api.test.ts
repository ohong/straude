import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiRequest, apiRequestNoAuth } from "../src/lib/api.js";
import type { StraudeConfig } from "../src/lib/auth.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
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
      "Unauthorized",
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
