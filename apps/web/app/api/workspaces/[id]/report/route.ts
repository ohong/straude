import { NextResponse } from "next/server";
import { workspaceResponse, workspaceRpc } from "@/lib/workspaces";
import { buildWorkspaceReport, weekBounds, workspaceReportCsv, type WorkspaceReportInput } from "@/lib/workspace-report";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const week = url.searchParams.get("week");
  const now = new Date();
  let period: ReturnType<typeof weekBounds>;
  try { period = weekBounds(week, now); }
  catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  return workspaceResponse(request, async auth => {
    const data = await workspaceRpc(auth.userId, "report", id, { start: period.previous_start, end: period.through });
    const report = buildWorkspaceReport(data as unknown as WorkspaceReportInput, week, now);
    if (url.searchParams.get("format") === "csv") {
      return new NextResponse(workspaceReportCsv(report), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="workspace-${period.start}.csv"`, "Cache-Control": "private, no-store" },
      });
    }
    return report;
  });
}
