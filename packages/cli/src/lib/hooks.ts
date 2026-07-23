import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { exactBackgroundCommand } from "./background-command.js";

export const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

interface HookEntry {
  type: string;
  command: string;
  timeout?: number;
  async?: boolean;
}

interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
}

function isStraudeHook(group: HookGroup): boolean {
  return group.hooks.some(
    (hook) => hook.type === "command"
      && hook.command.includes("straude")
      && /\bpush\b/.test(hook.command),
  );
}

function hasExactStraudeHook(group: HookGroup, command: string): boolean {
  return group.hooks.some(
    (hook) => hook.type === "command"
      && hook.command === command
      && hook.timeout === 300
      && hook.async === true,
  );
}

function readSettings(): Record<string, unknown> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    throw new Error(
      "Claude Code settings not found. Is Claude Code installed?\n" +
        `Expected: ${CLAUDE_SETTINGS_PATH}`,
    );
  }
  const raw = readFileSync(CLAUDE_SETTINGS_PATH, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function writeSettings(settings: Record<string, unknown>): void {
  const temporary = `${CLAUDE_SETTINGS_PATH}.${process.pid}.${randomUUID()}.tmp`;
  let fd: number | undefined;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeFileSync(fd, JSON.stringify(settings, null, 2) + "\n", "utf-8");
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, CLAUDE_SETTINGS_PATH);
    chmodSync(CLAUDE_SETTINGS_PATH, 0o600);
    try {
      const directory = openSync(dirname(CLAUDE_SETTINGS_PATH), "r");
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
    } catch {
      // Windows and some filesystems do not support fsync on directories.
    }
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Preserve the original write failure.
      }
    }
    try {
      unlinkSync(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // A cleanup failure must not hide a successful atomic rename.
      }
    }
  }
}

export function installClaudeCodeHook(): void {
  const settings = readSettings();
  const original = structuredClone(settings);
  const hookCommand = exactBackgroundCommand();

  // Ensure hooks object exists
  if (!settings.hooks || typeof settings.hooks !== "object") {
    settings.hooks = {};
  }
  const hooks = settings.hooks as Record<string, unknown>;

  // Ensure SessionEnd array exists
  if (!Array.isArray(hooks.SessionEnd)) {
    hooks.SessionEnd = [];
  }
  const sessionEnd = hooks.SessionEnd as HookGroup[];

  // Upgrade older hooks in place so background runs never trigger login.
  const existing = sessionEnd.flatMap((group) => group.hooks)
    .find((hook) => hook.type === "command"
      && hook.command.includes("straude")
      && /\bpush\b/.test(hook.command));
  if (existing) {
    if (
      existing.command === hookCommand
      && existing.timeout === 300
      && existing.async === true
    ) {
      return;
    }
    existing.command = hookCommand;
    existing.timeout = 300;
    existing.async = true;
    writeSettings(settings);
    if (!isExactClaudeCodeHookInstalled(hookCommand)) {
      writeSettings(original);
      throw new Error("Claude Code did not retain the upgraded Straude SessionEnd hook.");
    }
    return;
  }

  // Append our hook
  sessionEnd.push({
    hooks: [
      {
        type: "command",
        command: hookCommand,
        timeout: 300,
        async: true,
      },
    ],
  });

  writeSettings(settings);
  if (!isExactClaudeCodeHookInstalled(hookCommand)) {
    writeSettings(original);
    throw new Error("Claude Code did not retain the Straude SessionEnd hook.");
  }
}

export function uninstallClaudeCodeHook(): void {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return;

  const settings = readSettings();
  const hooks = settings.hooks as Record<string, unknown> | undefined;
  if (!hooks || !Array.isArray(hooks.SessionEnd)) return;

  const sessionEnd = hooks.SessionEnd as HookGroup[];
  const filtered = sessionEnd.filter((group) => !isStraudeHook(group));

  if (filtered.length === sessionEnd.length) return; // Nothing to remove

  if (filtered.length === 0) {
    delete hooks.SessionEnd;
  } else {
    hooks.SessionEnd = filtered;
  }

  writeSettings(settings);
}

export function isClaudeCodeHookInstalled(): boolean {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return false;

  try {
    const settings = readSettings();
    const hooks = settings.hooks as Record<string, unknown> | undefined;
    if (!hooks || !Array.isArray(hooks.SessionEnd)) return false;
    return (hooks.SessionEnd as HookGroup[]).some(isStraudeHook);
  } catch {
    return false;
  }
}

function isExactClaudeCodeHookInstalled(command: string): boolean {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return false;
  try {
    const settings = readSettings();
    const hooks = settings.hooks as Record<string, unknown> | undefined;
    if (!hooks || !Array.isArray(hooks.SessionEnd)) return false;
    return (hooks.SessionEnd as HookGroup[])
      .some((group) => hasExactStraudeHook(group, command));
  } catch {
    return false;
  }
}
