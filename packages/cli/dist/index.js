#!/usr/bin/env node
import { loginCommand } from "./commands/login.js";
import { pushCommand } from "./commands/push.js";
import { statusCommand } from "./commands/status.js";
import { CLI_VERSION } from "./config.js";
const HELP = `
straude v${CLI_VERSION} — Push your Claude Code usage to Straude

Usage:
  straude <command> [options]

Commands:
  login              Authenticate with Straude via browser
  push               Push usage data to Straude
  status             Show your current stats

Push options:
  --date YYYY-MM-DD  Push a specific date (within last 7 days)
  --days N           Push last N days (max 7)
  --dry-run          Preview without posting

Examples:
  straude login
  straude push
  straude push --date 2026-02-15
  straude push --days 7
  straude push --dry-run
  straude status
`.trim();
function parseArgs(args) {
    const command = args[0] ?? "help";
    const options = {};
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--dry-run") {
            options.dryRun = true;
        }
        else if (arg === "--date" && i + 1 < args.length) {
            options.date = args[++i];
        }
        else if (arg === "--days" && i + 1 < args.length) {
            options.days = args[++i];
        }
        else if (arg === "--help" || arg === "-h") {
            options.help = true;
        }
        else if (arg === "--version" || arg === "-v") {
            options.version = true;
        }
    }
    return { command, options };
}
async function main() {
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
    switch (command) {
        case "login":
            await loginCommand();
            break;
        case "push":
            await pushCommand({
                date: options.date,
                days: options.days ? parseInt(options.days, 10) : undefined,
                dryRun: options.dryRun === true,
            });
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
main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
});
