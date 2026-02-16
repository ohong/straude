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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post } = await supabase
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

  if (!post) notFound();

  // Check if current user has kudosed
  let hasKudosed = false;
  if (user) {
    const { data: k } = await supabase
      .from("kudos")
      .select("id")
      .eq("user_id", user.id)
      .eq("post_id", id)
      .maybeSingle();
    hasKudosed = !!k;
  }

  // Get first page of comments
  const { data: comments } = await supabase
    .from("comments")
    .select("*, user:users!comments_user_id_fkey(*)")
    .eq("post_id", id)
    .order("created_at", { ascending: true })
    .limit(20);

  const normalizedPost = {
    ...post,
    kudos_count: (post.kudos_count as any)?.[0]?.count ?? 0,
    comment_count: (post.comment_count as any)?.[0]?.count ?? 0,
    has_kudosed: hasKudosed,
  };

  const isOwner = user?.id === post.user_id;

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-background px-6">
        <h3 className="text-lg font-medium">Post</h3>
      </header>
      <ActivityCard post={normalizedPost} />
      {isOwner && <PostEditor post={normalizedPost} />}
      <CommentThread
        postId={id}
        initialComments={comments ?? []}
        userId={user?.id ?? null}
      />
    </>
  );
}
