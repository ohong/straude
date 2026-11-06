import { describe, expect, it } from "vitest";
import { buildWorkspaceReport, weekBounds, workspaceReportCsv, type WorkspaceReportInput } from "@/lib/workspace-report";
import type { AgentUsageComponent } from "@straude/shared/usage-protocol";

const now = new Date("2026-11-06T12:00:00Z");
const agent = (cost: number, model = "fictional-model"): AgentUsageComponent => ({
  agent: "claude", models: [model], input_tokens: 100, output_tokens: 0, reasoning_output_tokens: 0,
  cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 100, cost_usd: cost,
  model_breakdown: [{ model, input_tokens: 100, output_tokens: 0, reasoning_output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 100, cost_usd: cost }],
});
function fixture(): WorkspaceReportInput {
  return {
    workspace: { id: "example", name: "Fictional workspace" },
    members: ["a", "b", "c", "d"].map(user_id => ({ user_id, removed_at: null })),
    sources: ["a", "b", "c"].map(id => ({ id, user_id: id, start_date: "2026-10-01", first_sync_at: id === "c" ? null : "2026-10-26T12:00:00Z", last_received_at: id === "c" ? null : id === "b" ? "2026-11-01T12:00:00Z" : now.toISOString(), latest_usage_date: id === "a" ? "2026-11-06" : id === "b" ? "2026-11-01" : null, revoked_at: null })),
    days: [
      { source_id: "a", user_id: "a", date: "2026-10-26", agents: [agent(10)] },
      { source_id: "a", user_id: "a", date: "2026-11-02", agents: [agent(15)] },
      { source_id: "b", user_id: "b", date: "2026-11-02", agents: [agent(40)] },
      { source_id: "b", user_id: "b", date: "2026-11-03", agents: [] },
      // A full previous Sunday must not leak into a Monday-Friday comparison.
      { source_id: "a", user_id: "a", date: "2026-11-01", agents: [agent(100)] },
    ],
  };
}
describe("private weekly accounting", () => {
  it("keeps participation growth separate from same-contributor change and matches CSV values", () => {
    const report = buildWorkspaceReport(fixture(), null, now);
    expect(report.current.estimated_value_usd).toBe(55);
    expect(report.previous.estimated_value_usd).toBe(10);
    expect(report.same_contributors.delta_estimated_value_usd).toBe(5);
    expect(report.contributors).toEqual({ current: 2, previous: 1, common: 1, new: 1, absent: 0 });
    expect(report.tools[0]!.current.estimated_value_usd).toBe(55);
    expect(report.models[0]!.current.estimated_value_usd).toBe(55);
    const csv = workspaceReportCsv(report);
    expect(csv).toContain('"total","estimated_value","","","55","10"');
    expect(csv).toContain('"same_contributors","estimated_value","","","15","10"');
  });
  it("counts recorded zero as received but distinguishes missing, stale, and unconnected sources", () => {
    const report = buildWorkspaceReport(fixture(), null, now);
    expect(report.coverage.current).toEqual({ received_source_days: 3, expected_source_days: 15 });
    expect(report.coverage.stale_sources).toBe(1);
    expect(report.coverage.never_synced_sources).toBe(1);
    expect(report.coverage.unconnected_members).toBe(1);
    const backfill = fixture();
    backfill.sources[1]!.last_received_at = now.toISOString();
    expect(buildWorkspaceReport(backfill, null, now).coverage.stale_sources).toBe(1);
    const empty = fixture();
    empty.days = [{ source_id: "a", user_id: "a", date: "2026-11-02", agents: [] }];
    const zero = buildWorkspaceReport(empty, null, now);
    expect(zero.contributors.current).toBe(1);
    expect(zero.current.tokens).toBe(0);
  });
  it("retains removed contributions and only expects coverage after enrollment until removal", () => {
    const data = fixture();
    data.sources[1]!.start_date = "2026-11-02";
    data.sources[1]!.revoked_at = "2026-11-03T10:00:00Z";
    data.members[1]!.removed_at = "2026-11-03T10:00:00Z";
    const report = buildWorkspaceReport(data, null, now);
    expect(report.current.estimated_value_usd).toBe(55);
    expect(report.coverage.current.expected_source_days).toBe(12);
    expect(report.coverage.active_members).toBe(3);
  });
  it("uses valid UTC Mondays and elapsed calendar days across month boundaries", () => {
    expect(weekBounds(null, new Date("2026-11-02T00:01:00Z"))).toMatchObject({ start: "2026-11-02", through: "2026-11-02", previous_start: "2026-10-26", previous_through: "2026-10-26", incomplete: true });
    expect(weekBounds("2026-10-26", now)).toMatchObject({ through: "2026-11-01", incomplete: false });
    for (const invalid of ["2026-11-03", "2026-11-09", "2026-02-30", "bad"]) expect(() => weekBounds(invalid, now)).toThrow();
  });
  it("escapes formula-like collector model names in exported spreadsheets", () => {
    const data = fixture();
    data.days[1]!.agents = [agent(15, '=HYPERLINK("https://example.invalid")')];
    const csv = workspaceReportCsv(buildWorkspaceReport(data, null, now));
    expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"")"');
  });
});
