import { unstable_cache } from "next/cache";
import { getServiceClient } from "@/lib/supabase/service";

export type RadarScores = {
  output: number;
  intensity: number;
  consistency: number;
  toolkit: number;
  community: number;
};

type ProfileStatsRow = {
  output: number;
  intensity: number;
  consistency: number;
  toolkit: number;
  community: number;
};

const loadRadarScores = unstable_cache(async (userId: string): Promise<RadarScores> => {
  const db = getServiceClient();
  const { data, error } = await db
    .rpc("get_profile_stats", { p_user_id: userId })
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Profile stats snapshot is unavailable.");
  }

  const scores = data as ProfileStatsRow;
  return {
    output: Number(scores.output) || 0,
    intensity: Number(scores.intensity) || 0,
    consistency: Number(scores.consistency) || 0,
    toolkit: Number(scores.toolkit) || 0,
    community: Number(scores.community) || 0,
  };
}, ["public-profile-radar-snapshot"], {
  revalidate: 600,
  tags: ["profile-stats"],
});

export function computeRadarScores(userId: string): Promise<RadarScores> {
  return loadRadarScores(userId);
}
