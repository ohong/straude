import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { loadUsageTotals } from "@/lib/data/usage-totals";
import type {
  RightSidebarSuggestedUser,
  RightSidebarTopUser,
} from "@/lib/query/right-sidebar";

type ActiveUserRelation = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = getServiceClient();

  const [{ data: topUsers }, { data: following }, usageTotals] = await Promise.all([
    supabase
      .from("leaderboard_weekly")
      .select("user_id, username, avatar_url, total_cost")
      .order("total_cost", { ascending: false })
      .limit(5),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id),
    loadUsageTotals(supabase, user.id),
  ]);

  const followingIds = following?.map((f) => f.following_id) ?? [];
  const excludeIds = [user.id, ...followingIds];
  const excludeFilter = `(${excludeIds.join(",")})`;

  const [{ data: pinnedUsers }, { data: recentlyActive }, { data: newSignups }] =
    await Promise.all([
      service
        .from("users")
        .select("id, username, avatar_url, bio")
        .eq("is_pinned_suggestion", true)
        .not("id", "in", excludeFilter),
      service
        .from("daily_usage")
        .select("user_id, users!inner(id, username, avatar_url, bio, is_public)")
        .not("users.username", "is", null)
        .not("user_id", "in", excludeFilter)
        .order("date", { ascending: false })
        .limit(20),
      service
        .from("users")
        .select("id, username, avatar_url, bio")
        .eq("is_public", true)
        .not("username", "is", null)
        .not("id", "in", excludeFilter)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const pinnedIds = new Set((pinnedUsers ?? []).map((u) => u.id));
  const seenIds = new Set<string>();
  const activeUsers: RightSidebarSuggestedUser[] = [];

  for (const row of recentlyActive ?? []) {
    const candidate = row.users as unknown as ActiveUserRelation;
    if (!seenIds.has(candidate.id) && !pinnedIds.has(candidate.id) && candidate.is_public) {
      seenIds.add(candidate.id);
      activeUsers.push({
        id: candidate.id,
        username: candidate.username,
        avatar_url: candidate.avatar_url,
        bio: candidate.bio,
      });
    }
  }

  const merged: RightSidebarSuggestedUser[] = [];
  for (const candidate of activeUsers) {
    if (!merged.some((item) => item.id === candidate.id)) merged.push(candidate);
  }

  for (const candidate of newSignups ?? []) {
    if (!candidate.username) continue;
    if (pinnedIds.has(candidate.id) || merged.some((item) => item.id === candidate.id)) continue;
    merged.push({
      id: candidate.id,
      username: candidate.username,
      avatar_url: candidate.avatar_url,
      bio: candidate.bio,
    });
  }

  const pinnedList: RightSidebarSuggestedUser[] = (pinnedUsers ?? [])
    .filter((candidate) => candidate.username)
    .map((candidate) => ({
      id: candidate.id,
      username: candidate.username as string,
      avatar_url: candidate.avatar_url,
      bio: candidate.bio,
    }));
  const organicLimit = Math.max(0, 5 - pinnedList.length);
  const suggested = [...merged.slice(0, organicLimit), ...pinnedList].slice(0, 5);

  return NextResponse.json({
    suggested,
    topUsers: (topUsers ?? []) as RightSidebarTopUser[],
    totalOutputTokens: usageTotals.totalTokens,
  });
}
