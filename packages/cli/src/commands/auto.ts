import { loadConfig, saveConfig } from "../lib/auth.js";
import type { StraudeConfig } from "../lib/auth.js";
import {
  detectScheduler,
  installScheduler,
  uninstallScheduler,
  isSchedulerInstalled,
} from "../lib/scheduler.js";
import {
  installClaudeCodeHook,
  uninstallClaudeCodeHook,
  isClaudeCodeHookInstalled,
} from "../lib/hooks.js";
import { readLog } from "../lib/auto-push-logger.js";
import { AUTO_PUSH_DEFAULT_TIME, AUTO_PUSH_LOG_FILE, LAUNCHD_PLIST_PATH } from "../config.js";

function schedulerDescription(scheduler: "launchd" | "cron"): string {
  if (scheduler === "launchd") {
    return `launchd (${LAUNCHD_PLIST_PATH.replace(process.env.HOME ?? "", "~")})`;
  }
  return "cron (crontab)";
}

function disableExisting(config: StraudeConfig): void {
  if (!config.auto_push?.enabled) return;
  const mechanism = config.auto_push.mechanism ?? "scheduler";
  if (mechanism === "hooks") {
    uninstallClaudeCodeHook();
  } else {
    uninstallScheduler(config.auto_push.scheduler);
  }
}

export function enableAutoPush(
  config: StraudeConfig,
  time?: string,
  mechanism?: string,
): void {
  const resolvedMechanism = mechanism === "hooks" ? "hooks" : "scheduler";

  if (resolvedMechanism === "hooks") {
    // Disable existing (scheduler or hooks) before switching
    disableExisting(config);

    installClaudeCodeHook();

    config.auto_push = {
      enabled: true,
      time: time ?? AUTO_PUSH_DEFAULT_TIME,
      scheduler: detectScheduler(), // stored but not used for hooks
      mechanism: "hooks",
    };
    saveConfig(config);

    console.log("\nAuto-push enabled — your stats will sync after each Claude Code session.");
    console.log("Mechanism: Claude Code SessionEnd hook (~/.claude/settings.json)");
    return;
  }

  // Scheduler mechanism (default)
  const resolvedTime = time ?? AUTO_PUSH_DEFAULT_TIME;

  if (process.platform === "win32") {
    console.error("Auto-push is not supported on Windows.");
    process.exit(1);
  }

  const scheduler = detectScheduler();

  // Disable existing (scheduler or hooks) before switching
  disableExisting(config);

  installScheduler(resolvedTime, scheduler);

  config.auto_push = { enabled: true, time: resolvedTime, scheduler, mechanism: "scheduler" };
  saveConfig(config);

  const logPath = AUTO_PUSH_LOG_FILE.replace(process.env.HOME ?? "", "~");
  console.log(`\nAuto-push enabled — your stats will sync daily at ${resolvedTime}.`);
  console.log(`Mechanism: ${schedulerDescription(scheduler)}`);
  console.log(`Log file:  ${logPath}`);
}

export function disableAutoPush(config: StraudeConfig): void {
  if (!config.auto_push?.enabled) {
    console.log("\nAuto-push is not enabled.");
    return;
  }

  disableExisting(config);

  delete config.auto_push;
  saveConfig(config);

  console.log("\nAuto-push disabled.");
}

export function autoCommand(subcommand: string | null): void {
  if (subcommand === "logs") {
    const lines = readLog(50);
    if (lines.length === 0) {
      console.log("No auto-push logs yet.");
      return;
    }
    for (const line of lines) {
      console.log(line);
    }
    return;
  }

  // Default: show status
  const config = loadConfig();
  if (!config) {
    console.log("Auto-push: disabled (not logged in)");
    console.log('Run `straude --auto` to sync your stats daily.');
    return;
  }

  if (config.auto_push?.enabled) {
    const mechanism = config.auto_push.mechanism ?? "scheduler";

    console.log("Auto-push: enabled");

    if (mechanism === "hooks") {
      const installed = isClaudeCodeHookInstalled();
      console.log("  Mechanism: Claude Code SessionEnd hook");
      console.log(`  Status:    ${installed ? "hook installed" : "hook not found — run straude --auto hooks to reinstall"}`);
    } else {
      const scheduler = config.auto_push.scheduler;
      const installed = isSchedulerInstalled(scheduler);
      const logPath = AUTO_PUSH_LOG_FILE.replace(process.env.HOME ?? "", "~");

      console.log(`  Mechanism: ${schedulerDescription(scheduler)}`);
      console.log(`  Schedule:  daily at ${config.auto_push.time}`);
      console.log(`  Status:    ${installed ? "scheduler installed" : "not found — run straude --auto to reinstall"}`);
      console.log(`  Log file:  ${logPath}`);
    }
  } else {
    console.log("Auto-push: disabled");
    console.log('Run `straude --auto` to sync your stats daily.');
  }
}
