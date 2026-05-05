import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureCcusageInstalled, _resetCcusageResolver } from "../src/lib/ccusage.js";

/**
 * Orchestration-only tests for `ensureCcusageInstalled`.
 *
 * The pure command-selection logic ("bun vs npm", "what args") is tested
 * separately in `pick-install-command.test.ts` against the real
 * `pickInstallCommand` function — no mocks needed there.
 *
 * What's left here is the orchestrator: which branch we take based on PATH
 * state + TTY state + the user's prompt response. Those decisions still
 * need mocks because the orchestrator's *job* is to read process state
 * (PATH, isatty(stdin/stdout)) and react. We mock at those true boundaries
 * (node:child_process, node:fs, prompt) but never at the system under test.
 */

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

describe("ensureCcusageInstalled — orchestration branches", () => {
  it("no-ops and skips the prompt when ccusage is already on PATH", async () => {
    mockExistsSync.mockReturnValue(true);
    await expect(ensureCcusageInstalled()).resolves.toBeUndefined();
    expect(mockIsInteractive).not.toHaveBeenCalled();
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it("throws the manual-install error in non-TTY contexts (auto-push, CI)", async () => {
    mockExistsSync.mockReturnValue(false);
    mockIsInteractive.mockReturnValue(false);
    await expect(ensureCcusageInstalled()).rejects.toThrow(/not installed or not on PATH/);
    expect(mockPromptYesNo).not.toHaveBeenCalled();
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it("throws cleanly when the user declines the prompt", async () => {
    mockExistsSync.mockReturnValue(false);
    mockIsInteractive.mockReturnValue(true);
    mockPromptYesNo.mockResolvedValue(false);
    await expect(ensureCcusageInstalled()).rejects.toThrow(/Install it manually/);
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it("wraps install-time exec errors with a manual-fallback message", async () => {
    mockExistsSync.mockReturnValue(false);
    mockIsInteractive.mockReturnValue(true);
    mockPromptYesNo.mockResolvedValue(true);
    mockExecFileSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });
    await expect(ensureCcusageInstalled()).rejects.toThrow(/Install it manually/);
  });

  it("rechecks PATH after install and reports if the binary is still missing", async () => {
    mockExistsSync.mockReturnValue(false); // never appears on PATH
    mockIsInteractive.mockReturnValue(true);
    mockPromptYesNo.mockResolvedValue(true);
    mockExecFileSync.mockReturnValue(Buffer.from(""));
    await expect(ensureCcusageInstalled()).rejects.toThrow(/may need to open a new shell/);
  });

  it("succeeds end-to-end when accepted, installed, and binary appears on PATH", async () => {
    let installRan = false;
    mockExistsSync.mockImplementation((p: unknown) => {
      const path = String(p);
      if (path.includes("ccusage")) return installRan;
      return false;
    });
    mockIsInteractive.mockReturnValue(true);
    mockPromptYesNo.mockResolvedValue(true);
    mockExecFileSync.mockImplementation(() => {
      installRan = true;
      return Buffer.from("");
    });
    await expect(ensureCcusageInstalled()).resolves.toBeUndefined();
    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
  });
});
