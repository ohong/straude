import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getResend } from "@/lib/email/resend";
import { createUnsubscribeToken } from "@/lib/email/unsubscribe";
import NudgeEmail from "@/lib/email/nudge-email";

/**
 * Cron job: send a single nudge email to users who signed up ~24 hours ago
 * but have never pushed usage data.
 *
 * Protected by CRON_SECRET (standard Vercel cron pattern).
 * Runs hourly; queries a 23-25h window so each user is caught exactly once.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 },
    );
  }

  if (!process.env.UNSUBSCRIBE_SECRET) {
    return NextResponse.json(
      { error: "UNSUBSCRIBE_SECRET not configured" },
      { status: 500 },
    );
  }

  const db = getServiceClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  // Find users who:
  // 1. Signed up between 23-25 hours ago
  // 2. Have email_notifications enabled
  // 3. Have NO rows in daily_usage
  const { data: candidates, error: queryError } = await db
    .from("users")
    .select("id, username")
    .eq("email_notifications", true)
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString());

  if (queryError) {
    return NextResponse.json(
      { error: `Query failed: ${queryError.message}` },
      { status: 500 },
    );
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  // Filter out users who have any daily_usage rows
  const userIds = candidates.map((u) => u.id);
  const { data: usageRows } = await db
    .from("daily_usage")
    .select("user_id")
    .in("user_id", userIds);

  const usersWithUsage = new Set((usageRows ?? []).map((r) => r.user_id));
  const eligibleUsers = candidates.filter((u) => !usersWithUsage.has(u.id));

  if (eligibleUsers.length === 0) {
    return NextResponse.json({ sent: 0, skipped: candidates.length });
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com"
  ).replace(/\/+$/, "");
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "notifications@straude.com";

  let sent = 0;
  const errors: string[] = [];

  for (const user of eligibleUsers) {
    // Fetch email from Supabase Auth admin API
    const { data: authData } = await db.auth.admin.getUserById(user.id);
    const email = authData?.user?.email;
    if (!email) {
      errors.push(`${user.id}: no email found`);
      continue;
    }

    const displayName = user.username ?? "there";
    const profileUrl = user.username
      ? `${appUrl}/u/${user.username}`
      : `${appUrl}/settings`;
    const unsubscribeToken = createUnsubscribeToken(user.id);
    const unsubscribeUrl = `${appUrl}/api/unsubscribe?token=${unsubscribeToken}`;

    try {
      await resend.emails.send({
        from: `Straude <${fromEmail}>`,
        replyTo: "hey@straude.com",
        to: email,
        subject: "Your streak is waiting",
        react: NudgeEmail({
          username: displayName,
          profileUrl,
          unsubscribeUrl,
        }),
        headers: {
          "Idempotency-Key": `nudge-inactive/${user.id}`,
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [{ name: "type", value: "nudge-inactive" }],
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
    skipped: candidates.length - eligibleUsers.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
