#!/usr/bin/env node

import { loginCommand } from "./commands/login.js";
import { pushCommand } from "./commands/push.js";
import { statusCommand } from "./commands/status.js";
import { autoCommand, enableAutoPush, disableAutoPush } from "./commands/auto.js";
import { devicesCommand } from "./commands/devices.js";
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
  shutdownTelemetryWithTimeout,
} from "./lib/telemetry.js";
import {
  assertSupportedNodeRuntime,
  CliArgumentError,
  parseCliArgs,
} from "./lib/args.js";
import { setInteractiveOverride } from "./lib/prompt.js";

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
      // Preserve any failure status the main flow has already set; otherwise
      // a piped command that was already failing would report success here.
      process.exit(process.exitCode ?? 0);
    }
    throw err;
  });
}
silenceEpipe(process.stdout);
silenceEpipe(process.stderr);

const HELP = `
straude v${CLI_VERSION} — Push your AI coding-agent usage to Straude

Usage:
  straude                Sync latest stats (login if needed)
  straude <command>      Run a specific command

Commands:
  login              Authenticate with Straude via browser
  push               Push usage data to Straude
  status             Show your current stats
  auto               Show auto-push status or logs
  devices            List or resolve installation identity conflicts

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
  --non-interactive  Never open a browser or wait for login

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

let activeCommand: string | null = null;

async function main(): Promise<void> {
  assertSupportedNodeRuntime();
  const args = process.argv.slice(2);
  const { command, subcommand, operand, options } = parseCliArgs(args);
  activeCommand = command;

  if (options.nonInteractive) setInteractiveOverride(false);
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

  const apiUrl = options.apiUrl;

  if (!command || command === "push") {
    exitCode = await pushCommand(
      {
        date: options.date,
        days: options.days,
        dryRun: options.dryRun === true,
        timeoutMs: options.timeoutMs,
        nonInteractive: options.nonInteractive === true,
      },
      apiUrl,
    );
    process.exitCode = exitCode;
    if (exitCode !== 0) return;

    // Handle --auto / --no-auto after successful push
    if (options.auto) {
      const config = loadConfig();
      if (config) {
        enableAutoPush(config, options.time, options.autoMechanism);
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
    case "devices":
      exitCode = await devicesCommand(subcommand, operand);
      process.exitCode = exitCode;
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
    process.exitCode = 1;
    let config = null;
    try {
      config = loadConfig();
    } catch {
      // Preserve the original error.
    }
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
    const prefix = err instanceof CliArgumentError ? `${err.code}: ` : "Error: ";
    console.error(`${prefix}${errorMessage(err)}`);
  })
  .finally(() => shutdownTelemetryWithTimeout().then(() => process.exit(exitCode)));
