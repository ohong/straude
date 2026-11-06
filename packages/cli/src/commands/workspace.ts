import { disableAutoPush } from "./auto.js";
import { isClaudeCodeHookInstalled, uninstallClaudeCodeHook } from "../lib/hooks.js";
import { detectScheduler, isSchedulerInstalled, uninstallScheduler } from "../lib/scheduler.js";
import { hostname } from "node:os";
import { MAX_BACKFILL_DAYS } from "../config.js";
import { apiRequest, ApiHttpError } from "../lib/api.js";
import { loadConfig, type StraudeConfig } from "../lib/auth.js";
import { addCalendarDays, assertCalendarDate, calendarDaysBetween, compactCalendarDate, listCalendarDates } from "../lib/calendar.js";
import { collectCcusageUsageAsync } from "../lib/ccusage.js";
import { getInstallationId } from "../lib/machine-id.js";
import { syncAccountKey } from "../lib/sync-account.js";
import { acquireSyncLease } from "../lib/sync-state.js";
import { toWireAgent } from "../lib/usage-agent.js";
import { assertWorkspaceAccount, loadWorkspaceSource, saveWorkspaceSource, type WorkspaceSource } from "../lib/workspace-source.js";
import type { PushOptions } from "./push.js";

interface SourceResponse {
  id: string;
  workspace_id: string;
  installation_id: string;
  start_date: string;
  first_sync_at: string | null;
  last_received_at: string | null;
  revoked_at: string | null;
}

const PRIVACY_PREVIEW = `Private work-only sharing
Workspace members and admins can see contributed daily tool/model totals, tokens,
and estimated value at API prices, plus source setup and sync status. Admins can
manage membership. Contributions remain in workspace totals after removal.
Prompts and code are not uploaded. No work data is published to profiles, feeds,
recaps or leaderboards by this connection. Personal history is not imported.
Daily aggregates cannot separate accounts on a mixed device. Use an exclusively
work-only device or OS account. Sharing begins next UTC day, including all usage
from that day onward. Keep personal activity on a different OS account/device.`;

function authenticatedConfig(apiUrl?: string): StraudeConfig {
  const config = loadConfig();
  if (!config) throw new Error("Run `straude login` before connecting a work-only source.");
  return apiUrl ? { ...config, api_url: apiUrl } : config;
}

export async function workspaceConnect(workspaceId: string, workOnly: boolean, apiUrl?: string): Promise<void> {
  console.log(PRIVACY_PREVIEW);
  if (!workOnly) throw new Error("Read the sharing preview, then repeat with --work-only to confirm this source contains work activity only. No usage was collected.");
  const config = authenticatedConfig(apiUrl);
  const lease = await acquireSyncLease({ dates: [], interactive: true });
  if (!lease) throw new Error("Another sync is running. Wait for it to finish, then reconnect.");
  try {
    let routing = loadWorkspaceSource();
    if (routing) {
      assertWorkspaceAccount(routing, config);
      if (routing.workspace_id !== workspaceId) throw new Error("This source already belongs to a different private workspace. Use a separate work-only OS account; this connection remains private.");
    } else {
      routing = { version: 1, workspace_id: workspaceId, installation_id: getInstallationId(), account_key: syncAccountKey(config), api_url: config.api_url };
      // Write the fail-closed destination BEFORE a request that could succeed
      // remotely but fail locally. Enrollment retry uses the same installation.
      saveWorkspaceSource(routing);
    }
    // Previously installed automation may invoke an older public-only CLI.
    // Stop it before enrolling; the user can enable this installed build again.
    uninstallClaudeCodeHook();
    if (isClaudeCodeHookInstalled()) throw new Error("Could not stop the previous Straude hook. Disable it before reconnecting.");
    if (process.platform !== "win32") {
      const scheduler = detectScheduler();
      uninstallScheduler(scheduler);
      if (isSchedulerInstalled(scheduler)) throw new Error("Could not stop the previous Straude scheduler. Disable it before reconnecting.");
    }
    if (config.auto_push?.enabled) disableAutoPush(config);
    const { source } = await apiRequest<{ source: SourceResponse }>(config, `/api/workspaces/${workspaceId}/sources`, {
      method: "POST",
      body: JSON.stringify({ installation_id: routing.installation_id, name: config.device_name ?? hostname(), work_only: true }),
    });
    if (source.workspace_id !== workspaceId || source.installation_id !== routing.installation_id || source.revoked_at) {
      throw new Error("The server did not confirm this source. Private routing remains enabled; retry the connection.");
    }
    assertCalendarDate(source.start_date);
    saveWorkspaceSource({ ...routing, source_id: source.id, start_date: source.start_date });
    console.log(`\nWork-only source connected. Sharing starts ${source.start_date} at 00:00 UTC.`);
    console.log("Run `straude` on or after that date to confirm your first sync. Run `straude workspace status` to check receipt.");
    console.log("Previous automatic sync was disabled to avoid running an older public-only CLI. From this installed CLI, run `straude --auto` to enable private automatic sync; check `straude auto` for observed status.");
  } finally {
    lease.release();
  }
}

export function workspaceDateRange(source: WorkspaceSource, options: Pick<PushOptions, "date" | "days">, today = new Date().toISOString().slice(0, 10)): string[] {
  if (!source.start_date || !source.source_id) throw new Error(`Enrollment is incomplete. Retry: straude workspace connect ${source.workspace_id} --work-only`);
  assertCalendarDate(today);
  if (options.date) {
    const date = assertCalendarDate(options.date);
    if (date < source.start_date) throw new Error(`Work sharing starts ${source.start_date}; earlier personal history cannot be submitted.`);
    if (date > today || calendarDaysBetween(date, today) > MAX_BACKFILL_DAYS) throw new Error("Select a date within the last 30 days, not in the future.");
    return [date];
  }
  const days = options.days ?? MAX_BACKFILL_DAYS;
  if (!Number.isInteger(days) || days < 1 || days > MAX_BACKFILL_DAYS) throw new Error("Days must be between 1 and 30.");
  if (source.start_date > today) return [];
  const since = [source.start_date, addCalendarDays(today, 1 - days)].sort().at(-1)!;
  return listCalendarDates(since, today);
}

export async function workspacePush(config: StraudeConfig, options: PushOptions): Promise<number> {
  const routing = loadWorkspaceSource();
  if (!routing) throw new Error("Private workspace routing is unavailable. Reconnect before syncing.");
  assertWorkspaceAccount(routing, config);
  const dates = workspaceDateRange(routing, options);
  if (dates.length === 0) {
    console.log(`Work-only sharing starts ${routing.start_date} at 00:00 UTC. No usage was collected; run straude on or after that date.`);
    return 0;
  }
  const lease = await acquireSyncLease({ dates: [], interactive: !options.nonInteractive });
  if (!lease) {
    console.error("A sync is already running. Retry `straude` after it finishes.");
    return 75;
  }
  try {
    console.log(`Private workspace ${routing.workspace_id}: collecting ${dates[0]} to ${dates.at(-1)} (UTC).`);
    const collected = await collectCcusageUsageAsync(compactCalendarDate(dates[0]!), compactCalendarDate(dates.at(-1)!), options.timeoutMs, { timezone: "UTC", pricingMode: "online" });
    if (collected.data.some((day) => !dates.includes(day.date))) throw new Error("Collector returned dates outside the consented range. Nothing was shared.");
    const entries = dates.map((date) => ({ date, agents: collected.data.find((day) => day.date === date)?.agentBreakdown.map(toWireAgent) ?? [] }));
    if (options.dryRun) {
      console.log(JSON.stringify({ workspace_id: routing.workspace_id, timezone: "UTC", entries }, null, 2));
      return 0;
    }
    const result = await apiRequest<{ accepted_days: number; last_received_at: string }>(config, `/api/workspaces/${routing.workspace_id}/sync`, {
      method: "POST",
      maxRetries: 2,
      body: JSON.stringify({ source_id: routing.source_id, installation_id: routing.installation_id, timezone: "UTC", entries }),
    });
    if (result.accepted_days !== entries.length || !Number.isFinite(Date.parse(result.last_received_at))) {
      throw new Error("Server receipt did not confirm every date. Retry `straude`; already accepted dates are counted once.");
    }
    console.log(`Workspace received ${result.accepted_days} daily snapshots at ${result.last_received_at}. Empty dates confirm zero recorded usage; today's snapshot is partial.`);
    console.log(`${config.api_url}/workspaces/${routing.workspace_id}`);
    return 0;
  } catch (error) {
    console.error(`Private sync failed: ${(error as Error).message}`);
    console.error(error instanceof ApiHttpError && error.status === 401
      ? "Run `straude login` with the same account, then `straude`. Private routing remains enabled."
      : "Retry `straude`. If workspace access was removed, ask its owner. Private routing remains enabled; nothing falls back to public sharing.");
    return error instanceof ApiHttpError && error.status === 401 ? 2 : 1;
  } finally {
    lease.release();
  }
}

export async function workspaceStatus(): Promise<void> {
  const routing = loadWorkspaceSource();
  if (!routing) {
    console.log("No private workspace source is connected. Personal sync is selected. Run `straude workspace connect <workspace-id>` for the sharing preview.");
    return;
  }
  console.log(`Private workspace: ${routing.workspace_id}\nSharing starts: ${routing.start_date ?? "enrollment incomplete"} (UTC)`);
  const config = authenticatedConfig();
  assertWorkspaceAccount(routing, config);
  if (!routing.source_id) throw new Error(`Retry: straude workspace connect ${routing.workspace_id} --work-only`);
  const detail = await apiRequest<{ sources: SourceResponse[] }>(config, `/api/workspaces/${routing.workspace_id}`);
  const source = detail.sources.find((candidate) => candidate.id === routing.source_id);
  if (!source || source.revoked_at) throw new Error("This source is no longer active. Contact the workspace owner; private routing remains enabled.");
  console.log(`First sync: ${source.first_sync_at ?? "no data received"}\nLast received: ${source.last_received_at ?? "no data received"}`);
  console.log("Run `straude` to sync. Run `straude auto` to inspect automatic sync setup.");
}
