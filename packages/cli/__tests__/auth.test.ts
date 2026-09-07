import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConfigCorruptError,
  loadConfig,
  saveConfig,
  requireAuth,
  updateConfig,
} from "../src/lib/auth.js";

let nextFd = 10;
const fdPaths = new Map<number, string>();

vi.mock("node:fs", () => ({
  chmodSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  openSync: vi.fn((path: string) => {
    const fd = nextFd++;
    fdPaths.set(fd, path);
    return fd;
  }),
  closeSync: vi.fn(),
  fsyncSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
  statSync: vi.fn(() => ({ mtimeMs: Date.now() })),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockRenameSync = vi.mocked(renameSync);

beforeEach(() => {
  vi.clearAllMocks();
  nextFd = 10;
  fdPaths.clear();
});

describe("loadConfig", () => {
  it("returns null when config file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    expect(loadConfig()).toBeNull();
  });

  it("reads and parses config from file", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        token: "tok-abc",
        username: "alice",
        api_url: "https://custom.api",
      }),
    );
    const config = loadConfig();
    expect(config).toEqual({
      token: "tok-abc",
      username: "alice",
      api_url: "https://custom.api",
    });
  });

  it("defaults username to empty string if missing", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ token: "tok-abc" }));
    const config = loadConfig();
    expect(config!.username).toBe("");
  });

  it("defaults api_url to DEFAULT_API_URL if missing", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ token: "tok-abc" }));
    const config = loadConfig();
    expect(config!.api_url).toBe("https://straude.com");
  });

  it("loads the last-token-usage Codex repair marker", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        token: "tok-abc",
        codex_native_last_token_usage_repair_completed_at: "2026-05-07T00:00:00.000Z",
      }),
    );
    const config = loadConfig();
    expect(config!.codex_native_last_token_usage_repair_completed_at).toBe("2026-05-07T00:00:00.000Z");
  });

  it("loads the ccusage v20 migration marker", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        token: "tok-abc",
        ccusage_v20_migration_completed_at: "2026-06-02T00:00:00.000Z",
      }),
    );
    const config = loadConfig();
    expect(config!.ccusage_v20_migration_completed_at).toBe("2026-06-02T00:00:00.000Z");
  });

  it("throws a clear corruption error when token is missing", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ username: "alice" }));
    expect(() => loadConfig()).toThrow(ConfigCorruptError);
  });

  it("throws a clear corruption error on invalid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("not json");
    expect(() => loadConfig()).toThrow(ConfigCorruptError);
    expect(mockRenameSync).toHaveBeenCalledWith(
      expect.stringContaining("config.json"),
      expect.stringContaining("config.json.corrupt-"),
    );
  });
});

describe("saveConfig", () => {
  it("creates config directory if it does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    saveConfig({ token: "tok-abc", username: "alice", api_url: "https://straude.com" });
    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining(".straude"), {
      recursive: true,
      mode: 0o700,
    });
  });

  it("does not create directory if it exists", () => {
    mockExistsSync.mockReturnValue(true);
    saveConfig({ token: "tok-abc", username: "alice", api_url: "https://straude.com" });
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it("writes JSON config to file", () => {
    mockExistsSync.mockReturnValue(true);
    const config = { token: "tok-abc", username: "alice", api_url: "https://straude.com" };
    saveConfig(config);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.any(Number),
      JSON.stringify(config, null, 2) + "\n",
      "utf-8",
    );
    expect(mockRenameSync).toHaveBeenCalledWith(
      expect.stringContaining("config.json."),
      expect.stringContaining("config.json"),
    );
  });
});

describe("updateConfig", () => {
  it("merges a targeted update with the latest config under the lock", () => {
    mockExistsSync.mockImplementation((path) => String(path).endsWith("config.json"));
    mockReadFileSync.mockReturnValue(JSON.stringify({
      token: "fresh-token",
      username: "alice",
      api_url: "https://straude.com",
      auto_push: {
        enabled: true,
        time: "21:00",
        scheduler: "launchd",
      },
    }));

    const result = updateConfig((current) => ({
      ...current!,
      last_push_date: "2026-07-23",
    }));

    expect(result).toMatchObject({
      token: "fresh-token",
      last_push_date: "2026-07-23",
      auto_push: { enabled: true },
    });
    expect(mockRenameSync).toHaveBeenCalledTimes(1);
  });
});

describe("requireAuth", () => {
  it("returns config when logged in", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ token: "tok-abc", username: "alice" }),
    );
    const config = requireAuth();
    expect(config.token).toBe("tok-abc");
  });

  it("exits process when not logged in", () => {
    mockExistsSync.mockReturnValue(false);
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => requireAuth()).toThrow("process.exit");
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Not logged in"),
    );
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });
});
