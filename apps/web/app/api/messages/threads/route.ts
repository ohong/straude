import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DirectMessageThread } from "@/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 50, 1),
    100
  );

  const [threadsRes, unreadRes] = await Promise.all([
    supabase.rpc("get_direct_message_threads", { p_limit: limit }),
    supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);

  if (threadsRes.error || unreadRes.error) {
    return NextResponse.json(
      { error: threadsRes.error?.message ?? unreadRes.error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    threads: (threadsRes.data ?? []) as DirectMessageThread[],
    unread_count: unreadRes.count ?? 0,
  });
}
