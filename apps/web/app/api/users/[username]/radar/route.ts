import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

type RouteContext = { params: Promise<{ username: string }> };

type RadarResponse = {
  output: number;
  intensity: number;
  consistency: number;
  toolkit: number;
  community: number;
};

/**
 * Compute percentile rank (0–100) for a value within a sorted-ascending array.
 */
function percentileRank(sortedValues: number[], value: number, total: number): number {
  if (total === 0) return 0;
  // Count how many users have a strictly lower value
  let rank = 0;
  for (const v of sortedValues) {
    if (v < value) rank++;
    else break;
  }
  return Math.min(100, Math.max(0, Math.round((rank / total) * 100)));
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const db = getServiceClient();

  // Look up the target user
  const { data: user, error: userError } = await db
    .from("users")
    .select("id, created_at")
    .eq("username", username)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch all users' daily_usage in bulk for distribution computation.
  // We need: output_tokens, cost_usd, model_breakdown, and row counts per user.
  const { data: allUsage } = await db
    .from("daily_usage")
    .select("user_id, output_tokens, cost_usd, model_breakdown");

  if (!allUsage || allUsage.length === 0) {
    return NextResponse.json({
      output: 0,
      intensity: 0,
      consistency: 0,
      toolkit: 0,
      community: 0,
    } satisfies RadarResponse);
  }

  // Fetch all users for consistency + crew calculations
  const { data: allUsers } = await db
    .from("users")
    .select("id, created_at, referred_by");

  const usersMap = new Map<string, { created_at: string }>();
  for (const u of allUsers ?? []) {
    usersMap.set(u.id, { created_at: u.created_at });
  }

  // Aggregate per-user stats from daily_usage rows
  const userStats = new Map<
    string,
    {
      totalOutput: number;
      totalCost: number;
      rowCount: number;
      models: Set<string>;
    }
  >();

  for (const row of allUsage) {
    let stats = userStats.get(row.user_id);
    if (!stats) {
      stats = { totalOutput: 0, totalCost: 0, rowCount: 0, models: new Set() };
      userStats.set(row.user_id, stats);
    }
    stats.totalOutput += Number(row.output_tokens) || 0;
    stats.totalCost += Number(row.cost_usd) || 0;
    stats.rowCount += 1;

    // Extract unique model names from model_breakdown JSONB
    const breakdown = row.model_breakdown as
      | Array<{ model: string; cost_usd: number }>
      | null;
    if (breakdown && Array.isArray(breakdown)) {
      for (const entry of breakdown) {
        if (entry.model) stats.models.add(entry.model);
      }
    }
  }

  // --- Community scores for all users ---
  // Followers: count per following_id
  const { data: allFollows } = await db
    .from("follows")
    .select("following_id");

  const followerCounts = new Map<string, number>();
  for (const f of allFollows ?? []) {
    followerCounts.set(f.following_id, (followerCounts.get(f.following_id) ?? 0) + 1);
  }

  // Kudos received: count kudos on each user's posts
  const { data: allPosts } = await db
    .from("posts")
    .select("id, user_id");

  const postOwnerMap = new Map<string, string>(); // post_id -> user_id
  for (const p of allPosts ?? []) {
    postOwnerMap.set(p.id, p.user_id);
  }

  const { data: allKudos } = await db
    .from("kudos")
    .select("post_id");

  const kudosCounts = new Map<string, number>();
  for (const k of allKudos ?? []) {
    const ownerId = postOwnerMap.get(k.post_id);
    if (ownerId) {
      kudosCounts.set(ownerId, (kudosCounts.get(ownerId) ?? 0) + 1);
    }
  }

  // Crew (referrals): count users where referred_by = user_id
  const crewCounts = new Map<string, number>();
  for (const u of allUsers ?? []) {
    if (u.referred_by) {
      crewCounts.set(u.referred_by, (crewCounts.get(u.referred_by) ?? 0) + 1);
    }
  }

  // Build per-axis raw values for all users that have daily_usage
  const now = Date.now();
  const allUserIds = new Set<string>();
  for (const uid of userStats.keys()) allUserIds.add(uid);
  // Include the target user even if they have no usage
  allUserIds.add(user.id);

  const outputValues: number[] = [];
  const intensityValues: number[] = [];
  const consistencyValues: number[] = [];
  const toolkitValues: number[] = [];
  const communityValues: number[] = [];

  let targetOutput = 0;
  let targetIntensity = 0;
  let targetConsistency = 0;
  let targetToolkit = 0;
  let targetCommunity = 0;

  for (const uid of allUserIds) {
    const stats = userStats.get(uid);
    const userCreatedAt = usersMap.get(uid)?.created_at;

    // Output: total output_tokens
    const output = stats?.totalOutput ?? 0;
    outputValues.push(output);

    // Intensity: cost per active day
    const intensity =
      stats && stats.rowCount > 0 ? stats.totalCost / stats.rowCount : 0;
    intensityValues.push(intensity);

    // Consistency: % of days active since signup
    let consistency = 0;
    if (userCreatedAt && stats && stats.rowCount > 0) {
      const daysSinceCreation = Math.max(
        1,
        Math.floor((now - new Date(userCreatedAt).getTime()) / 86_400_000),
      );
      consistency = Math.min(100, (stats.rowCount / daysSinceCreation) * 100);
    }
    consistencyValues.push(consistency);

    // Toolkit: unique model count
    const toolkit = stats?.models.size ?? 0;
    toolkitValues.push(toolkit);

    // Community: followers + kudos received + crew size
    const community =
      (followerCounts.get(uid) ?? 0) +
      (kudosCounts.get(uid) ?? 0) +
      (crewCounts.get(uid) ?? 0);
    communityValues.push(community);

    if (uid === user.id) {
      targetOutput = output;
      targetIntensity = intensity;
      targetConsistency = consistency;
      targetToolkit = toolkit;
      targetCommunity = community;
    }
  }

  // Sort all distributions ascending for percentile computation
  outputValues.sort((a, b) => a - b);
  intensityValues.sort((a, b) => a - b);
  consistencyValues.sort((a, b) => a - b);
  toolkitValues.sort((a, b) => a - b);
  communityValues.sort((a, b) => a - b);

  const total = allUserIds.size;

  const response: RadarResponse = {
    output: percentileRank(outputValues, targetOutput, total),
    intensity: percentileRank(intensityValues, targetIntensity, total),
    consistency: percentileRank(consistencyValues, targetConsistency, total),
    toolkit: percentileRank(toolkitValues, targetToolkit, total),
    community: percentileRank(communityValues, targetCommunity, total),
  };

  return NextResponse.json(response);
}
