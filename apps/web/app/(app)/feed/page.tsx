import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { FeedList } from "@/components/app/feed/FeedList";
import type { Metadata } from "next";

const FEED_DESCRIPTION =
  "See the latest Claude Code sessions from the Straude community.";

const SOCIAL_IMAGE = {
  url: "/og-image.png?v=2",
  width: 1200,
  height: 630,
  alt: "Straude — Code like an athlete. Track your Claude Code spend, compete with friends, share your breakthrough sessions.",
  type: "image/png",
};

export const metadata: Metadata = {
  title: "Feed",
  description: FEED_DESCRIPTION,
  alternates: {
    canonical: "/feed",
  },
  openGraph: {
    url: "https://straude.com/feed",
    title: "Feed | Straude",
    description: FEED_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Feed | Straude",
    description: FEED_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
};

type FeedType = "global" | "following" | "mine";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const user = await getAuthUser();
  const supabase = await createClient();

  // Unauthenticated visitors can only see the global feed
  const feedType: FeedType =
    user && (params.tab === "following" || params.tab === "mine")
      ? params.tab
      : "global";

  // Unified RPC — sorts by daily_usage.date DESC, posts.created_at DESC
  const { data } = await supabase.rpc("get_feed", {
    p_type: feedType,
    p_user_id: user?.id ?? null,
    p_limit: 20,
  });
  let posts: any[] = data ?? [];

  // Fetch incomplete posts for the logged-in user (bare synced sessions).
  // Show nudge on all tabs so the user is reminded regardless of which feed they view.
  let pendingPosts: any[] = [];
  if (user) {
    const { data } = await supabase
      .from("posts")
      .select("*, daily_usage:daily_usage!posts_daily_usage_id_fkey(*)")
      .eq("user_id", user.id)
      .is("description", null)
      .eq("images", "[]")
      .order("created_at", { ascending: false })
      .limit(5);
    pendingPosts = data ?? [];
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
          .is("parent_comment_id", null)
          .in("post_id", postIds)
          .order("created_at", { ascending: false })
          .limit(postIds.length * 2),
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
      kudos_count: typeof p.kudos_count === "number" ? p.kudos_count : p.kudos_count?.[0]?.count ?? 0,
      kudos_users: kudosUsersMap.get(p.id) ?? [],
      comment_count: typeof p.comment_count === "number" ? p.comment_count : p.comment_count?.[0]?.count ?? 0,
      recent_comments: commentsMap.get(p.id) ?? [],
      has_kudosed: kudosedSet.has(p.id),
    }));
  }

  return <FeedList initialPosts={posts} userId={user?.id ?? null} feedType={feedType} pendingPosts={pendingPosts} />;
}
