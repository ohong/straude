import { unstable_cache } from "next/cache";
import { loadLeaderboardEntries } from "@/lib/data/leaderboard";
import { getServiceClient } from "@/lib/supabase/service";
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

type ActiveUserRow = {
  users: ActiveUserRelation | ActiveUserRelation[] | null;
};

export type RightSidebarPublicData = {
  activeUsers: RightSidebarSuggestedUser[];
  newSignups: RightSidebarSuggestedUser[];
  pinnedUsers: RightSidebarSuggestedUser[];
  topUsers: RightSidebarTopUser[];
};

function firstUser(relation: ActiveUserRow["users"]) {
  return Array.isArray(relation) ? relation[0] : relation;
}

export const loadRightSidebarPublicData = unstable_cache(
  async (): Promise<RightSidebarPublicData> => {
    const service = getServiceClient();
    const [leaderboard, pinnedResult, activeResult, signupResult] =
      await Promise.all([
        loadLeaderboardEntries({ period: "week", limit: 5 }),
        service
          .from("users")
          .select("id, username, avatar_url, bio")
          .eq("is_public", true)
          .eq("is_pinned_suggestion", true),
        service
          .from("daily_usage")
          .select("user_id, users!inner(id, username, avatar_url, bio, is_public)")
          .not("users.username", "is", null)
          .order("date", { ascending: false })
          .limit(100),
        service
          .from("users")
          .select("id, username, avatar_url, bio")
          .eq("is_public", true)
          .not("username", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    const seen = new Set<string>();
    const activeUsers: RightSidebarSuggestedUser[] = [];
    for (const row of (activeResult.data ?? []) as ActiveUserRow[]) {
      const user = firstUser(row.users);
      if (!user?.is_public || !user.username || seen.has(user.id)) continue;
      seen.add(user.id);
      activeUsers.push({
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
      });
    }

    const mapUser = (user: {
      id: string;
      username: string | null;
      avatar_url: string | null;
      bio: string | null;
    }): RightSidebarSuggestedUser | null =>
      user.username
        ? {
            id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
            bio: user.bio,
          }
        : null;

    return {
      activeUsers,
      newSignups: (signupResult.data ?? [])
        .map(mapUser)
        .filter((user): user is RightSidebarSuggestedUser => user !== null),
      pinnedUsers: (pinnedResult.data ?? [])
        .map(mapUser)
        .filter((user): user is RightSidebarSuggestedUser => user !== null),
      topUsers: leaderboard.map((entry) => ({
        user_id: entry.user_id,
        username: entry.username,
        avatar_url: entry.avatar_url,
        total_cost: entry.total_cost,
      })),
    };
  },
  ["right-sidebar-public-candidates"],
  { revalidate: 600, tags: ["leaderboard", "right-sidebar-public"] }
);
