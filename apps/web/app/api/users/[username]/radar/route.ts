import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { computeRadarScores } from "@/lib/radar";

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const db = getServiceClient();

  const { data: user, error: userError } = await db
    .from("users")
    .select("id")
    .eq("username", username)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const scores = await computeRadarScores(user.id);
  return NextResponse.json(scores);
}
