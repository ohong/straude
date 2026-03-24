import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

const STRAUDE_HOOK_COMMAND = "straude push";

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
    (h) => h.type === "command" && h.command.includes(STRAUDE_HOOK_COMMAND),
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
  writeFileSync(
    CLAUDE_SETTINGS_PATH,
    JSON.stringify(settings, null, 2) + "\n",
    "utf-8",
  );
}

export function installClaudeCodeHook(): void {
  const settings = readSettings();

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

  // Check if straude hook already exists (idempotent)
  if (sessionEnd.some(isStraudeHook)) {
    return;
  }

  // Append our hook
  sessionEnd.push({
    hooks: [
      {
        type: "command",
        command: STRAUDE_HOOK_COMMAND,
        timeout: 120,
        async: true,
      },
    ],
  });

  writeSettings(settings);
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
