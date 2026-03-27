import { getServiceClient } from "@/lib/supabase/service";

export type RadarScores = {
  output: number;
  intensity: number;
  consistency: number;
  toolkit: number;
  community: number;
};

/**
 * Percentile rank (0–100) for a value within a sorted-ascending array.
 */
function percentileRank(sortedValues: number[], value: number, total: number): number {
  if (total === 0) return 0;
  let rank = 0;
  for (const v of sortedValues) {
    if (v < value) rank++;
    else break;
  }
  return Math.min(100, Math.max(0, Math.round((rank / total) * 100)));
}

// ---------------------------------------------------------------------------
// Simple in-memory cache for the expensive global distributions.
// The distributions change slowly (new usage rows trickle in) so a short TTL
// is fine — it avoids re-scanning every table on every profile view.
// ---------------------------------------------------------------------------
type CachedDistributions = {
  userStats: Map<string, { totalOutput: number; totalCost: number; rowCount: number; models: Set<string> }>;
  followerCounts: Map<string, number>;
  kudosCounts: Map<string, number>;
  crewCounts: Map<string, number>;
  usersMap: Map<string, { created_at: string }>;
  allUserIds: Set<string>;
};

let _cache: { data: CachedDistributions; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getDistributions(): Promise<CachedDistributions> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return _cache.data;
  }

  const db = getServiceClient();

  // Run ALL heavy queries in parallel
  const [{ data: allUsage }, { data: allUsers }, { data: allFollows }, { data: allPosts }, { data: allKudos }] =
    await Promise.all([
      db.from("daily_usage").select("user_id, output_tokens, cost_usd, model_breakdown"),
      db.from("users").select("id, created_at, referred_by"),
      db.from("follows").select("following_id"),
      db.from("posts").select("id, user_id"),
      db.from("kudos").select("post_id"),
    ]);

  // Build users map
  const usersMap = new Map<string, { created_at: string }>();
  for (const u of allUsers ?? []) {
    usersMap.set(u.id, { created_at: u.created_at });
  }

  // Aggregate per-user stats from daily_usage
  const userStats = new Map<
    string,
    { totalOutput: number; totalCost: number; rowCount: number; models: Set<string> }
  >();
  for (const row of allUsage ?? []) {
    let stats = userStats.get(row.user_id);
    if (!stats) {
      stats = { totalOutput: 0, totalCost: 0, rowCount: 0, models: new Set() };
      userStats.set(row.user_id, stats);
    }
    stats.totalOutput += Number(row.output_tokens) || 0;
    stats.totalCost += Number(row.cost_usd) || 0;
    stats.rowCount += 1;

    const breakdown = row.model_breakdown as Array<{ model: string; cost_usd: number }> | null;
    if (breakdown && Array.isArray(breakdown)) {
      for (const entry of breakdown) {
        if (entry.model) stats.models.add(entry.model);
      }
    }
  }

  // Follower counts
  const followerCounts = new Map<string, number>();
  for (const f of allFollows ?? []) {
    followerCounts.set(f.following_id, (followerCounts.get(f.following_id) ?? 0) + 1);
  }

  // Kudos received per user
  const postOwnerMap = new Map<string, string>();
  for (const p of allPosts ?? []) {
    postOwnerMap.set(p.id, p.user_id);
  }
  const kudosCounts = new Map<string, number>();
  for (const k of allKudos ?? []) {
    const ownerId = postOwnerMap.get(k.post_id);
    if (ownerId) {
      kudosCounts.set(ownerId, (kudosCounts.get(ownerId) ?? 0) + 1);
    }
  }

  // Crew (referrals)
  const crewCounts = new Map<string, number>();
  for (const u of allUsers ?? []) {
    if (u.referred_by) {
      crewCounts.set(u.referred_by, (crewCounts.get(u.referred_by) ?? 0) + 1);
    }
  }

  // All user IDs that have usage
  const allUserIds = new Set<string>();
  for (const uid of userStats.keys()) allUserIds.add(uid);

  const data: CachedDistributions = { userStats, followerCounts, kudosCounts, crewCounts, usersMap, allUserIds };
  _cache = { data, ts: Date.now() };
  return data;
}

/**
 * Compute radar scores for a given user. Uses a cached global distribution
 * so only the first call in a 5-minute window hits the database.
 */
export async function computeRadarScores(userId: string): Promise<RadarScores> {
  const dist = await getDistributions();
  const { userStats, followerCounts, kudosCounts, crewCounts, usersMap, allUserIds } = dist;

  // Ensure the target user is in the set
  const ids = new Set(allUserIds);
  ids.add(userId);

  const now = Date.now();

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

  for (const uid of ids) {
    const stats = userStats.get(uid);
    const userCreatedAt = usersMap.get(uid)?.created_at;

    const output = stats?.totalOutput ?? 0;
    outputValues.push(output);

    const intensity = stats && stats.rowCount > 0 ? stats.totalCost / stats.rowCount : 0;
    intensityValues.push(intensity);

    let consistency = 0;
    if (userCreatedAt && stats && stats.rowCount > 0) {
      const daysSinceCreation = Math.max(1, Math.floor((now - new Date(userCreatedAt).getTime()) / 86_400_000));
      consistency = Math.min(100, (stats.rowCount / daysSinceCreation) * 100);
    }
    consistencyValues.push(consistency);

    const toolkit = stats?.models.size ?? 0;
    toolkitValues.push(toolkit);

    const community =
      (followerCounts.get(uid) ?? 0) + (kudosCounts.get(uid) ?? 0) + (crewCounts.get(uid) ?? 0);
    communityValues.push(community);

    if (uid === userId) {
      targetOutput = output;
      targetIntensity = intensity;
      targetConsistency = consistency;
      targetToolkit = toolkit;
      targetCommunity = community;
    }
  }

  outputValues.sort((a, b) => a - b);
  intensityValues.sort((a, b) => a - b);
  consistencyValues.sort((a, b) => a - b);
  toolkitValues.sort((a, b) => a - b);
  communityValues.sort((a, b) => a - b);

  const total = ids.size;

  return {
    output: percentileRank(outputValues, targetOutput, total),
    intensity: percentileRank(intensityValues, targetIntensity, total),
    consistency: percentileRank(consistencyValues, targetConsistency, total),
    toolkit: percentileRank(toolkitValues, targetToolkit, total),
    community: percentileRank(communityValues, targetCommunity, total),
  };
}
