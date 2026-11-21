import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPeriodRange } from "@/lib/utils/recap";

export async function PUT(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to choose a highlight." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const week = getPeriodRange("week").start;
  if (body?.week !== week) return NextResponse.json({ error: "The week has changed. Refresh your recap." }, { status: 409 });
  if (body.post_id !== null && (typeof body.post_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.post_id))) {
    return NextResponse.json({ error: "Choose one of this week’s posts." }, { status: 400 });
  }
  const table = db.from("weekly_build_highlights");
  const { error } = body.post_id === null
    ? await table.delete().eq("user_id", user.id).eq("week_start", week)
    : await table.upsert({ user_id: user.id, week_start: week, post_id: body.post_id }, { onConflict: "user_id,week_start" });
  if (error) return NextResponse.json({ error: "Could not save this highlight. Refresh and try again." }, { status: 422 });
  return NextResponse.json({ saved: true });
}
