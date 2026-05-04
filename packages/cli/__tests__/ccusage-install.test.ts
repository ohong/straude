import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureCcusageInstalled, _resetCcusageResolver } from "../src/lib/ccusage.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn(() => false) };
});

vi.mock("../src/lib/prompt.js", () => ({
  isInteractive: vi.fn(),
  promptYesNo: vi.fn(),
}));

vi.mock("../src/lib/posthog.js", () => ({
  posthog: {
    capture: vi.fn(),
    _shutdown: vi.fn(() => Promise.resolve()),
  },
}));

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isInteractive, promptYesNo } from "../src/lib/prompt.js";

const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(existsSync);
const mockIsInteractive = vi.mocked(isInteractive);
const mockPromptYesNo = vi.mocked(promptYesNo);

beforeEach(() => {
  vi.clearAllMocks();
  _resetCcusageResolver();
});

describe("ensureCcusageInstalled", () => {
  it("returns immediately when ccusage is on PATH", async () => {
    mockExistsSync.mockReturnValue(true);
    await expect(ensureCcusageInstalled()).resolves.toBeUndefined();
    expect(mockIsInteractive).not.toHaveBeenCalled();
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it("throws the manual-install error in non-TTY contexts", async () => {
    mockExistsSync.mockReturnValue(false);
    mockIsInteractive.mockReturnValue(false);
    await expect(ensureCcusageInstalled()).rejects.toThrow(/not installed or not on PATH/);
    expect(mockPromptYesNo).not.toHaveBeenCalled();
  });

  it("throws when the user declines the prompt", async () => {
    mockExistsSync.mockReturnValue(false);
    mockIsInteractive.mockReturnValue(true);
    mockPromptYesNo.mockResolvedValue(false);
    await expect(ensureCcusageInstalled()).rejects.toThrow(/Install it manually/);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it("installs successfully when accepted and binary appears on PATH", async () => {
    // Two calls to existsSync per resolver invocation per PATH dir × suffix.
    // Simulate: not present at start → install runs → present afterwards.
    let installRan = false;
    mockExistsSync.mockImplementation((p: unknown) => {
      const path = String(p);
      // bun-detection probes return false; ccusage probes flip after install.
      if (path.includes("ccusage")) return installRan;
      return false; // bun not present → falls back to npm
    });
    mockIsInteractive.mockReturnValue(true);
    mockPromptYesNo.mockResolvedValue(true);
    mockExecFileSync.mockImplementation(() => {
      installRan = true;
      return Buffer.from("");
    });

    await expect(ensureCcusageInstalled()).resolves.toBeUndefined();
    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockExecFileSync.mock.calls[0]!;
    expect(cmd).toBe("npm");
    expect(args).toEqual(["install", "-g", "ccusage"]);
  });

  it("prefers bun when bun is on PATH", async () => {
    let installRan = false;
    mockExistsSync.mockImplementation((p: unknown) => {
      const path = String(p);
      if (path.includes("ccusage")) return installRan;
      if (path.includes("bun")) return true;
      return false;
    });
    mockIsInteractive.mockReturnValue(true);
    mockPromptYesNo.mockResolvedValue(true);
    mockExecFileSync.mockImplementation(() => {
      installRan = true;
      return Buffer.from("");
    });

    await ensureCcusageInstalled();
    const [cmd, args] = mockExecFileSync.mock.calls[0]!;
    expect(cmd).toBe("bun");
    expect(args).toEqual(["add", "-g", "ccusage"]);
  });

  it("surfaces install errors with a manual-fallback message", async () => {
    mockExistsSync.mockReturnValue(false);
    mockIsInteractive.mockReturnValue(true);
    mockPromptYesNo.mockResolvedValue(true);
    mockExecFileSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });
    await expect(ensureCcusageInstalled()).rejects.toThrow(/Install it manually/);
  });

  it("throws when install command succeeds but binary still missing from PATH", async () => {
    mockExistsSync.mockReturnValue(false); // never on PATH
    mockIsInteractive.mockReturnValue(true);
    mockPromptYesNo.mockResolvedValue(true);
    mockExecFileSync.mockReturnValue(Buffer.from(""));
    await expect(ensureCcusageInstalled()).rejects.toThrow(/may need to open a new shell/);
  });
});
