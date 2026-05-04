import { describe, it, expect, vi, beforeEach } from "vitest";
import { FIRST_RUN_MARKER, isFirstRun, markFirstRun } from "../src/lib/first-run.js";
import { CONFIG_DIR } from "../src/config.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { existsSync, writeFileSync, mkdirSync } from "node:fs";

const mockExistsSync = vi.mocked(existsSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isFirstRun", () => {
  it("returns true when marker file is missing", () => {
    mockExistsSync.mockReturnValue(false);
    expect(isFirstRun()).toBe(true);
    expect(mockExistsSync).toHaveBeenCalledWith(FIRST_RUN_MARKER);
  });

  it("returns false when marker file exists", () => {
    mockExistsSync.mockReturnValue(true);
    expect(isFirstRun()).toBe(false);
  });
});

describe("markFirstRun", () => {
  it("writes the marker and creates the config dir if missing", () => {
    mockExistsSync.mockReturnValue(false);
    markFirstRun();
    expect(mockMkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true, mode: 0o700 });
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    const [path, contents, opts] = mockWriteFileSync.mock.calls[0]!;
    expect(path).toBe(FIRST_RUN_MARKER);
    expect(typeof contents).toBe("string");
    expect(opts).toEqual({ encoding: "utf-8", mode: 0o600 });
  });

  it("skips mkdir when the config dir already exists", () => {
    mockExistsSync.mockReturnValue(true);
    markFirstRun();
    expect(mockMkdirSync).not.toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
  });

  it("swallows write errors silently (read-only home)", () => {
    mockExistsSync.mockReturnValue(true);
    mockWriteFileSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });
    expect(() => markFirstRun()).not.toThrow();
  });
});
