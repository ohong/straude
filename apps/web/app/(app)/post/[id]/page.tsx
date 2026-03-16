import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ActivityCard } from "@/components/app/feed/ActivityCard";
import { CommentThread } from "@/components/app/post/CommentThread";
import { PostEditor } from "@/components/app/post/PostEditor";
import { PostSharePanel } from "@/components/app/post/PostSharePanel";
import { loadPostComments } from "@/lib/comments";
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
    .select(
      "title, description, user:users!posts_user_id_fkey(username), daily_usage:daily_usage!posts_daily_usage_id_fkey(cost_usd, output_tokens, models)"
    )
    .eq("id", id)
    .single();

  const userRow = Array.isArray(post?.user) ? post?.user[0] : post?.user;
  const usageRow = Array.isArray(post?.daily_usage)
    ? post?.daily_usage[0]
    : post?.daily_usage;
  const username =
    (userRow as { username?: string | null } | null)?.username ?? "user";
  const description =
    post?.description?.trim() ||
    [
      typeof (usageRow as { cost_usd?: number } | null)?.cost_usd === "number"
        ? `$${(usageRow as { cost_usd: number }).cost_usd.toFixed(2)} spend`
        : null,
      typeof (usageRow as { output_tokens?: number } | null)?.output_tokens ===
      "number"
        ? `${(usageRow as { output_tokens: number }).output_tokens.toLocaleString()} output tokens`
        : null,
      Array.isArray((usageRow as { models?: string[] } | null)?.models) &&
      (usageRow as { models: string[] }).models.length > 0
        ? `using ${(usageRow as { models: string[] }).models[0]}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const pageUrl = `/post/${id}`;

  return {
    title: post?.title ?? `Post by @${username}`,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: post?.title ?? `Post by @${username}`,
      description,
      url: pageUrl,
      type: "article",
    },
    twitter: {
      title: post?.title ?? `Post by @${username}`,
      description,
      card: "summary_large_image",
    },
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

  const commentsPromise = loadPostComments({
    supabase,
    postId: id,
    viewerId: user?.id ?? null,
    limit: 100,
  });

  const viewerProfilePromise = user
    ? supabase
        .from("users")
        .select("username, avatar_url")
        .eq("id", user.id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const [
    { data: post },
    { data: kudosCheck },
    { data: recentKudos },
    { comments },
    { data: viewerProfile },
  ] = await Promise.all([
    postPromise,
    kudosCheckPromise,
    recentKudosPromise,
    commentsPromise,
    viewerProfilePromise,
  ]);

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
  const currentCommentUser = viewerProfile?.username
    ? { username: viewerProfile.username, avatar_url: viewerProfile.avatar_url }
    : undefined;

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background px-4 sm:px-6">
        <h3 className="text-lg font-medium">Post</h3>
      </header>
      <ActivityCard post={normalizedPost} />
      <PostSharePanel
        postId={id}
        sharePost={{
          id: normalizedPost.id,
          title: normalizedPost.title,
          images: normalizedPost.images ?? [],
          user: normalizedPost.user
            ? { username: normalizedPost.user.username }
            : null,
          daily_usage: normalizedPost.daily_usage
            ? {
                cost_usd: normalizedPost.daily_usage.cost_usd,
                output_tokens: normalizedPost.daily_usage.output_tokens,
                models: normalizedPost.daily_usage.models,
                is_verified: normalizedPost.daily_usage.is_verified,
              }
            : null,
        }}
      />
      {isOwner && <PostEditor post={normalizedPost} autoEdit={query.edit === "1"} />}
      <CommentThread
        postId={id}
        initialComments={comments ?? []}
        userId={user?.id ?? null}
        currentUser={currentCommentUser}
      />
    </>
  );
}
