import type { AgentUsageComponent } from "@straude/shared/usage-protocol";

export interface ReportSource {
  id: string; user_id: string; start_date: string;
  first_sync_at: string | null; last_received_at: string | null; revoked_at: string | null;
}
export interface ReportDay {
  source_id: string; user_id: string; date: string; agents: AgentUsageComponent[];
}
export interface WorkspaceReportInput {
  workspace: { id: string; name: string };
  members: { user_id: string; removed_at: string | null }[];
  sources: ReportSource[];
  days: ReportDay[];
}
const DAY = 86_400_000;
export const shiftDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export function weekBounds(week: string | null, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const monday = shiftDate(today, -((now.getUTCDay() + 6) % 7));
  const start = week ?? monday;
  const parsed = new Date(`${start}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== start || parsed.getUTCDay() !== 1 || start > monday) {
    throw new Error("Choose a Monday on or before the current week (UTC).");
  }
  const end = shiftDate(start, 6);
  const through = end < today ? end : today;
  return { start, end, through, previous_start: shiftDate(start, -7), previous_through: shiftDate(through, -7), incomplete: end >= today };
}
const emptyTotal = () => ({ estimated_value_usd: 0, tokens: 0 });
type Total = ReturnType<typeof emptyTotal>;
const add = (total: Total, cost: number, tokens: number) => {
  total.estimated_value_usd += Number(cost);
  total.tokens += Number(tokens);
};

export function buildWorkspaceReport(input: WorkspaceReportInput, week: string | null, now = new Date()) {
  const period = weekBounds(week, now);
  const currentDays = input.days.filter(d => d.date >= period.start && d.date <= period.through);
  const previousDays = input.days.filter(d => d.date >= period.previous_start && d.date <= period.previous_through);
  const currentPeople = new Set(currentDays.map(d => d.user_id));
  const previousPeople = new Set(previousDays.map(d => d.user_id));
  const common = new Set([...currentPeople].filter(id => previousPeople.has(id)));
  const current = emptyTotal(), previous = emptyTotal(), commonCurrent = emptyTotal(), commonPrevious = emptyTotal();
  const drivers = new Map<string, { tool: string; model: string; current: Total; previous: Total }>();
  const tools = new Map<string, { tool: string; current: Total; previous: Total }>();
  for (const [days, side, total, commonTotal] of [
    [currentDays, "current", current, commonCurrent], [previousDays, "previous", previous, commonPrevious],
  ] as const) {
    for (const day of days) for (const agent of day.agents) {
      add(total, agent.cost_usd, agent.total_tokens);
      if (common.has(day.user_id)) add(commonTotal, agent.cost_usd, agent.total_tokens);
      const tool = tools.get(agent.agent) ?? { tool: agent.agent, current: emptyTotal(), previous: emptyTotal() };
      add(tool[side], agent.cost_usd, agent.total_tokens);
      tools.set(agent.agent, tool);
      for (const model of agent.model_breakdown) {
        const key = JSON.stringify([agent.agent, model.model]);
        const driver = drivers.get(key) ?? { tool: agent.agent, model: model.model, current: emptyTotal(), previous: emptyTotal() };
        add(driver[side], model.cost_usd, model.total_tokens);
        drivers.set(key, driver);
      }
      // Older collectors may not attribute all usage to models. Keep that gap visible.
      const attributedCost = agent.model_breakdown.reduce((n, m) => n + Number(m.cost_usd), 0);
      const attributedTokens = agent.model_breakdown.reduce((n, m) => n + Number(m.total_tokens), 0);
      if (agent.total_tokens > attributedTokens || agent.cost_usd > attributedCost + 0.000001) {
        const key = JSON.stringify([agent.agent, null]);
        const driver = drivers.get(key) ?? { tool: agent.agent, model: "Unattributed", current: emptyTotal(), previous: emptyTotal() };
        add(driver[side], Math.max(0, agent.cost_usd - attributedCost), Math.max(0, agent.total_tokens - attributedTokens));
        drivers.set(key, driver);
      }
    }
  }
  function coverage(start: string, through: string, days: ReportDay[]) {
    let expected = 0;
    const received = new Set(days.map(d => `${d.source_id}:${d.date}`));
    for (const source of input.sources) {
      for (let date = start; date <= through; date = shiftDate(date, 1)) {
        if (date >= source.start_date && (!source.revoked_at || date <= source.revoked_at.slice(0, 10))) expected++;
      }
    }
    return { received_source_days: received.size, expected_source_days: expected };
  }
  const activeSources = input.sources.filter(s => !s.revoked_at);
  const activeMembers = input.members.filter(m => !m.removed_at);
  return {
    workspace: input.workspace, generated_at: now.toISOString(), period,
    current, previous, delta_estimated_value_usd: current.estimated_value_usd - previous.estimated_value_usd,
    contributors: { current: currentPeople.size, previous: previousPeople.size, common: common.size,
      new: [...currentPeople].filter(id => !previousPeople.has(id)).length,
      absent: [...previousPeople].filter(id => !currentPeople.has(id)).length },
    same_contributors: { current: commonCurrent, previous: commonPrevious,
      delta_estimated_value_usd: commonCurrent.estimated_value_usd - commonPrevious.estimated_value_usd },
    coverage: { current: coverage(period.start, period.through, currentDays),
      previous: coverage(period.previous_start, period.previous_through, previousDays),
      active_members: activeMembers.length,
      unconnected_members: activeMembers.filter(m => !activeSources.some(s => s.user_id === m.user_id)).length,
      never_synced_sources: activeSources.filter(s => !s.last_received_at).length,
      stale_sources: activeSources.filter(s => s.last_received_at && now.getTime() - Date.parse(s.last_received_at) > 2 * DAY).length },
    tools: [...tools.values()].sort((a, b) => b.current.estimated_value_usd - a.current.estimated_value_usd),
    models: [...drivers.values()].sort((a, b) => b.current.estimated_value_usd - a.current.estimated_value_usd),
  };
}
export type WorkspaceReport = ReturnType<typeof buildWorkspaceReport>;

export function workspaceReportCsv(report: WorkspaceReport): string {
  const rows: (string | number)[][] = [
    ["section", "metric", "tool", "model", "current", "previous", "unit"],
    ["period", "start", "", "", report.period.start, report.period.previous_start, "UTC date"],
    ["period", "through", "", "", report.period.through, report.period.previous_through, "UTC date"],
    ["period", "incomplete_week", "", "", String(report.period.incomplete), "", "boolean"],
    ["metadata", "generated_at", "", "", report.generated_at, "", "UTC timestamp"],
    ["total", "estimated_value", "", "", report.current.estimated_value_usd, report.previous.estimated_value_usd, "estimated value USD at API prices; actual billed charges unknown"],
    ["total", "tokens", "", "", report.current.tokens, report.previous.tokens, "tokens"],
    ["participation", "contributors", "", "", report.contributors.current, report.contributors.previous, "people with received days, including zero usage"],
    ["participation", "new_contributors", "", "", report.contributors.new, "", "people"],
    ["participation", "absent_contributors", "", "", report.contributors.absent, "", "people"],
    ["participation", "common_contributors", "", "", report.contributors.common, report.contributors.common, "people"],
    ["same_contributors", "estimated_value", "", "", report.same_contributors.current.estimated_value_usd, report.same_contributors.previous.estimated_value_usd, "estimated value USD at API prices; actual billed charges unknown"],
    ["coverage", "received_source_days", "", "", report.coverage.current.received_source_days, report.coverage.previous.received_source_days, "source days"],
    ["coverage", "expected_source_days", "", "", report.coverage.current.expected_source_days, report.coverage.previous.expected_source_days, "source days"],
    ...(["active_members", "unconnected_members", "never_synced_sources", "stale_sources"] as const).map(key => ["setup_now", key, "", "", report.coverage[key], "", "count"]),
  ];
  for (const [section, entries] of [["tool", report.tools], ["model", report.models]] as const) {
    for (const entry of entries) {
      rows.push([section, "estimated_value", entry.tool, "model" in entry ? entry.model : "", entry.current.estimated_value_usd, entry.previous.estimated_value_usd, "estimated value USD at API prices; actual billed charges unknown"]);
      rows.push([section, "tokens", entry.tool, "model" in entry ? entry.model : "", entry.current.tokens, entry.previous.tokens, "tokens"]);
    }
  }
  return rows.map(row => row.map(value => {
    // Quoting alone does not prevent formula execution in spreadsheet applications.
    const string = String(value);
    const safe = typeof value === "string" && /^[=+@\-\t\r]/.test(string) ? `'${string}` : string;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n") + "\r\n";
}
