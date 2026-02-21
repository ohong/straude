import { NextResponse, type NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { getServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const db = getServiceClient();
  await db
    .from("users")
    .update({ email_notifications: false })
    .eq("id", userId);

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com"
  ).replace(/\/+$/, "");

  return new Response(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;padding:80px 16px;">
  <div style="max-width:400px;text-align:center;">
    <h2 style="margin:0 0 8px;">Unsubscribed</h2>
    <p style="color:#666;">You will no longer receive email notifications for comments.</p>
    <p style="margin-top:24px;"><a href="${appUrl}/settings" style="color:#DF561F;">Manage settings</a></p>
  </div>
</body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}
