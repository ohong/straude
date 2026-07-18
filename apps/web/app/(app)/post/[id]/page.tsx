import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/supabase/auth";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ActivityCard } from "@/components/app/feed/ActivityCard";
import { CommentThread } from "@/components/app/post/CommentThread";
import { PostEditor } from "@/components/app/post/PostEditor";
import { PostSharePanel } from "@/components/app/post/PostSharePanel";
import { loadPostComments } from "@/lib/comments";
import { firstRelation } from "@/lib/utils/first-relation";
import { formatCurrency } from "@/lib/utils/format";
import type { AggregateCount, FeedPostRow, UserSummary } from "@/types";
import type { Metadata } from "next";

type RecentKudosRow = {
  user: Array<UserSummary> | null;
};

const getPost = cache(async (id: string): Promise<FeedPostRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select(
      `
      *,
      user:users!posts_user_id_fkey(id, username, display_name, bio, avatar_url, country, region, link, github_username, is_public),
      daily_usage:daily_usage!posts_daily_usage_id_fkey(*),
      kudos_count:kudos(count),
      comment_count:comments(count)
    `
    )
    .eq("id", id)
    .single();

  return data as FeedPostRow | null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [post, { identity }] = await Promise.all([getPost(id), getAuthContext()]);

  const userRow = firstRelation(post?.user);
  const canView =
    Boolean(post) && (userRow?.is_public || identity?.id === post?.user_id);

  if (!canView) {
    return {
      title: "Post",
      description: "This post is private.",
      alternates: {
        canonical: `/post/${id}`,
      },
      robots: {
        index: false,
        follow: false,
      },
    };
  }
  const usageRow = firstRelation(post?.daily_usage);
  const username = userRow?.username ?? "user";
  const description =
    post?.description?.trim() ||
    [
      typeof usageRow?.cost_usd === "number"
        ? `$${formatCurrency(usageRow.cost_usd)} spend`
        : null,
      typeof usageRow?.output_tokens === "number"
        ? `${usageRow.output_tokens.toLocaleString()} output tokens`
        : null,
      Array.isArray(usageRow?.models) && usageRow.models.length > 0
        ? `using ${usageRow.models[0]}`
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
  const [supabase, { identity, profile }, post] = await Promise.all([
    createClient(),
    getAuthContext(),
    getPost(id),
  ]);

  const kudosCheckPromise = identity
    ? supabase
        .from("kudos")
        .select("id")
        .eq("user_id", identity.id)
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
    viewerId: identity?.id ?? null,
    limit: 100,
  });

  const [
    { data: kudosCheck },
    { data: recentKudos },
    { comments },
  ] = await Promise.all([
    kudosCheckPromise,
    recentKudosPromise,
    commentsPromise,
  ]);

  if (!post) notFound();

  if (!post.user?.is_public && identity?.id !== post.user_id) {
    notFound();
  }

  const hasKudosed = !!kudosCheck;

  const postRow = post;
  const normalizedPost = {
    ...postRow,
    kudos_count: ((postRow.kudos_count as AggregateCount[] | undefined)?.[0]?.count ?? 0),
    kudos_users: (recentKudos ?? []).map((k) => firstRelation((k as RecentKudosRow).user)).filter((user): user is UserSummary => Boolean(user)),
    comment_count: ((postRow.comment_count as AggregateCount[] | undefined)?.[0]?.count ?? 0),
    has_kudosed: hasKudosed,
  };

  const isOwner = identity?.id === post.user_id;
  const currentCommentUser = profile?.username
    ? { username: profile.username, avatar_url: profile.avatar_url }
    : undefined;

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background px-4 sm:px-6">
        <h3 className="text-lg font-medium">Post</h3>
      </header>
      <ActivityCard post={normalizedPost} hideShareMenu />
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
        userId={identity?.id ?? null}
        currentUser={currentCommentUser}
      />
    </>
  );
}
