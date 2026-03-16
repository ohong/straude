import { NextResponse, type NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { getServiceClient } from "@/lib/supabase/service";

function getUnsubscribeKind(request: NextRequest) {
  return request.nextUrl.searchParams.get("kind") === "dm" ? "dm" : "comment";
}

async function applyUnsubscribe(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const kind = getUnsubscribeKind(request);
  if (!token) {
    return { error: "Missing token" as const, kind, status: 400, success: false };
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return { error: "Invalid token" as const, kind, status: 400, success: false };
  }

  const db = getServiceClient();
  const { error } = await db
    .from("users")
    .update(
      kind === "dm"
        ? { email_dm_notifications: false }
        : { email_notifications: false }
    )
    .eq("id", userId);

  if (error) {
    console.error("[unsubscribe] failed to persist unsubscribe:", error.message);
    return {
      error: "Failed to update notification preferences" as const,
      kind,
      status: 500,
      success: false,
    };
  }

  return { kind, status: 200, success: true as const };
}

export async function GET(request: NextRequest) {
  const result = await applyUnsubscribe(request);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://straude.com"
  ).replace(/\/+$/, "");

  return new Response(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;padding:80px 16px;">
  <div style="max-width:400px;text-align:center;">
    <h2 style="margin:0 0 8px;">Unsubscribed</h2>
    <p style="color:#666;">You will no longer receive email notifications for ${result.kind === "dm" ? "direct messages" : "comments"}.</p>
    <p style="margin-top:24px;"><a href="${appUrl}/settings" style="color:#DF561F;">Manage settings</a></p>
  </div>
</body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

export async function POST(request: NextRequest) {
  const result = await applyUnsubscribe(request);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
