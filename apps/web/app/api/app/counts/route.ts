import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [notificationsRes, messagesRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .neq("type", "message"),
    supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);

  if (notificationsRes.error || messagesRes.error) {
    return NextResponse.json(
      { error: notificationsRes.error?.message ?? messagesRes.error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    notification_unread_count: notificationsRes.count ?? 0,
    message_unread_count: messagesRes.count ?? 0,
  });
}
