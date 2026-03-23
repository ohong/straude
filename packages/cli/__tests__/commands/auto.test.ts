import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../src/lib/auth.js", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}));

vi.mock("../../src/lib/scheduler.js", () => ({
  detectScheduler: vi.fn(),
  installScheduler: vi.fn(),
  uninstallScheduler: vi.fn(),
  isSchedulerInstalled: vi.fn(),
}));

vi.mock("../../src/lib/hooks.js", () => ({
  installClaudeCodeHook: vi.fn(),
  uninstallClaudeCodeHook: vi.fn(),
  isClaudeCodeHookInstalled: vi.fn(),
}));

vi.mock("../../src/lib/auto-push-logger.js", () => ({
  readLog: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { enableAutoPush, disableAutoPush, autoCommand } from "../../src/commands/auto.js";
import { loadConfig, saveConfig } from "../../src/lib/auth.js";
import {
  detectScheduler,
  installScheduler,
  uninstallScheduler,
  isSchedulerInstalled,
} from "../../src/lib/scheduler.js";
import {
  installClaudeCodeHook,
  uninstallClaudeCodeHook,
  isClaudeCodeHookInstalled,
} from "../../src/lib/hooks.js";
import { readLog } from "../../src/lib/auto-push-logger.js";
import type { StraudeConfig } from "../../src/lib/auth.js";

const mockLoadConfig = vi.mocked(loadConfig);
const mockSaveConfig = vi.mocked(saveConfig);
const mockDetectScheduler = vi.mocked(detectScheduler);
const mockInstallScheduler = vi.mocked(installScheduler);
const mockUninstallScheduler = vi.mocked(uninstallScheduler);
const mockIsSchedulerInstalled = vi.mocked(isSchedulerInstalled);
const mockInstallClaudeCodeHook = vi.mocked(installClaudeCodeHook);
const mockUninstallClaudeCodeHook = vi.mocked(uninstallClaudeCodeHook);
const mockIsClaudeCodeHookInstalled = vi.mocked(isClaudeCodeHookInstalled);
const mockReadLog = vi.mocked(readLog);

class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

function makeConfig(overrides: Partial<StraudeConfig> = {}): StraudeConfig {
  return {
    token: "tok",
    username: "alice",
    api_url: "https://straude.com",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockDetectScheduler.mockReturnValue("launchd");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code as number);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// enableAutoPush — scheduler (default)
// ---------------------------------------------------------------------------

describe("enableAutoPush — scheduler", () => {
  it("installs scheduler with default time and updates config", () => {
    const config = makeConfig();
    enableAutoPush(config);

    expect(mockInstallScheduler).toHaveBeenCalledWith("21:00", "launchd");
    expect(mockSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        auto_push: expect.objectContaining({ enabled: true, time: "21:00", scheduler: "launchd", mechanism: "scheduler" }),
      }),
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Auto-push enabled"));
  });

  it("uses custom time when provided", () => {
    const config = makeConfig();
    enableAutoPush(config, "14:30");

    expect(mockInstallScheduler).toHaveBeenCalledWith("14:30", "launchd");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("14:30"));
  });

  it("uninstalls existing scheduler before reinstalling (idempotent)", () => {
    const config = makeConfig({
      auto_push: { enabled: true, time: "09:00", scheduler: "launchd", mechanism: "scheduler" },
    });

    enableAutoPush(config, "21:00");

    expect(mockUninstallScheduler).toHaveBeenCalledWith("launchd");
    expect(mockInstallScheduler).toHaveBeenCalledWith("21:00", "launchd");
  });

  it("does not uninstall if not previously enabled", () => {
    const config = makeConfig();
    enableAutoPush(config);

    expect(mockUninstallScheduler).not.toHaveBeenCalled();
    expect(mockInstallScheduler).toHaveBeenCalled();
  });

  it("exits with error on Windows", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    const config = makeConfig();
    expect(() => enableAutoPush(config)).toThrow(ExitError);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("not supported on Windows"));

    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  });

  it("uses cron scheduler on linux", () => {
    mockDetectScheduler.mockReturnValue("cron");
    const config = makeConfig();
    enableAutoPush(config);

    expect(mockInstallScheduler).toHaveBeenCalledWith("21:00", "cron");
  });
});

// ---------------------------------------------------------------------------
// enableAutoPush — hooks
// ---------------------------------------------------------------------------

describe("enableAutoPush — hooks", () => {
  it("installs Claude Code hook and saves mechanism", () => {
    const config = makeConfig();
    enableAutoPush(config, undefined, "hooks");

    expect(mockInstallClaudeCodeHook).toHaveBeenCalled();
    expect(mockInstallScheduler).not.toHaveBeenCalled();
    expect(mockSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        auto_push: expect.objectContaining({ enabled: true, mechanism: "hooks" }),
      }),
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Claude Code SessionEnd"));
  });

  it("disables existing scheduler when switching to hooks", () => {
    const config = makeConfig({
      auto_push: { enabled: true, time: "21:00", scheduler: "launchd", mechanism: "scheduler" },
    });

    enableAutoPush(config, undefined, "hooks");

    expect(mockUninstallScheduler).toHaveBeenCalledWith("launchd");
    expect(mockInstallClaudeCodeHook).toHaveBeenCalled();
  });

  it("disables existing hooks when switching to hooks (idempotent)", () => {
    const config = makeConfig({
      auto_push: { enabled: true, time: "21:00", scheduler: "launchd", mechanism: "hooks" },
    });

    enableAutoPush(config, undefined, "hooks");

    expect(mockUninstallClaudeCodeHook).toHaveBeenCalled();
    expect(mockInstallClaudeCodeHook).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// disableAutoPush
// ---------------------------------------------------------------------------

describe("disableAutoPush", () => {
  it("uninstalls scheduler and clears config", () => {
    const config = makeConfig({
      auto_push: { enabled: true, time: "21:00", scheduler: "launchd", mechanism: "scheduler" },
    });

    disableAutoPush(config);

    expect(mockUninstallScheduler).toHaveBeenCalledWith("launchd");
    expect(mockSaveConfig).toHaveBeenCalledWith(
      expect.not.objectContaining({ auto_push: expect.anything() }),
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Auto-push disabled"));
  });

  it("uninstalls hooks when mechanism is hooks", () => {
    const config = makeConfig({
      auto_push: { enabled: true, time: "21:00", scheduler: "launchd", mechanism: "hooks" },
    });

    disableAutoPush(config);

    expect(mockUninstallClaudeCodeHook).toHaveBeenCalled();
    expect(mockUninstallScheduler).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Auto-push disabled"));
  });

  it("defaults to scheduler when mechanism is undefined (legacy config)", () => {
    const config = makeConfig({
      auto_push: { enabled: true, time: "21:00", scheduler: "launchd" },
    });

    disableAutoPush(config);

    expect(mockUninstallScheduler).toHaveBeenCalledWith("launchd");
    expect(mockUninstallClaudeCodeHook).not.toHaveBeenCalled();
  });

  it("prints 'not enabled' when auto_push is not set", () => {
    const config = makeConfig();
    disableAutoPush(config);

    expect(mockUninstallScheduler).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("not enabled"));
  });
});

// ---------------------------------------------------------------------------
// autoCommand — status
// ---------------------------------------------------------------------------

describe("autoCommand — status", () => {
  it("shows disabled when not logged in", () => {
    mockLoadConfig.mockReturnValue(null);
    autoCommand(null);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("disabled"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("straude --auto"));
  });

  it("shows disabled when auto_push is not set", () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    autoCommand(null);

    expect(console.log).toHaveBeenCalledWith("Auto-push: disabled");
  });

  it("shows scheduler details when mechanism is scheduler", () => {
    mockLoadConfig.mockReturnValue(
      makeConfig({
        auto_push: { enabled: true, time: "14:30", scheduler: "launchd", mechanism: "scheduler" },
      }),
    );
    mockIsSchedulerInstalled.mockReturnValue(true);

    autoCommand(null);

    expect(console.log).toHaveBeenCalledWith("Auto-push: enabled");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("14:30"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("launchd"));
  });

  it("shows hooks details when mechanism is hooks", () => {
    mockLoadConfig.mockReturnValue(
      makeConfig({
        auto_push: { enabled: true, time: "21:00", scheduler: "launchd", mechanism: "hooks" },
      }),
    );
    mockIsClaudeCodeHookInstalled.mockReturnValue(true);

    autoCommand(null);

    expect(console.log).toHaveBeenCalledWith("Auto-push: enabled");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Claude Code SessionEnd"));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("hook installed"));
  });

  it("shows warning when hook is not found", () => {
    mockLoadConfig.mockReturnValue(
      makeConfig({
        auto_push: { enabled: true, time: "21:00", scheduler: "launchd", mechanism: "hooks" },
      }),
    );
    mockIsClaudeCodeHookInstalled.mockReturnValue(false);

    autoCommand(null);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("hook not found"));
  });

  it("shows warning when scheduler entry not found", () => {
    mockLoadConfig.mockReturnValue(
      makeConfig({
        auto_push: { enabled: true, time: "21:00", scheduler: "launchd" },
      }),
    );
    mockIsSchedulerInstalled.mockReturnValue(false);

    autoCommand(null);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });
});

// ---------------------------------------------------------------------------
// autoCommand — logs
// ---------------------------------------------------------------------------

describe("autoCommand — logs", () => {
  it("prints log lines", () => {
    mockReadLog.mockReturnValue([
      "[2026-03-22 21:00:01] Auto-push starting...",
      "[2026-03-22 21:00:04] Auto-push completed",
    ]);

    autoCommand("logs");

    expect(console.log).toHaveBeenCalledWith("[2026-03-22 21:00:01] Auto-push starting...");
    expect(console.log).toHaveBeenCalledWith("[2026-03-22 21:00:04] Auto-push completed");
  });

  it("prints 'no logs' when log file is empty", () => {
    mockReadLog.mockReturnValue([]);
    autoCommand("logs");

    expect(console.log).toHaveBeenCalledWith("No auto-push logs yet.");
  });
});
