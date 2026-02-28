import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ActivityCard } from "@/components/app/feed/ActivityCard";
import { CommentThread } from "@/components/app/post/CommentThread";
import { PostEditor } from "@/components/app/post/PostEditor";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("title, user:users!posts_user_id_fkey(username)")
    .eq("id", id)
    .single();

  return {
    title: post?.title ?? `Post by ${(post?.user as any)?.username ?? "user"}`,
  };
}

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const postPromise = supabase
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
    .eq("id", id)
    .single();

  const kudosCheckPromise = user
    ? supabase
        .from("kudos")
        .select("id")
        .eq("user_id", user.id)
        .eq("post_id", id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const recentKudosPromise = supabase
    .from("kudos")
    .select("user:users!kudos_user_id_fkey(avatar_url, username)")
    .eq("post_id", id)
    .order("created_at", { ascending: false })
    .limit(3);

  const commentsPromise = supabase
    .from("comments")
    .select("*, user:users!comments_user_id_fkey(*)")
    .eq("post_id", id)
    .order("created_at", { ascending: true })
    .limit(20);

  const [{ data: post }, { data: kudosCheck }, { data: recentKudos }, { data: comments }] =
    await Promise.all([postPromise, kudosCheckPromise, recentKudosPromise, commentsPromise]);

  if (!post) notFound();

  const hasKudosed = !!kudosCheck;

  const normalizedPost = {
    ...post,
    kudos_count: (post.kudos_count as any)?.[0]?.count ?? 0,
    kudos_users: (recentKudos ?? []).map((k) => k.user as any),
    comment_count: (post.comment_count as any)?.[0]?.count ?? 0,
    has_kudosed: hasKudosed,
  };

  const isOwner = user?.id === post.user_id;

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background px-4 sm:px-6">
        <h3 className="text-lg font-medium">Post</h3>
      </header>
      <ActivityCard post={normalizedPost} />
      {isOwner && <PostEditor post={normalizedPost} autoEdit={query.edit === "1"} />}
      <CommentThread
        postId={id}
        initialComments={comments ?? []}
        userId={user?.id ?? null}
      />
    </>
  );
}
