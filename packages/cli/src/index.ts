#!/usr/bin/env node

import { loginCommand } from "./commands/login.js";
import { pushCommand } from "./commands/push.js";
import { statusCommand } from "./commands/status.js";
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
  --timeout N        ccusage timeout in seconds (default: 120)

Examples:
  npx straude@latest
  straude --days 3
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
    } else if (arg === "--timeout" && i + 1 < args.length) {
      options.timeout = args[++i]!;
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

  const apiUrl = options.apiUrl as string | undefined;

  if (!command || command === "push") {
    await pushCommand(
      {
        date: options.date as string | undefined,
        days: options.days ? parseInt(options.days as string, 10) : undefined,
        dryRun: options.dryRun === true,
        timeoutMs: options.timeout ? parseInt(options.timeout as string, 10) * 1000 : undefined,
      },
      apiUrl,
    );
    return;
  }

  switch (command) {
    case "login":
      await loginCommand(apiUrl);
      break;
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
