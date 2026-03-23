import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let fileStore: Record<string, string> = {};

vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => path in fileStore),
  readFileSync: vi.fn((path: string) => fileStore[path] ?? ""),
  writeFileSync: vi.fn((path: string, data: string) => {
    fileStore[path] = data;
  }),
  mkdirSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  installClaudeCodeHook,
  uninstallClaudeCodeHook,
  isClaudeCodeHookInstalled,
  CLAUDE_SETTINGS_PATH,
} from "../src/lib/hooks.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  fileStore = {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedSettings(settings: Record<string, unknown>): void {
  fileStore[CLAUDE_SETTINGS_PATH] = JSON.stringify(settings, null, 2);
}

function readSettings(): Record<string, unknown> {
  return JSON.parse(fileStore[CLAUDE_SETTINGS_PATH]!);
}

// ---------------------------------------------------------------------------
// installClaudeCodeHook
// ---------------------------------------------------------------------------

describe("installClaudeCodeHook", () => {
  it("writes SessionEnd hook entry to settings.json", () => {
    seedSettings({ hooks: {} });

    installClaudeCodeHook();

    const settings = readSettings();
    const hooks = settings.hooks as Record<string, unknown>;
    const sessionEnd = hooks.SessionEnd as Array<{ hooks: Array<{ type: string; command: string }> }>;
    expect(sessionEnd).toHaveLength(1);
    expect(sessionEnd[0]!.hooks[0]!.type).toBe("command");
    expect(sessionEnd[0]!.hooks[0]!.command).toBe("straude push");
  });

  it("preserves existing hooks on other events", () => {
    seedSettings({
      hooks: {
        PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "tsc" }] }],
      },
    });

    installClaudeCodeHook();

    const settings = readSettings();
    const hooks = settings.hooks as Record<string, unknown>;
    expect(hooks.PostToolUse).toBeDefined();
    expect(hooks.SessionEnd).toBeDefined();
  });

  it("preserves existing SessionEnd hooks from other tools", () => {
    seedSettings({
      hooks: {
        SessionEnd: [{ hooks: [{ type: "command", command: "other-tool cleanup" }] }],
      },
    });

    installClaudeCodeHook();

    const settings = readSettings();
    const hooks = settings.hooks as Record<string, unknown>;
    const sessionEnd = hooks.SessionEnd as Array<{ hooks: Array<{ command: string }> }>;
    expect(sessionEnd).toHaveLength(2);
    expect(sessionEnd[0]!.hooks[0]!.command).toBe("other-tool cleanup");
    expect(sessionEnd[1]!.hooks[0]!.command).toBe("straude push");
  });

  it("is idempotent — does not duplicate entry", () => {
    seedSettings({
      hooks: {
        SessionEnd: [{ hooks: [{ type: "command", command: "straude push", timeout: 120 }] }],
      },
    });

    installClaudeCodeHook();

    const settings = readSettings();
    const hooks = settings.hooks as Record<string, unknown>;
    const sessionEnd = hooks.SessionEnd as unknown[];
    expect(sessionEnd).toHaveLength(1);
  });

  it("throws when settings.json does not exist", () => {
    expect(() => installClaudeCodeHook()).toThrow("Claude Code settings not found");
  });

  it("creates hooks key if missing", () => {
    seedSettings({ permissions: {} });

    installClaudeCodeHook();

    const settings = readSettings();
    expect(settings.hooks).toBeDefined();
    const hooks = settings.hooks as Record<string, unknown>;
    expect(hooks.SessionEnd).toBeDefined();
  });

  it("preserves non-hook settings fields", () => {
    seedSettings({ hooks: {}, permissions: { allow: [] }, env: { FOO: "bar" } });

    installClaudeCodeHook();

    const settings = readSettings();
    expect(settings.permissions).toEqual({ allow: [] });
    expect(settings.env).toEqual({ FOO: "bar" });
  });
});

// ---------------------------------------------------------------------------
// uninstallClaudeCodeHook
// ---------------------------------------------------------------------------

describe("uninstallClaudeCodeHook", () => {
  it("removes straude entry from SessionEnd", () => {
    seedSettings({
      hooks: {
        SessionEnd: [
          { hooks: [{ type: "command", command: "other-tool" }] },
          { hooks: [{ type: "command", command: "straude push", timeout: 120 }] },
        ],
      },
    });

    uninstallClaudeCodeHook();

    const settings = readSettings();
    const hooks = settings.hooks as Record<string, unknown>;
    const sessionEnd = hooks.SessionEnd as Array<{ hooks: Array<{ command: string }> }>;
    expect(sessionEnd).toHaveLength(1);
    expect(sessionEnd[0]!.hooks[0]!.command).toBe("other-tool");
  });

  it("removes SessionEnd key when array becomes empty", () => {
    seedSettings({
      hooks: {
        SessionEnd: [{ hooks: [{ type: "command", command: "straude push" }] }],
      },
    });

    uninstallClaudeCodeHook();

    const settings = readSettings();
    const hooks = settings.hooks as Record<string, unknown>;
    expect(hooks.SessionEnd).toBeUndefined();
  });

  it("leaves hooks object as {} when last event removed", () => {
    seedSettings({
      hooks: {
        SessionEnd: [{ hooks: [{ type: "command", command: "straude push" }] }],
      },
    });

    uninstallClaudeCodeHook();

    const settings = readSettings();
    expect(settings.hooks).toEqual({});
  });

  it("is a no-op when settings.json does not exist", () => {
    uninstallClaudeCodeHook(); // Should not throw
  });

  it("is a no-op when no straude entry exists", () => {
    seedSettings({
      hooks: {
        SessionEnd: [{ hooks: [{ type: "command", command: "other-tool" }] }],
      },
    });

    uninstallClaudeCodeHook();

    const settings = readSettings();
    const hooks = settings.hooks as Record<string, unknown>;
    const sessionEnd = hooks.SessionEnd as unknown[];
    expect(sessionEnd).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// isClaudeCodeHookInstalled
// ---------------------------------------------------------------------------

describe("isClaudeCodeHookInstalled", () => {
  it("returns true when hook is installed", () => {
    seedSettings({
      hooks: {
        SessionEnd: [{ hooks: [{ type: "command", command: "straude push" }] }],
      },
    });

    expect(isClaudeCodeHookInstalled()).toBe(true);
  });

  it("returns false when no hook exists", () => {
    seedSettings({ hooks: {} });
    expect(isClaudeCodeHookInstalled()).toBe(false);
  });

  it("returns false when settings.json does not exist", () => {
    expect(isClaudeCodeHookInstalled()).toBe(false);
  });

  it("returns false when SessionEnd has no straude entry", () => {
    seedSettings({
      hooks: {
        SessionEnd: [{ hooks: [{ type: "command", command: "other-tool" }] }],
      },
    });

    expect(isClaudeCodeHookInstalled()).toBe(false);
  });
});
