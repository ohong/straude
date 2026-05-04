#!/usr/bin/env node

import { loginCommand } from "./commands/login.js";
import { pushCommand } from "./commands/push.js";
import { statusCommand } from "./commands/status.js";
import { autoCommand, enableAutoPush, disableAutoPush } from "./commands/auto.js";
import { loadConfig } from "./lib/auth.js";
import { setAuthRefreshStrategy } from "./lib/api.js";
import { CLI_VERSION } from "./config.js";
import { posthog } from "./lib/posthog.js";
import { setDebug } from "./lib/debug.js";
import { isFirstRun, markFirstRun } from "./lib/first-run.js";
import { getDistinctId } from "./lib/machine-id.js";
import {
  errorMessage,
  isPushInvocation,
  reportCliException,
  reportUsagePushFailed,
} from "./lib/telemetry.js";

// On 401, transparently re-run the browser login flow and let api.ts retry
// the failed request. apiRequest gates this on isInteractive() so auto-push
// and CI runs still surface the original error.
setAuthRefreshStrategy(async (apiUrl) => {
  await loginCommand(apiUrl);
  return loadConfig();
});

// Exit cleanly when stdout/stderr is piped to a process that closes early
// (e.g., `straude --help | head`). Without this, every active user hits a
// `write EPIPE` exception.
function silenceEpipe(stream: NodeJS.WriteStream): void {
  stream.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") {
      process.exit(0);
    }
    throw err;
  });
}
silenceEpipe(process.stdout);
silenceEpipe(process.stderr);

const HELP = `
straude v${CLI_VERSION} — Push your Claude Code usage to Straude

Usage:
  straude                Sync latest stats (login if needed)
  straude <command>      Run a specific command

Commands:
  login              Authenticate with Straude via browser
  push               Push usage data to Straude
  status             Show your current stats
  auto               Show auto-push status or logs

Push options:
  --date YYYY-MM-DD  Push a specific date (within last 30 days)
  --days N           Push last N days (max 30)
  --dry-run          Preview without posting
  --timeout N        Subprocess timeout in seconds (default: 240)
  --auto             Enable daily auto-push (OS scheduler)
  --auto hooks       Enable auto-push via Claude Code hook
  --auto --time HH:MM  Set auto-push time (default: 21:00)
  --no-auto          Disable auto-push
  --debug            Print extra diagnostic detail (also: STRAUDE_DEBUG=1)

Examples:
  npx straude@latest
  straude --auto
  straude --auto hooks
  straude --auto --time 14:30
  straude --no-auto
  straude auto
  straude auto logs
  straude --days 3
  straude status
`.trim();

function parseArgs(args: string[]): { command: string | null; subcommand: string | null; options: Record<string, string | boolean> } {
  const options: Record<string, string | boolean> = {};
  let command: string | null = null;
  let subcommand: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--auto") {
      options.auto = true;
      // Peek at next arg for mechanism (e.g., "hooks")
      if (i + 1 < args.length && args[i + 1] === "hooks") {
        options.autoMechanism = args[++i]!;
      }
    } else if (arg === "--no-auto") {
      options.noAuto = true;
    } else if (arg === "--time" && i + 1 < args.length) {
      options.time = args[++i]!;
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
    } else if (arg === "--debug") {
      options.debug = true;
    } else if (!arg.startsWith("-") && !command) {
      command = arg;
    } else if (!arg.startsWith("-") && command && !subcommand) {
      subcommand = arg;
    }
  }

  return { command, subcommand, options };
}

function parseTimeout(value: string): number {
  const seconds = parseInt(value, 10);
  if (isNaN(seconds) || seconds <= 0) {
    console.error(`Invalid --timeout value: ${value} (must be a positive integer)`);
    process.exit(1);
  }
  return seconds * 1000;
}

let activeCommand: string | null = null;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, subcommand, options } = parseArgs(args);
  activeCommand = command;

  if (options.debug) {
    setDebug(true);
  }

  // Activation telemetry: fire `cli_first_run` once per machine. Done before
  // the help/version short-circuits so `npx straude --help` still counts as
  // installation — that's the canonical "user tried straude" signal.
  if (isFirstRun()) {
    markFirstRun();
    posthog.capture({
      distinctId: getDistinctId(null),
      event: "cli_first_run",
      properties: {
        platform: process.platform,
        node_version: process.version,
        command: command ?? "push",
      },
    });
  }

  if (options.version) {
    console.log(`straude v${CLI_VERSION}`);
    return;
  }

  if (options.help || command === "help") {
    console.log(HELP);
    return;
  }

  // `cli_authenticated` fires whenever a stored config is loaded for a real
  // command run (not --help/--version). Pairs with `cli_first_run` and
  // `usage_pushed` to power the activation funnel.
  const existingConfig = loadConfig();
  if (existingConfig) {
    posthog.capture({
      distinctId: getDistinctId(existingConfig),
      event: "cli_authenticated",
      properties: {
        command: command ?? "push",
      },
    });
  }

  const apiUrl = options.apiUrl as string | undefined;

  if (!command || command === "push") {
    await pushCommand(
      {
        date: options.date as string | undefined,
        days: options.days ? parseInt(options.days as string, 10) : undefined,
        dryRun: options.dryRun === true,
        timeoutMs: options.timeout ? parseTimeout(options.timeout as string) : undefined,
      },
      apiUrl,
    );

    // Handle --auto / --no-auto after successful push
    if (options.auto) {
      const config = loadConfig();
      if (config) {
        enableAutoPush(config, options.time as string | undefined, options.autoMechanism as string | undefined);
      }
    } else if (options.noAuto) {
      const config = loadConfig();
      if (config) {
        disableAutoPush(config);
      }
    }
    return;
  }

  switch (command) {
    case "login":
      await loginCommand(apiUrl);
      break;
    case "status":
      await statusCommand();
      break;
    case "auto":
      autoCommand(subcommand);
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

let exitCode = 0;

main()
  .catch((err: unknown) => {
    exitCode = 1;
    const config = loadConfig();
    if (isPushInvocation(activeCommand)) {
      reportUsagePushFailed(config, err, {
        command: activeCommand ?? "push",
        stage: "command",
      });
    } else {
      reportCliException(config, err, {
        command: activeCommand ?? "unknown",
      });
    }
    console.error(`Error: ${errorMessage(err)}`);
  })
  .finally(() => posthog._shutdown().then(() => process.exit(exitCode)));
