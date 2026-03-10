import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { sendEmptyProfileEmail } from "@/lib/email/send-empty-profile-email";

/**
 * One-shot endpoint: send "empty profile" nudge emails to users who completed
 * onboarding but have never pushed usage data.
 *
 * Targets users with:
 *   - onboarding_completed = true
 *   - a username set
 *   - email_notifications enabled
 *   - zero rows in daily_usage
 *
 * Protected by CRON_SECRET. Supports dry-run mode (default) — append
 * `?send=true` to actually send emails.
 *
 * Idempotency key `empty-profile/{userId}` ensures each user receives
 * this email at most once, even if the endpoint is called multiple times.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shouldSend = request.nextUrl.searchParams.get("send") === "true";

  const db = getServiceClient();

  // Find onboarded users with a username and email_notifications enabled
  const { data: candidates, error: queryError } = await db
    .from("users")
    .select("id, username")
    .eq("onboarding_completed", true)
    .eq("email_notifications", true)
    .not("username", "is", null);

  if (queryError) {
    return NextResponse.json(
      { error: `Query failed: ${queryError.message}` },
      { status: 500 },
    );
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, dry_run: !shouldSend });
  }

  // Filter out seed users and users who have any daily_usage rows
  const realCandidates = candidates.filter(
    (u) => !u.id.startsWith("a0000000-"),
  );
  const userIds = realCandidates.map((u) => u.id);

  const { data: usageRows } = await db
    .from("daily_usage")
    .select("user_id")
    .in("user_id", userIds);

  const usersWithUsage = new Set((usageRows ?? []).map((r) => r.user_id));
  const eligibleUsers = realCandidates.filter(
    (u) => !usersWithUsage.has(u.id),
  );

  if (eligibleUsers.length === 0) {
    return NextResponse.json({
      sent: 0,
      skipped: realCandidates.length,
      dry_run: !shouldSend,
    });
  }

  if (!shouldSend) {
    return NextResponse.json({
      dry_run: true,
      would_send: eligibleUsers.length,
      users: eligibleUsers.map((u) => ({
        id: u.id,
        username: u.username,
      })),
    });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const user of eligibleUsers) {
    const { data: authData } = await db.auth.admin.getUserById(user.id);
    const email = authData?.user?.email;
    if (!email) {
      errors.push(`${user.id}: no email found`);
      continue;
    }

    try {
      await sendEmptyProfileEmail({
        userId: user.id,
        email,
        username: user.username!,
      });
      sent++;
    } catch (err) {
      errors.push(
        `${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return NextResponse.json({
    sent,
    skipped: realCandidates.length - eligibleUsers.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
