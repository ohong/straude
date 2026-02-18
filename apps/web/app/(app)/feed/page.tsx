import { createClient } from "@/lib/supabase/server";
import { FeedList } from "@/components/app/feed/FeedList";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Feed" };

type FeedType = "global" | "following" | "mine";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const feedType: FeedType =
    params.tab === "following" || params.tab === "mine"
      ? params.tab
      : "global";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseFields = `
    *,
    daily_usage:daily_usage!posts_daily_usage_id_fkey(*),
    kudos_count:kudos(count),
    comment_count:comments(count)
  `;

  let posts: any[] = [];

  if (feedType === "global") {
    const { data } = await supabase
      .from("posts")
      .select(`${baseFields}, user:users!posts_user_id_fkey!inner(*)`)
      .eq("user.is_public", true)
      .order("created_at", { ascending: false })
      .limit(20);
    posts = data ?? [];
  } else if (feedType === "mine") {
    const { data } = await supabase
      .from("posts")
      .select(`${baseFields}, user:users!posts_user_id_fkey(*)`)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20);
    posts = data ?? [];
  } else {
    // following: own posts + followed users' posts
    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user!.id);

    const followingIds = followRows?.map((f) => f.following_id) ?? [];
    const feedUserIds = [user!.id, ...followingIds];

    const { data } = await supabase
      .from("posts")
      .select(`${baseFields}, user:users!posts_user_id_fkey(*)`)
      .in("user_id", feedUserIds)
      .order("created_at", { ascending: false })
      .limit(20);
    posts = data ?? [];
  }

  // Enrich with kudos status
  if (posts.length > 0) {
    const postIds = posts.map((p: any) => p.id);
    const { data: userKudos } = await supabase
      .from("kudos")
      .select("post_id")
      .eq("user_id", user!.id)
      .in("post_id", postIds);

    const kudosedSet = new Set(userKudos?.map((k) => k.post_id));

    posts = posts.map((p: any) => ({
      ...p,
      kudos_count: p.kudos_count?.[0]?.count ?? 0,
      comment_count: p.comment_count?.[0]?.count ?? 0,
      has_kudosed: kudosedSet.has(p.id),
    }));
  }

  return <FeedList initialPosts={posts} userId={user!.id} feedType={feedType} />;
}
