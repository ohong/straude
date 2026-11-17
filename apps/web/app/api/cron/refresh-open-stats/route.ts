import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { refreshOpenStatsSnapshot } from "@/lib/open-stats";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await refreshOpenStatsSnapshot();
    revalidatePath("/open");
    revalidatePath("/");

    return NextResponse.json({
      ok: true,
      snapshotDate: stats.snapshotDate,
      capturedAt: stats.fetchedAt,
      totalSpend: stats.totalSpend,
      trackedUsers: stats.trackedUsers,
    });
  } catch (error) {
    console.error("refresh open stats snapshot failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
