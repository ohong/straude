import { NextResponse } from "next/server";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { loadRightSidebarPublicData } from "@/lib/data/right-sidebar";
import { loadUsageTotals } from "@/lib/data/usage-totals";
import type { RightSidebarSuggestedUser } from "@/lib/query/right-sidebar";

export async function GET() {
  const [supabase, identity] = await Promise.all([
    createClient(),
    getAuthIdentity(),
  ]);

  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: following }, usageTotals, publicData] = await Promise.all([
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", identity.id),
    loadUsageTotals(supabase, identity.id),
    loadRightSidebarPublicData(),
  ]);

  const followingIds = following?.map((f) => f.following_id) ?? [];
  const excludedIds = new Set([identity.id, ...followingIds]);
  const pinnedList = publicData.pinnedUsers.filter(
    (candidate) => !excludedIds.has(candidate.id)
  );
  const pinnedIds = new Set(pinnedList.map((candidate) => candidate.id));
  const seenIds = new Set<string>();
  const activeUsers: RightSidebarSuggestedUser[] = [];

  for (const candidate of publicData.activeUsers) {
    if (excludedIds.has(candidate.id) || pinnedIds.has(candidate.id)) continue;
    seenIds.add(candidate.id);
    activeUsers.push(candidate);
  }

  const merged: RightSidebarSuggestedUser[] = [...activeUsers];

  for (const candidate of publicData.newSignups) {
    if (
      excludedIds.has(candidate.id)
      || pinnedIds.has(candidate.id)
      || seenIds.has(candidate.id)
    ) {
      continue;
    }
    seenIds.add(candidate.id);
    merged.push(candidate);
  }

  const organicLimit = Math.max(0, 5 - pinnedList.length);
  const suggested = [...merged.slice(0, organicLimit), ...pinnedList].slice(0, 5);

  return NextResponse.json({
    suggested,
    topUsers: publicData.topUsers,
    totalOutputTokens: usageTotals.totalTokens,
  });
}
