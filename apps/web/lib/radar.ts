import { cache } from "react";
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
  refreshed_at: string;
};

const MAX_SNAPSHOT_AGE_MS = 20 * 60 * 1000;

const loadRadarScores = cache(async (userId: string): Promise<RadarScores> => {
  const db = getServiceClient();
  const { data, error } = await db
    .from("profile_stats_snapshots")
    .select("output, intensity, consistency, toolkit, community, refreshed_at")
    .eq("user_id", userId)
    .maybeSingle();

  const scores = data as ProfileStatsRow | null;
  const age = scores ? Date.now() - Date.parse(scores.refreshed_at) : NaN;
  if (error || !scores || !Number.isFinite(age) || age < 0 || age > MAX_SNAPSHOT_AGE_MS) {
    // A missing row or stopped refresh must not hide the chart indefinitely.
    const { computeLiveRadarScores } = await import("@/lib/radar-live");
    return computeLiveRadarScores(userId);
  }

  return {
    output: Number(scores.output) || 0,
    intensity: Number(scores.intensity) || 0,
    consistency: Number(scores.consistency) || 0,
    toolkit: Number(scores.toolkit) || 0,
    community: Number(scores.community) || 0,
  };
});

export function computeRadarScores(userId: string): Promise<RadarScores> {
  return loadRadarScores(userId);
}
