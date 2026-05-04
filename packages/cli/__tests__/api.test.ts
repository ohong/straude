import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import {
  apiRequest,
  apiRequestNoAuth,
  setAuthRefreshStrategy,
  REFRESHED_TOKEN_HEADER,
} from "../src/lib/api.js";
import type { StraudeConfig } from "../src/lib/auth.js";

/**
 * Integration tests against a real local http.Server. The previous version of
 * this file stubbed `globalThis.fetch` with a vi.fn() — that meant every test
 * passed through a fake that didn't actually serialize headers, parse the
 * response body, or honor `res.headers.get`. With a real server, every byte
 * the production code writes and reads is exercised.
 *
 * We mock at one boundary: `auth.saveConfig`, because the real implementation
 * writes to `~/.straude/config.json` and we don't want test runs touching the
 * user's actual config. That mock is captured-and-asserted, not faked-and-
 * forgotten.
 */

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
const mockSaveConfig = vi.mocked(saveConfig);
const mockIsInteractive = vi.mocked(isInteractive);

interface RequestRecord {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

interface PlannedResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

let server: Server;
let baseUrl: string;
let recorded: RequestRecord[];
let plan: PlannedResponse[];

beforeAll(async () => {
  recorded = [];
  plan = [];
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      recorded.push({
        method: req.method ?? "",
        path: req.url ?? "",
        headers: req.headers,
        body,
      });
      const next = plan.shift();
      if (!next) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "no planned response" }));
        return;
      }
      res.statusCode = next.status;
      res.setHeader("content-type", "application/json");
      for (const [k, v] of Object.entries(next.headers ?? {})) {
        res.setHeader(k, v);
      }
      res.end(JSON.stringify(next.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (typeof addr !== "object" || addr === null) throw new Error("server listen failed");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  recorded = [];
  plan = [];
  mockSaveConfig.mockReset();
  mockIsInteractive.mockReset();
  mockIsInteractive.mockReturnValue(false);
  setAuthRefreshStrategy(null);
});

afterEach(() => {
  // Make sure no test accidentally left a planned response unconsumed —
  // a leak there would silently affect the next test.
  expect(plan).toHaveLength(0);
});

function configFor(): StraudeConfig {
  return { token: "tok-abc", username: "alice", api_url: baseUrl };
}

describe("apiRequest — wire format", () => {
  it("hits the configured api_url + path", async () => {
    plan.push({ status: 200, body: { ok: true } });
    await apiRequest(configFor(), "/api/usage");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.path).toBe("/api/usage");
  });

  it("sends a real Bearer token in the Authorization header", async () => {
    plan.push({ status: 200, body: {} });
    await apiRequest(configFor(), "/api/test");
    expect(recorded[0]!.headers.authorization).toBe("Bearer tok-abc");
  });

  it("sends Content-Type: application/json", async () => {
    plan.push({ status: 200, body: {} });
    await apiRequest(configFor(), "/api/test");
    expect(recorded[0]!.headers["content-type"]).toBe("application/json");
  });

  it("forwards method + body verbatim", async () => {
    plan.push({ status: 200, body: { ok: true } });
    await apiRequest(configFor(), "/api/test", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
    });
    expect(recorded[0]!.method).toBe("POST");
    expect(recorded[0]!.body).toBe('{"a":1}');
  });

  it("parses the response JSON body", async () => {
    plan.push({ status: 200, body: { foo: "bar" } });
    const result = await apiRequest<{ foo: string }>(configFor(), "/api/test");
    expect(result.foo).toBe("bar");
  });
});

describe("apiRequest — error handling", () => {
  it("throws the session-expired message on real 401", async () => {
    plan.push({ status: 401, body: { error: "Unauthorized" } });
    await expect(apiRequest(configFor(), "/api/test")).rejects.toThrow(
      /Session expired or invalid/,
    );
  });

  it("includes the path in 404 errors and points at upgrade", async () => {
    plan.push({ status: 404, body: { error: "Not found" } });
    await expect(apiRequest(configFor(), "/api/test")).rejects.toThrow(
      /Endpoint not found.*\/api\/test/,
    );
  });

  it("surfaces the body's error string on other non-2xx", async () => {
    plan.push({ status: 500, body: { error: "boom" } });
    await expect(apiRequest(configFor(), "/api/test")).rejects.toThrow("boom");
  });

  it("falls back to HTTP <status> when the body has no error key", async () => {
    plan.push({ status: 503, body: { unrelated: "field" } });
    await expect(apiRequest(configFor(), "/api/test")).rejects.toThrow("HTTP 503");
  });
});

describe("apiRequest — sliding token refresh", () => {
  it("persists a refreshed token returned via X-Straude-Refreshed-Token", async () => {
    plan.push({
      status: 200,
      body: {},
      headers: { [REFRESHED_TOKEN_HEADER]: "new-token-xyz" },
    });
    const cfg = configFor();
    await apiRequest(cfg, "/api/test");
    expect(cfg.token).toBe("new-token-xyz");
    expect(mockSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ token: "new-token-xyz" }),
    );
  });

  it("does not save when the refresh header is absent", async () => {
    plan.push({ status: 200, body: {} });
    await apiRequest(configFor(), "/api/test");
    expect(mockSaveConfig).not.toHaveBeenCalled();
  });

  it("uses the refreshed token on the very next request", async () => {
    const cfg = configFor();
    plan.push({
      status: 200,
      body: {},
      headers: { [REFRESHED_TOKEN_HEADER]: "rotated-1" },
    });
    plan.push({ status: 200, body: {} });
    await apiRequest(cfg, "/api/first");
    await apiRequest(cfg, "/api/second");
    expect(recorded[0]!.headers.authorization).toBe("Bearer tok-abc");
    expect(recorded[1]!.headers.authorization).toBe("Bearer rotated-1");
  });

  it("still resolves the request when saveConfig fails (read-only home)", async () => {
    mockSaveConfig.mockImplementation(() => {
      throw new Error("EACCES");
    });
    plan.push({
      status: 200,
      body: { ok: true },
      headers: { [REFRESHED_TOKEN_HEADER]: "new-token" },
    });
    await expect(apiRequest(configFor(), "/api/test")).resolves.toEqual({ ok: true });
  });
});

describe("apiRequest — silent re-auth on 401", () => {
  it("retries once after the refresh strategy resolves a fresh config", async () => {
    mockIsInteractive.mockReturnValue(true);
    const refreshStrategy = vi.fn(async () => ({
      token: "fresh-token",
      username: "alice",
      api_url: baseUrl,
    }));
    setAuthRefreshStrategy(refreshStrategy);

    plan.push({ status: 401, body: { error: "Unauthorized" } });
    plan.push({ status: 200, body: { data: "ok" } });

    const cfg = configFor();
    const result = await apiRequest<{ data: string }>(cfg, "/api/test");
    expect(result.data).toBe("ok");
    expect(refreshStrategy).toHaveBeenCalledTimes(1);
    expect(recorded[1]!.headers.authorization).toBe("Bearer fresh-token");
    expect(cfg.token).toBe("fresh-token");
  });

  it("throws the original error when the strategy resolves null", async () => {
    mockIsInteractive.mockReturnValue(true);
    setAuthRefreshStrategy(async () => null);
    plan.push({ status: 401, body: { error: "Unauthorized" } });
    await expect(apiRequest(configFor(), "/api/test")).rejects.toThrow(
      /Session expired or invalid/,
    );
    expect(recorded).toHaveLength(1);
  });

  it("does not retry in non-interactive contexts (auto-push)", async () => {
    mockIsInteractive.mockReturnValue(false);
    const refreshStrategy = vi.fn();
    setAuthRefreshStrategy(refreshStrategy);
    plan.push({ status: 401, body: { error: "Unauthorized" } });
    await expect(apiRequest(configFor(), "/api/test")).rejects.toThrow(
      /Session expired or invalid/,
    );
    expect(refreshStrategy).not.toHaveBeenCalled();
  });

  it("does not retry when no strategy is registered", async () => {
    mockIsInteractive.mockReturnValue(true);
    setAuthRefreshStrategy(null);
    plan.push({ status: 401, body: { error: "Unauthorized" } });
    await expect(apiRequest(configFor(), "/api/test")).rejects.toThrow(
      /Session expired or invalid/,
    );
  });

  it("propagates a second 401 if the retried request also fails auth", async () => {
    mockIsInteractive.mockReturnValue(true);
    setAuthRefreshStrategy(async () => ({
      token: "still-bad",
      username: "alice",
      api_url: baseUrl,
    }));
    plan.push({ status: 401, body: { error: "Unauthorized" } });
    plan.push({ status: 401, body: { error: "Unauthorized" } });
    await expect(apiRequest(configFor(), "/api/test")).rejects.toThrow(
      /Session expired or invalid/,
    );
    expect(recorded).toHaveLength(2);
  });
});

describe("apiRequestNoAuth", () => {
  it("does not include an Authorization header", async () => {
    plan.push({ status: 200, body: {} });
    await apiRequestNoAuth(baseUrl, "/api/public");
    expect(recorded[0]!.headers.authorization).toBeUndefined();
  });

  it("hits the supplied url + path", async () => {
    plan.push({ status: 200, body: {} });
    await apiRequestNoAuth(baseUrl, "/health");
    expect(recorded[0]!.path).toBe("/health");
  });
});
