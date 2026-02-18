import { createClient } from "@/lib/supabase/server";
import { FeedList } from "@/components/app/feed/FeedList";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get first page of feed posts (from people user follows)
  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user!.id);

  const followingIds = followRows?.map((f) => f.following_id) ?? [];
  // Include own posts in the feed
  const feedUserIds = [user!.id, ...followingIds];

  let posts: any[] = [];

  if (feedUserIds.length > 0) {
    const { data } = await supabase
      .from("posts")
      .select(
        `
        *,
        user:users!posts_user_id_fkey(*),
        daily_usage:daily_usage!posts_daily_usage_id_fkey(*),
        kudos_count:kudos(count),
        comment_count:comments(count)
      `
      )
      .in("user_id", feedUserIds)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      // Check which posts current user has kudosed
      const postIds = data.map((p: any) => p.id);
      const { data: userKudos } = await supabase
        .from("kudos")
        .select("post_id")
        .eq("user_id", user!.id)
        .in("post_id", postIds);

      const kudosedSet = new Set(userKudos?.map((k) => k.post_id));

      posts = data.map((p: any) => ({
        ...p,
        kudos_count: p.kudos_count?.[0]?.count ?? 0,
        comment_count: p.comment_count?.[0]?.count ?? 0,
        has_kudosed: kudosedSet.has(p.id),
      }));
    }
  }

  return (
    <>
      {posts.length > 0 ? (
        <FeedList initialPosts={posts} userId={user!.id} />
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <p className="text-lg font-medium">Your feed is empty</p>
          <p className="mt-2 text-sm text-muted">
            Follow some builders to see their posts here.
          </p>
          <Link
            href="/search"
            className="mt-4 inline-block rounded bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Find users to follow
          </Link>
        </div>
      )}
    </>
  );
}
