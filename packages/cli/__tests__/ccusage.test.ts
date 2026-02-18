import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseCcusageOutput,
  runCcusage,
  runCcusageRaw,
  _resetCcusageBinCache,
} from "../src/lib/ccusage.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readdirSync: vi.fn(() => []),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

import { execFileSync } from "node:child_process";
const mockExecFileSync = vi.mocked(execFileSync);

/** Build a valid ccusage v18 JSON string. */
function validOutput() {
  return JSON.stringify({
    daily: [
      {
        date: "2025-06-01",
        modelsUsed: ["claude-sonnet-4-5-20250514"],
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationTokens: 200,
        cacheReadTokens: 100,
        totalTokens: 1800,
        totalCost: 0.05,
      },
    ],
    totals: {
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 200,
      cacheReadTokens: 100,
      totalTokens: 1800,
      totalCost: 0.05,
    },
  });
}

/** Simulate `which ccusage` finding the binary on PATH. */
function mockWhichFound(path = "/usr/local/bin/ccusage") {
  return (cmd: string, args?: readonly string[], _opts?: unknown) => {
    if (cmd === "which" && args?.[0] === "ccusage") {
      return path as never;
    }
    return validOutput() as never;
  };
}

/** Simulate `which ccusage` failing (not on PATH), no fallback candidates. */
function mockWhichNotFound() {
  return (cmd: string) => {
    if (cmd === "which") throw new Error("not found");
    // fall through to the actual ccusage call — callers override this
    return validOutput() as never;
  };
}

// ---------------------------------------------------------------------------
// parseCcusageOutput
// ---------------------------------------------------------------------------

describe("parseCcusageOutput", () => {
  it("parses valid ccusage v18 JSON and normalizes fields", () => {
    const result = parseCcusageOutput(validOutput());
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.date).toBe("2025-06-01");
    expect(result.data[0]!.costUSD).toBe(0.05);
    expect(result.data[0]!.models).toEqual(["claude-sonnet-4-5-20250514"]);
  });

  it("rejects non-JSON input", () => {
    expect(() => parseCcusageOutput("not json")).toThrow(
      "Failed to parse ccusage output as JSON",
    );
  });

  it("rejects output without daily array", () => {
    const bad = JSON.stringify({ something: "else" });
    expect(() => parseCcusageOutput(bad)).toThrow(
      "Unexpected ccusage output format",
    );
  });

  it("rejects output where daily is not an array", () => {
    const bad = JSON.stringify({ daily: "not an array", totals: {} });
    expect(() => parseCcusageOutput(bad)).toThrow(
      "Unexpected ccusage output format",
    );
  });

  it("returns empty data for empty array", () => {
    const result = parseCcusageOutput("[]");
    expect(result.data).toEqual([]);
  });

  it("rejects entry with missing date", () => {
    const bad = JSON.stringify({
      daily: [
        { totalCost: 1, modelsUsed: [], totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      ],
      totals: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Invalid entry");
  });

  it("rejects entry with non-numeric cost", () => {
    const bad = JSON.stringify({
      daily: [
        {
          date: "2025-06-01",
          totalCost: "not a number",
          modelsUsed: [],
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
      ],
      totals: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Invalid entry");
  });

  it("rejects entry with negative cost", () => {
    const bad = JSON.stringify({
      daily: [
        {
          date: "2025-06-01",
          totalCost: -1,
          modelsUsed: [],
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
      ],
      totals: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Negative cost");
  });

  it("rejects entry with negative token counts", () => {
    const bad = JSON.stringify({
      daily: [
        {
          date: "2025-06-01",
          totalCost: 1,
          modelsUsed: [],
          totalTokens: -1,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
      ],
      totals: {},
    });
    expect(() => parseCcusageOutput(bad)).toThrow("Negative token count");
  });
});

// ---------------------------------------------------------------------------
// runCcusage — error handling
// ---------------------------------------------------------------------------

describe("runCcusage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCcusageBinCache();
    mockExecFileSync.mockImplementation(mockWhichFound());
  });

  it("calls execFileSync with correct arguments", () => {
    runCcusage("20250601", "20250601");
    const ccusageCall = mockExecFileSync.mock.calls.find(
      (c) => c[0] !== "which",
    );
    expect(ccusageCall).toBeDefined();
    expect(ccusageCall![1]).toEqual([
      "daily", "--json", "--since", "20250601", "--until", "20250601",
    ]);
  });

  // --- NOT FOUND: the original "unknown error" bug ---

  it("detects ENOENT (the actual Node error when binary is missing)", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") throw new Error("not found");
      const err = new Error("spawn ccusage ENOENT") as Error & { code: string };
      err.code = "ENOENT";
      throw err;
    });
    const thrown = () => runCcusage("20250601", "20250601");
    expect(thrown).toThrow("ccusage is not installed");
    expect(thrown).toThrow("which ccusage"); // actionable advice
  });

  it("detects exit code 127 (shell-convention not-found)", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") throw new Error("not found");
      const err = new Error("command not found") as Error & {
        status: number;
        stderr: string;
      };
      err.status = 127;
      err.stderr = "";
      throw err;
    });
    expect(() => runCcusage("20250601", "20250601")).toThrow(
      "ccusage is not installed",
    );
  });

  it("detects stderr containing 'not found'", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") throw new Error("not found");
      const err = new Error("fail") as Error & {
        status: number;
        stderr: string;
      };
      err.status = 1;
      err.stderr = "ccusage: command not found";
      throw err;
    });
    expect(() => runCcusage("20250601", "20250601")).toThrow(
      "ccusage is not installed",
    );
  });

  it("detects ENOENT in error message string", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") throw new Error("not found");
      // Some Node versions embed ENOENT in the message only
      throw new Error("spawn ccusage ENOENT");
    });
    expect(() => runCcusage("20250601", "20250601")).toThrow(
      "ccusage is not installed",
    );
  });

  it("includes PATH snippet in not-installed error for debugging", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") throw new Error("not found");
      const err = new Error("spawn ccusage ENOENT") as Error & { code: string };
      err.code = "ENOENT";
      throw err;
    });
    try {
      runCcusage("20250601", "20250601");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("PATH (first 5):");
      expect(msg).toContain("resolved:");
    }
  });

  // --- TIMEOUT ---

  it("reports timeout with diagnostic context when killed", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      const err = new Error("killed") as Error & {
        killed: boolean;
        signal: string;
      };
      err.killed = true;
      err.signal = "SIGTERM";
      throw err;
    });
    try {
      runCcusage("20250601", "20250601");
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("timed out");
      expect(msg).toContain("ccusage daily --json");
      expect(msg).toContain("signal: SIGTERM");
      expect(msg).toContain("killed: true");
    }
  });

  it("reports timeout when only killed flag is set (no signal)", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      const err = new Error("timeout") as Error & { killed: boolean };
      err.killed = true;
      throw err;
    });
    expect(() => runCcusage("20250601", "20250601")).toThrow("timed out");
  });

  // --- PERMISSION DENIED ---

  it("reports EACCES with fix instructions and diagnostic context", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      const err = new Error("permission denied") as Error & { code: string };
      err.code = "EACCES";
      throw err;
    });
    try {
      runCcusage("20250601", "20250601");
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("not executable");
      expect(msg).toContain("chmod +x");
      expect(msg).toContain("code: EACCES");
    }
  });

  // --- GENERIC FAILURES ---

  it("includes stderr in error when available", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      const err = new Error("fail") as Error & {
        status: number;
        stderr: string;
      };
      err.status = 1;
      err.stderr = "Error: no JSONL files found";
      throw err;
    });
    try {
      runCcusage("20250601", "20250601");
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("ccusage failed: Error: no JSONL files found");
      expect(msg).toContain("exit: 1");
    }
  });

  it("falls back to error.message when stderr is empty", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      const err = new Error("something went wrong") as Error & {
        status: number;
        stderr: string;
      };
      err.status = 1;
      err.stderr = "";
      throw err;
    });
    try {
      runCcusage("20250601", "20250601");
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("ccusage failed: something went wrong");
      expect(msg).toContain("exit: 1");
    }
  });

  it("falls back to error.message when stderr is undefined", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      const err = new Error("crash") as Error & { status: number };
      err.status = 2;
      throw err;
    });
    try {
      runCcusage("20250601", "20250601");
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("ccusage failed: crash");
      expect(msg).toContain("exit: 2");
    }
  });

  it("never produces 'unknown error' when error.message exists", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      // Simulate the exact old bug scenario: no status, no stderr, no code
      throw new Error("segfault");
    });
    try {
      runCcusage("20250601", "20250601");
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("unknown error");
      expect(msg).toContain("segfault");
    }
  });

  it("includes binary path in diagnostic context", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/opt/homebrew/bin/ccusage" as never;
      const err = new Error("oops") as Error & { status: number };
      err.status = 1;
      throw err;
    });
    try {
      runCcusage("20250601", "20250601");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("binary: /opt/homebrew/bin/ccusage");
    }
  });
});

// ---------------------------------------------------------------------------
// runCcusageRaw — same error handling, needs its own coverage
// ---------------------------------------------------------------------------

describe("runCcusageRaw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCcusageBinCache();
    mockExecFileSync.mockImplementation(mockWhichFound());
  });

  it("returns raw JSON string on success", () => {
    const result = runCcusageRaw("20250601", "20250601");
    expect(result).toBe(validOutput());
  });

  it("detects ENOENT and shows not-installed message", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") throw new Error("not found");
      const err = new Error("spawn ccusage ENOENT") as Error & { code: string };
      err.code = "ENOENT";
      throw err;
    });
    expect(() => runCcusageRaw("20250601", "20250601")).toThrow(
      "ccusage is not installed",
    );
  });

  it("detects exit code 127", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") throw new Error("not found");
      const err = new Error("command not found") as Error & {
        status: number;
        stderr: string;
      };
      err.status = 127;
      err.stderr = "";
      throw err;
    });
    expect(() => runCcusageRaw("20250601", "20250601")).toThrow(
      "ccusage is not installed",
    );
  });

  it("reports timeout", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      const err = new Error("killed") as Error & {
        killed: boolean;
        signal: string;
      };
      err.killed = true;
      err.signal = "SIGTERM";
      throw err;
    });
    expect(() => runCcusageRaw("20250601", "20250601")).toThrow("timed out");
  });

  it("reports EACCES", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      const err = new Error("permission denied") as Error & { code: string };
      err.code = "EACCES";
      throw err;
    });
    expect(() => runCcusageRaw("20250601", "20250601")).toThrow("not executable");
  });

  it("includes stderr detail on generic failure", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      const err = new Error("fail") as Error & {
        status: number;
        stderr: string;
      };
      err.status = 1;
      err.stderr = "Error: invalid date range";
      throw err;
    });
    try {
      runCcusageRaw("20250601", "20250601");
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("ccusage failed: Error: invalid date range");
      expect(msg).toContain("exit: 1");
    }
  });

  it("never produces 'unknown error'", () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === "which") return "/usr/local/bin/ccusage" as never;
      throw new Error("unexpected crash");
    });
    try {
      runCcusageRaw("20250601", "20250601");
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("unknown error");
      expect(msg).toContain("unexpected crash");
    }
  });
});
