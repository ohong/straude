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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated visitors can only see the global feed
  const feedType: FeedType =
    user && (params.tab === "following" || params.tab === "mine")
      ? params.tab
      : "global";

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

  // Enrich with kudos status + kudos users + recent comments
  if (posts.length > 0) {
    const postIds = posts.map((p: any) => p.id);

    // User-specific kudos check only when logged in
    const userKudosPromise = user
      ? supabase
          .from("kudos")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[] });

    const [{ data: userKudos }, { data: recentKudos }, { data: recentComments }] =
      await Promise.all([
        userKudosPromise,
        supabase
          .from("kudos")
          .select("post_id, user:users!kudos_user_id_fkey(avatar_url, username)")
          .in("post_id", postIds)
          .order("created_at", { ascending: false })
          .limit(postIds.length * 3),
        supabase
          .from("comments")
          .select("id, post_id, content, created_at, user:users!comments_user_id_fkey(username, avatar_url)")
          .in("post_id", postIds)
          .order("created_at", { ascending: false }),
      ]);

    const kudosedSet = new Set((userKudos ?? []).map((k) => k.post_id));

    const kudosUsersMap = new Map<string, any[]>();
    for (const k of recentKudos ?? []) {
      const list = kudosUsersMap.get(k.post_id) ?? [];
      if (list.length < 3) {
        list.push(k.user);
        kudosUsersMap.set(k.post_id, list);
      }
    }

    const commentsMap = new Map<string, any[]>();
    for (const c of recentComments ?? []) {
      const list = commentsMap.get(c.post_id) ?? [];
      if (list.length < 2) {
        list.push(c);
        commentsMap.set(c.post_id, list);
      }
    }
    for (const [, list] of commentsMap) {
      list.reverse();
    }

    posts = posts.map((p: any) => ({
      ...p,
      kudos_count: p.kudos_count?.[0]?.count ?? 0,
      kudos_users: kudosUsersMap.get(p.id) ?? [],
      comment_count: p.comment_count?.[0]?.count ?? 0,
      recent_comments: commentsMap.get(p.id) ?? [],
      has_kudosed: kudosedSet.has(p.id),
    }));
  }

  return <FeedList initialPosts={posts} userId={user?.id ?? null} feedType={feedType} />;
}
