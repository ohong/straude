import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig, saveConfig, requireAuth } from "../src/lib/auth.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);

beforeEach(() => {
  vi.clearAllMocks();
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

  it("returns null when token is missing from config", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ username: "alice" }));
    expect(loadConfig()).toBeNull();
  });

  it("returns null on invalid JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("not json");
    expect(loadConfig()).toBeNull();
  });
});

describe("saveConfig", () => {
  it("creates config directory if it does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    saveConfig({ token: "tok-abc", username: "alice", api_url: "https://straude.com" });
    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining(".straude"), {
      recursive: true,
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
      expect.stringContaining("config.json"),
      JSON.stringify(config, null, 2) + "\n",
      "utf-8",
    );
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
