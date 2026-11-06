"use client";

import { useEffect, useState } from "react";
import type { WorkspaceReport } from "@/lib/workspace-report";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const number = (value: number) => new Intl.NumberFormat("en-US").format(value);
const delta = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;

export default function WeeklyWorkspaceReport({ workspaceId }: { workspaceId: string }) {
  const [week, setWeek] = useState("");
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/report`;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setReport(null);
    fetch(`${endpoint}${week ? `?week=${encodeURIComponent(week)}` : ""}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load the weekly report.");
        setReport(body);
      }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, week, refresh]);
  return <section aria-labelledby="weekly-report-heading" className="space-y-5 border-t border-border pt-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-mono uppercase tracking-wider text-muted">Private workspace</p>
        <h2 id="weekly-report-heading" className="text-2xl font-semibold">Weekly review</h2></div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm" htmlFor="report-week">Week starting Monday (UTC)
          <input id="report-week" type="date" value={week} onChange={e => setWeek(e.target.value)} className="rounded border border-border bg-background p-2 text-foreground" /></label>
        <button type="button" onClick={() => setRefresh(n => n + 1)} className="rounded border border-border px-3 py-2 text-sm">Refresh report</button>
        {report && <a href={`${endpoint}?week=${report.period.start}&format=csv`} className="rounded bg-accent px-3 py-2 text-sm text-accent-foreground">Export CSV</a>}
      </div>
    </div>
    {loading && <p role="status">Loading weekly report…</p>}
    {error && <p role="alert" className="text-sm">{error} Try refreshing, or ask the workspace owner to check your membership.</p>}
    {report && <>
      <div className="space-y-1 text-sm text-muted">
        <p>{report.period.start}–{report.period.through} UTC compared with {report.period.previous_start}–{report.period.previous_through} UTC.</p>
        {report.period.incomplete && <p>Incomplete week: today is still in progress. The previous period covers the same calendar days, including a full day for its last date.</p>}
        <p>Dollar figures are estimated value at API prices. Actual billed charges are unknown. Usage is not a measure of employee productivity.</p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-border p-4"><dt className="text-sm text-muted">Estimated value at API prices</dt><dd className="text-3xl font-semibold tabular-nums">{money(report.current.estimated_value_usd)}</dd><dd className="text-sm">{delta(report.delta_estimated_value_usd)} vs prior period ({money(report.previous.estimated_value_usd)})</dd></div>
        <div className="rounded border border-border p-4"><dt className="text-sm text-muted">People with data received</dt><dd className="text-3xl font-semibold tabular-nums">{report.contributors.current}</dd><dd className="text-sm">Previously {report.contributors.previous}; includes confirmed zero usage</dd></div>
        <div className="rounded border border-border p-4"><dt className="text-sm text-muted">Source days received</dt><dd className="text-3xl font-semibold tabular-nums">{report.coverage.current.received_source_days} / {report.coverage.current.expected_source_days}</dd><dd className="text-sm">Previously {report.coverage.previous.received_source_days} / {report.coverage.previous.expected_source_days}</dd></div>
      </dl>
      {report.contributors.current === 0 && <p className="rounded border border-border p-4">No data received for this period. This does not mean zero usage. Connect a work-only source and run Straude after its sharing start date.</p>}
      <div className="space-y-2 text-sm">
        <h3 className="text-lg font-semibold">Separate participation from usage changes</h3>
        <p>{report.contributors.new} contributors are new to this comparison; {report.contributors.absent} from the prior period have no data in this period.</p>
        <p>For the {report.contributors.common} people with data in both periods: {money(report.same_contributors.current.estimated_value_usd)} vs {money(report.same_contributors.previous.estimated_value_usd)} ({delta(report.same_contributors.delta_estimated_value_usd)}). Their coverage may still differ.</p>
        <p>Total tokens: {number(report.current.tokens)}; prior period: {number(report.previous.tokens)}.</p>
      </div>
      <div className="space-y-2 text-sm">
        <h3 className="text-lg font-semibold">Coverage and setup</h3>
        <p>Current setup: {report.coverage.active_members} members, {report.coverage.unconnected_members} without an active source, {report.coverage.never_synced_sources} sources never synced, {report.coverage.stale_sources} sources last received over 48 hours ago.</p>
        <p>Coverage counts each source day from its sharing start through the selected period (including weekends). A missing day is unknown; a received day may explicitly record zero. Source freshness reflects the latest receipt now. Removed members’ past contributions remain in totals.</p>
      </div>
      {report.tools.length > 0 && <div className="space-y-4">
        <h3 className="text-lg font-semibold">What changed by tool and model</h3>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <caption className="mb-2 text-left text-muted">Estimated value at API prices (USD)</caption>
          <thead><tr className="border-b border-border"><th scope="col" className="py-2 pr-4">Tool / model</th><th scope="col" className="p-2 text-right">This period</th><th scope="col" className="p-2 text-right">Prior period</th><th scope="col" className="p-2 text-right">Change</th></tr></thead>
          <tbody>{report.tools.map(tool => <tr key={tool.tool} className="border-b border-border font-semibold"><th scope="row" className="py-2 pr-4">{tool.tool}</th><td className="p-2 text-right tabular-nums">{money(tool.current.estimated_value_usd)}</td><td className="p-2 text-right tabular-nums">{money(tool.previous.estimated_value_usd)}</td><td className="p-2 text-right tabular-nums">{delta(tool.current.estimated_value_usd - tool.previous.estimated_value_usd)}</td></tr>)}</tbody>
          <tbody>{report.models.map(model => <tr key={`${model.tool}:${model.model}`} className="border-b border-border"><th scope="row" className="py-2 pr-4 font-normal">{model.tool} / {model.model}</th><td className="p-2 text-right tabular-nums">{money(model.current.estimated_value_usd)}</td><td className="p-2 text-right tabular-nums">{money(model.previous.estimated_value_usd)}</td><td className="p-2 text-right tabular-nums">{delta(model.current.estimated_value_usd - model.previous.estimated_value_usd)}</td></tr>)}</tbody>
        </table></div>
      </div>}
    </>}
  </section>;
}
