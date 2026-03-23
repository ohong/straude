import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let fileStore: Record<string, string> = {};
let fileSizes: Record<string, number> = {};

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => path in fileStore),
  readFileSync: vi.fn((path: string) => fileStore[path] ?? ""),
  writeFileSync: vi.fn((path: string, data: string) => {
    fileStore[path] = data;
  }),
  statSync: vi.fn((path: string) => ({
    size: fileSizes[path] ?? Buffer.byteLength(fileStore[path] ?? "", "utf-8"),
  })),
  mkdirSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { readLog, rotateLog } from "../src/lib/auto-push-logger.js";
import { AUTO_PUSH_LOG_FILE, AUTO_PUSH_LOG_MAX_BYTES } from "../src/config.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  fileStore = {};
  fileSizes = {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("readLog", () => {
  it("returns empty array when log file does not exist", () => {
    expect(readLog()).toEqual([]);
  });

  it("returns all lines when fewer than requested", () => {
    fileStore[AUTO_PUSH_LOG_FILE] = "line1\nline2\nline3\n";
    expect(readLog(50)).toEqual(["line1", "line2", "line3"]);
  });

  it("returns last N lines when more exist", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`);
    fileStore[AUTO_PUSH_LOG_FILE] = lines.join("\n") + "\n";
    const result = readLog(5);
    expect(result).toEqual(["line96", "line97", "line98", "line99", "line100"]);
  });

  it("uses default of 50 lines", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`);
    fileStore[AUTO_PUSH_LOG_FILE] = lines.join("\n") + "\n";
    const result = readLog();
    expect(result).toHaveLength(50);
    expect(result[0]).toBe("line51");
  });

  it("filters out empty lines", () => {
    fileStore[AUTO_PUSH_LOG_FILE] = "line1\n\nline2\n\n";
    expect(readLog()).toEqual(["line1", "line2"]);
  });
});

describe("rotateLog", () => {
  it("is a no-op when log file does not exist", () => {
    rotateLog(); // Should not throw
  });

  it("is a no-op when file is under size threshold", () => {
    fileStore[AUTO_PUSH_LOG_FILE] = "small content";
    fileSizes[AUTO_PUSH_LOG_FILE] = 100;
    rotateLog();
    expect(fileStore[AUTO_PUSH_LOG_FILE]).toBe("small content");
  });

  it("truncates to last 500 lines when over size threshold", () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `[2026-03-22] line${i + 1}`);
    fileStore[AUTO_PUSH_LOG_FILE] = lines.join("\n");
    fileSizes[AUTO_PUSH_LOG_FILE] = AUTO_PUSH_LOG_MAX_BYTES + 1;

    rotateLog();

    const rotated = fileStore[AUTO_PUSH_LOG_FILE]!;
    const rotatedLines = rotated.split("\n");
    expect(rotatedLines).toHaveLength(500);
    expect(rotatedLines[0]).toBe("[2026-03-22] line501");
    expect(rotatedLines[499]).toBe("[2026-03-22] line1000");
  });
});
