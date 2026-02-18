#!/usr/bin/env node

import { loginCommand } from "./commands/login.js";
import { pushCommand } from "./commands/push.js";
import { statusCommand } from "./commands/status.js";
import { syncCommand } from "./commands/sync.js";
import { CLI_VERSION } from "./config.js";

const HELP = `
straude v${CLI_VERSION} — Push your Claude Code usage to Straude

Usage:
  straude                Sync latest stats (login if needed)
  straude <command>      Run a specific command

Commands:
  login              Authenticate with Straude via browser
  push               Push usage data to Straude
  status             Show your current stats

Push options:
  --date YYYY-MM-DD  Push a specific date (within last 7 days)
  --days N           Push last N days (max 7)
  --dry-run          Preview without posting

Examples:
  npx straude@latest
  straude push --days 3
  straude status
`.trim();

function parseArgs(args: string[]): { command: string | null; options: Record<string, string | boolean> } {
  const options: Record<string, string | boolean> = {};
  let command: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--date" && i + 1 < args.length) {
      options.date = args[++i]!;
    } else if (arg === "--days" && i + 1 < args.length) {
      options.days = args[++i]!;
    } else if (arg === "--api-url" && i + 1 < args.length) {
      options.apiUrl = args[++i]!;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--version" || arg === "-v") {
      options.version = true;
    } else if (!arg.startsWith("-") && !command) {
      command = arg;
    }
  }

  return { command, options };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, options } = parseArgs(args);

  if (options.version) {
    console.log(`straude v${CLI_VERSION}`);
    return;
  }

  if (options.help || command === "help") {
    console.log(HELP);
    return;
  }

  // No command → smart sync (login if needed, then push new stats)
  if (!command) {
    await syncCommand(options.apiUrl as string | undefined);
    return;
  }

  switch (command) {
    case "login":
      await loginCommand(options.apiUrl as string | undefined);
      break;
    case "push": {
      // Allow --api-url to override stored config for push
      const apiUrl = options.apiUrl as string | undefined;
      let pushConfig: import("./lib/auth.js").StraudeConfig | undefined;
      if (apiUrl) {
        const { loadConfig } = await import("./lib/auth.js");
        const cfg = loadConfig();
        if (cfg) pushConfig = { ...cfg, api_url: apiUrl };
      }
      await pushCommand(
        {
          date: options.date as string | undefined,
          days: options.days ? parseInt(options.days as string, 10) : undefined,
          dryRun: options.dryRun === true,
        },
        pushConfig,
      );
      break;
    }
    case "status":
      await statusCommand();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
});
