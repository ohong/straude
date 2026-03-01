import { NextResponse, type NextRequest } from "next/server";
import { sendWeeklyDigest } from "@/lib/email/send-weekly-digest";

/**
 * ONE-TIME manual endpoint to send the weekly digest activation email
 * to unactivated users. NOT a recurring cron — do not schedule this.
 *
 * Protected by CRON_SECRET.
 *
 * Usage:
 *   Dry run (default): ?send=false  or omit param
 *   Actually send:     ?send=true
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("send") !== "true";

  try {
    const result = await sendWeeklyDigest(dryRun);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
