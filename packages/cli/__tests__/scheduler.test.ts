import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

let fileStore: Record<string, string> = {};
let fileDeleted: string[] = [];

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => path in fileStore),
  readFileSync: vi.fn((path: string) => fileStore[path] ?? ""),
  realpathSync: vi.fn((path: string) => path),
  writeFileSync: vi.fn((path: string, data: string) => {
    fileStore[path] = data;
  }),
  unlinkSync: vi.fn((path: string) => {
    delete fileStore[path];
    fileDeleted.push(path);
  }),
  mkdirSync: vi.fn(),
  statSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import {
  detectScheduler,
  installScheduler,
  uninstallScheduler,
  isSchedulerInstalled,
  _parseTime,
  _buildWrapperScript,
  _buildPlist,
} from "../src/lib/scheduler.js";
import { AUTO_PUSH_SCRIPT_FILE, LAUNCHD_PLIST_PATH } from "../src/config.js";

const mockExecFileSync = vi.mocked(execFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  fileStore = {};
  fileDeleted = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("detectScheduler", () => {
  it("returns launchd on darwin", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    expect(detectScheduler()).toBe("launchd");
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  });

  it("returns cron on linux", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    expect(detectScheduler()).toBe("cron");
    Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
  });
});

describe("_parseTime", () => {
  it("parses valid time 09:00", () => {
    expect(_parseTime("09:00")).toEqual({ hour: 9, minute: 0 });
  });

  it("parses valid time 21:30", () => {
    expect(_parseTime("21:30")).toEqual({ hour: 21, minute: 30 });
  });

  it("parses valid time 0:00", () => {
    expect(_parseTime("0:00")).toEqual({ hour: 0, minute: 0 });
  });

  it("throws on invalid format", () => {
    expect(() => _parseTime("invalid")).toThrow("Invalid time format");
  });

  it("throws on hour out of range", () => {
    expect(() => _parseTime("25:00")).toThrow("Invalid hour");
  });

  it("throws on minute out of range", () => {
    expect(() => _parseTime("09:60")).toThrow("Invalid minute");
  });

  it("throws on empty string", () => {
    expect(() => _parseTime("")).toThrow("Invalid time format");
  });
});

describe("_buildWrapperScript", () => {
  it("includes current PATH", () => {
    const script = _buildWrapperScript();
    expect(script).toContain("#!/bin/sh");
    expect(script).toContain("Auto-push starting");
    expect(script).toContain("exec bunx straude@0.2.0 push --non-interactive");
    expect(script).toContain("exec npx --yes straude@0.2.0 push --non-interactive");
    expect(script).not.toContain("straude@latest");
    expect(script).toContain("tail -n 500");
  });

  it("passes crontab content through stdin without a shell", () => {
    let installed = "0 8 * * * echo $(touch /tmp/should-not-run)\n";
    mockExecFileSync.mockImplementation((command, args, options) => {
      if (command === "crontab" && args?.[0] === "-l") {
        return installed;
      }
      if (command === "crontab" && args?.[0] === "-") {
        installed = String(options?.input ?? "");
      }
      return "";
    });

    installScheduler("09:00", "cron");

    expect(mockExecFileSync).toHaveBeenCalledWith(
      "crontab",
      ["-"],
      expect.objectContaining({
        input: expect.stringContaining("$(touch /tmp/should-not-run)"),
      }),
    );
  });
});

describe("_buildPlist", () => {
  it("generates valid plist with correct hour and minute", () => {
    const plist = _buildPlist(14, 30);
    expect(plist).toContain("<integer>14</integer>");
    expect(plist).toContain("<integer>30</integer>");
    expect(plist).toContain("com.straude.auto-push");
    expect(plist).toContain(AUTO_PUSH_SCRIPT_FILE);
  });
});

describe("installScheduler — launchd", () => {
  it("writes plist and wrapper script, calls launchctl load", () => {
    installScheduler("14:30", "launchd");

    // Wrapper script written
    expect(fileStore[AUTO_PUSH_SCRIPT_FILE]).toContain("#!/bin/sh");
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      AUTO_PUSH_SCRIPT_FILE,
      expect.any(String),
      expect.objectContaining({ mode: 0o755 }),
    );

    // Plist written
    expect(fileStore[LAUNCHD_PLIST_PATH]).toContain("<integer>14</integer>");
    expect(fileStore[LAUNCHD_PLIST_PATH]).toContain("<integer>30</integer>");

    // launchctl load called
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "launchctl",
      expect.arrayContaining(["bootstrap", LAUNCHD_PLIST_PATH]),
      expect.anything(),
    );
  });

  it("surfaces launchctl activation failures", () => {
    mockExecFileSync.mockImplementation((_command, args) => {
      if (args?.[0] === "bootstrap") throw new Error("permission denied");
      return "";
    });

    expect(() => installScheduler("09:00", "launchd")).toThrow(/launchctl bootstrap/);
    expect(fileStore[LAUNCHD_PLIST_PATH]).toBeUndefined();
  });

  it("restores the prior launchd files and service when replacement fails", () => {
    fileStore[AUTO_PUSH_SCRIPT_FILE] = "old wrapper";
    fileStore[LAUNCHD_PLIST_PATH] = "old plist";
    let bootstrapCalls = 0;
    mockExecFileSync.mockImplementation((_command, args) => {
      if (args?.[0] === "print") return "loaded";
      if (args?.[0] === "bootstrap" && bootstrapCalls++ === 0) {
        throw new Error("new service rejected");
      }
      return "";
    });

    expect(() => installScheduler("09:00", "launchd")).toThrow(/launchctl bootstrap/);

    expect(fileStore[AUTO_PUSH_SCRIPT_FILE]).toBe("old wrapper");
    expect(fileStore[LAUNCHD_PLIST_PATH]).toBe("old plist");
    expect(bootstrapCalls).toBe(2);
  });
});

describe("installScheduler — cron", () => {
  it("appends tagged entry to crontab", () => {
    // No existing crontab
    let installed: string | null = null;
    mockExecFileSync.mockImplementation((command, args, options) => {
      if (command === "crontab" && args?.[0] === "-l") {
        if (installed === null) throw new Error("no crontab");
        return installed;
      }
      if (command === "crontab" && args?.[0] === "-") {
        installed = String(options?.input ?? "");
      }
      return "";
    });

    installScheduler("09:00", "cron");

    // Wrapper script written
    expect(fileStore[AUTO_PUSH_SCRIPT_FILE]).toContain("#!/bin/sh");

    // Crontab set with tagged entry
    const setCrontabCall = mockExecFileSync.mock.calls.find(
      (call) => call[0] === "crontab" && call[1]?.[0] === "-",
    );
    expect(setCrontabCall).toBeDefined();
    const crontabContent = setCrontabCall![2]?.input as string;
    expect(crontabContent).toContain("0 9 * * *");
    expect(crontabContent).toContain("# straude-auto-push");
  });

  it("replaces existing straude entry", () => {
    let installed = "0 8 * * * some-other-job\n30 21 * * * old-straude-entry # straude-auto-push\n";
    mockExecFileSync.mockImplementation((command, args, options) => {
      if (command === "crontab" && args?.[0] === "-l") {
        return installed;
      }
      if (command === "crontab" && args?.[0] === "-") {
        installed = String(options?.input ?? "");
      }
      return "";
    });

    installScheduler("14:30", "cron");

    const setCrontabCall = mockExecFileSync.mock.calls.find(
      (call) => call[0] === "crontab" && call[1]?.[0] === "-",
    );
    const crontabContent = setCrontabCall![2]?.input as string;
    // Old entry removed, new one added
    expect(crontabContent).toContain("30 14 * * *");
    expect(crontabContent).toContain("some-other-job");
    // Should only have one straude-auto-push tag
    expect(crontabContent.match(/straude-auto-push/g)?.length).toBe(1);
  });

  it("restores the prior crontab and wrapper when activation cannot be verified", () => {
    const previousCrontab = "0 8 * * * old-job\n";
    fileStore[AUTO_PUSH_SCRIPT_FILE] = "old wrapper";
    let installed = previousCrontab;
    let reads = 0;
    mockExecFileSync.mockImplementation((command, args, options) => {
      if (command === "crontab" && args?.[0] === "-l") {
        reads += 1;
        return reads === 1 ? installed : previousCrontab;
      }
      if (command === "crontab" && args?.[0] === "-") {
        installed = String(options?.input ?? "");
      }
      return "";
    });

    expect(() => installScheduler("09:00", "cron")).toThrow(/not active/);

    expect(installed).toBe(previousCrontab);
    expect(fileStore[AUTO_PUSH_SCRIPT_FILE]).toBe("old wrapper");
  });
});

describe("uninstallScheduler — launchd", () => {
  it("calls launchctl unload and deletes plist + wrapper", () => {
    fileStore[LAUNCHD_PLIST_PATH] = "<plist>...</plist>";
    fileStore[AUTO_PUSH_SCRIPT_FILE] = "#!/bin/sh\n...";

    uninstallScheduler("launchd");

    expect(mockExecFileSync).toHaveBeenCalledWith(
      "launchctl",
      expect.arrayContaining(["bootout", LAUNCHD_PLIST_PATH]),
      expect.anything(),
    );
    expect(fileDeleted).toContain(LAUNCHD_PLIST_PATH);
    expect(fileDeleted).toContain(AUTO_PUSH_SCRIPT_FILE);
  });

  it("is a no-op when plist does not exist", () => {
    uninstallScheduler("launchd");
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });
});

describe("uninstallScheduler — cron", () => {
  it("removes tagged entry from crontab", () => {
    mockExecFileSync.mockImplementation((command, args) => {
      if (command === "crontab" && args?.[0] === "-l") {
        return "0 8 * * * some-other-job\n0 21 * * * straude-push # straude-auto-push\n";
      }
      return "";
    });
    fileStore[AUTO_PUSH_SCRIPT_FILE] = "#!/bin/sh\n...";

    uninstallScheduler("cron");

    const setCrontabCall = mockExecFileSync.mock.calls.find(
      (call) => call[0] === "crontab" && call[1]?.[0] === "-",
    );
    const crontabContent = setCrontabCall![2]?.input as string;
    expect(crontabContent).toContain("some-other-job");
    expect(crontabContent).not.toContain("straude-auto-push");
  });

  it("removes crontab entirely when no entries remain", () => {
    mockExecFileSync.mockImplementation((command, args) => {
      if (command === "crontab" && args?.[0] === "-l") {
        return "0 21 * * * straude-push # straude-auto-push\n";
      }
      return "";
    });
    fileStore[AUTO_PUSH_SCRIPT_FILE] = "#!/bin/sh\n...";

    uninstallScheduler("cron");

    expect(mockExecFileSync).toHaveBeenCalledWith(
      "crontab",
      ["-r"],
      expect.anything(),
    );
  });

  it("is a no-op when no straude entry exists", () => {
    mockExecFileSync.mockImplementation((command, args) => {
      if (command === "crontab" && args?.[0] === "-l") {
        return "0 8 * * * some-other-job\n";
      }
      return "";
    });

    uninstallScheduler("cron");

    // Should not write a new crontab
    const setCrontabCall = mockExecFileSync.mock.calls.find(
      (call) => call[0] === "crontab" && call[1]?.[0] === "-",
    );
    expect(setCrontabCall).toBeUndefined();
  });
});

describe("isSchedulerInstalled", () => {
  it("returns true for launchd when plist exists", () => {
    fileStore[LAUNCHD_PLIST_PATH] = "<plist/>";
    expect(isSchedulerInstalled("launchd")).toBe(true);
  });

  it("returns false for launchd when plist missing", () => {
    expect(isSchedulerInstalled("launchd")).toBe(false);
  });

  it("returns false for launchd when the plist exists but the job is not loaded", () => {
    fileStore[LAUNCHD_PLIST_PATH] = "<plist/>";
    mockExecFileSync.mockImplementation(() => {
      throw new Error("service not found");
    });
    expect(isSchedulerInstalled("launchd")).toBe(false);
  });

  it("returns true for cron when tagged entry exists", () => {
    mockExecFileSync.mockReturnValue("0 21 * * * ... # straude-auto-push\n");
    expect(isSchedulerInstalled("cron")).toBe(true);
  });

  it("returns false for cron when no tagged entry", () => {
    mockExecFileSync.mockReturnValue("0 8 * * * other-job\n");
    expect(isSchedulerInstalled("cron")).toBe(false);
  });

  it("returns false for cron when crontab fails", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("no crontab");
    });
    expect(isSchedulerInstalled("cron")).toBe(false);
  });
});
