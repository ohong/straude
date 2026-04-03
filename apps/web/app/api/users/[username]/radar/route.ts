import { NextResponse, type NextRequest } from "next/server";
import { computeRadarScores } from "@/lib/radar";
import { getProfileAccessContext } from "@/lib/profile-access";

type RouteContext = { params: Promise<{ username: string }> };
type RadarProfileRow = {
  id: string;
  is_public: boolean;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const access = await getProfileAccessContext<RadarProfileRow>(
    username,
    "id, is_public",
  );

  if (!access) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!access.canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scores = await computeRadarScores(access.profile.id);
  return NextResponse.json(scores);
}
