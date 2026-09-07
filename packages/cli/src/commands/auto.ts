import { loadConfig, updateConfig } from "../lib/auth.js";
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
import { posthog } from "../lib/posthog.js";
import { getDistinctId } from "../lib/machine-id.js";

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

function installConfiguredAutoPush(autoPush: NonNullable<StraudeConfig["auto_push"]>): void {
  const mechanism = autoPush.mechanism ?? "scheduler";
  if (mechanism === "hooks") installClaudeCodeHook();
  else installScheduler(autoPush.time, autoPush.scheduler);
}

function uninstallConfiguredAutoPush(autoPush: NonNullable<StraudeConfig["auto_push"]>): void {
  const mechanism = autoPush.mechanism ?? "scheduler";
  if (mechanism === "hooks") uninstallClaudeCodeHook();
  else uninstallScheduler(autoPush.scheduler);
}

function persistAutoPush(
  fallback: StraudeConfig,
  autoPush: StraudeConfig["auto_push"],
): StraudeConfig {
  return updateConfig((current) => {
    const next = { ...(current ?? fallback) };
    if (autoPush) next.auto_push = autoPush;
    else delete next.auto_push;
    return next;
  });
}

function rollbackAutoPush(
  attempted: StraudeConfig["auto_push"],
  previous: StraudeConfig["auto_push"],
): void {
  if (attempted) {
    try {
      uninstallConfiguredAutoPush(attempted);
    } catch {
      // Continue restoring the previous mechanism.
    }
  }
  if (previous?.enabled) installConfiguredAutoPush(previous);
}

export function enableAutoPush(
  config: StraudeConfig,
  time?: string,
  mechanism?: string,
): void {
  const resolvedMechanism = mechanism === "hooks" ? "hooks" : "scheduler";

  if (resolvedMechanism === "hooks") {
    const previous = config.auto_push;
    disableExisting(config);

    const next = {
      enabled: true,
      time: time ?? AUTO_PUSH_DEFAULT_TIME,
      scheduler: detectScheduler(), // stored but not used for hooks
      mechanism: "hooks",
    } satisfies NonNullable<StraudeConfig["auto_push"]>;
    try {
      installClaudeCodeHook();
      persistAutoPush(config, next);
      config.auto_push = next;
    } catch (error) {
      rollbackAutoPush(next, previous);
      throw error;
    }

    posthog.capture({
      distinctId: getDistinctId(config),
      event: "auto_push_enabled",
      properties: { mechanism: "hooks" },
    });

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

  const previous = config.auto_push;
  disableExisting(config);

  const next = {
    enabled: true,
    time: resolvedTime,
    scheduler,
    mechanism: "scheduler",
  } satisfies NonNullable<StraudeConfig["auto_push"]>;
  try {
    installScheduler(resolvedTime, scheduler);
    persistAutoPush(config, next);
    config.auto_push = next;
  } catch (error) {
    rollbackAutoPush(next, previous);
    throw error;
  }

  posthog.capture({
    distinctId: getDistinctId(config),
    event: "auto_push_enabled",
    properties: { mechanism: "scheduler", scheduler, time: resolvedTime },
  });

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

  const previous = config.auto_push;
  disableExisting(config);
  try {
    persistAutoPush(config, undefined);
    delete config.auto_push;
  } catch (error) {
    if (previous) installConfiguredAutoPush(previous);
    throw error;
  }

  posthog.capture({
    distinctId: getDistinctId(config),
    event: "auto_push_disabled",
    properties: {},
  });

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
