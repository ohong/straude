import {
  normalizeCommentPreview,
  normalizeFeedPost,
  type JoinedUserSummary,
  type RawCommentPreviewRow,
} from "@/lib/feed-normalization";
import { firstRelation } from "@/lib/utils/first-relation";
import type { FeedPostRow, Post } from "@/types";
import { PUBLIC_DAILY_USAGE_FIELDS } from "@/lib/data/public-daily-usage";

type QueryClient = {
  from: (table: string) => QueryBuilder;
};

type QueryResult<T = unknown> = {
  data?: T | null;
  error?: { message?: string } | null;
};

interface QueryBuilder<T = unknown> extends PromiseLike<QueryResult<T>> {
  select: (...args: unknown[]) => QueryBuilder<T>;
  eq: (...args: unknown[]) => QueryBuilder<T>;
  is: (...args: unknown[]) => QueryBuilder<T>;
  in: (...args: unknown[]) => QueryBuilder<T>;
  order: (...args: unknown[]) => QueryBuilder<T>;
  limit: (...args: unknown[]) => QueryBuilder<T>;
};

type PostPreviews = {
  id: string;
  kudos: { user: JoinedUserSummary }[];
  comments: RawCommentPreviewRow[];
};

export function getFeedCursor(posts: Post[], limit: number): string | undefined {
  if (posts.length < limit) return undefined;

  const last = posts[posts.length - 1];
  const date = last?.daily_usage?.date;
  return date && last?.created_at ? `${date}|${last.created_at}` : undefined;
}

export async function enrichFeedPosts({
  posts,
  userId,
  userScopedClient,
}: {
  posts: FeedPostRow[];
  userId: string | null;
  userScopedClient: unknown;
}): Promise<Post[]> {
  const userClient = userScopedClient as QueryClient;
  const normalized = posts.map(normalizeFeedPost);
  const postIds = normalized.map((post) => post.id);

  if (postIds.length === 0) return normalized;

  const [{ data: userKudos }, { data: previews, error }] = await Promise.all([
    userId
      ? userClient.from("kudos").select("post_id").eq("user_id", userId).in("post_id", postIds)
      : Promise.resolve({ data: [] }),
    userClient
      .from("posts")
      .select(`
        id,
        kudos(user:users!kudos_user_id_fkey(avatar_url, username)),
        comments(id, post_id, content, created_at, user:users!comments_user_id_fkey(username, avatar_url))
      `)
      .in("id", postIds)
      .is("comments.parent_comment_id", null)
      .order("created_at", { referencedTable: "kudos", ascending: false })
      .order("id", { referencedTable: "kudos", ascending: false })
      .limit(3, { referencedTable: "kudos" })
      .order("created_at", { referencedTable: "comments", ascending: false })
      .order("id", { referencedTable: "comments", ascending: false })
      .limit(2, { referencedTable: "comments" }),
  ]);

  if (error) console.error("[feed] preview query failed:", error.message);
  const previewsByPost = new Map(((previews ?? []) as PostPreviews[]).map((row) => [row.id, row]));
  const kudosedSet = new Set(((userKudos ?? []) as { post_id: string }[]).map((row) => row.post_id));

  return normalized.map((post) => {
    const preview = previewsByPost.get(post.id);
    return {
      ...post,
      kudos_users: (preview?.kudos ?? []).map((row) => firstRelation(row.user)).filter(user => user !== null),
      recent_comments: (preview?.comments ?? []).map(normalizeCommentPreview).reverse(),
      has_kudosed: kudosedSet.has(post.id),
    };
  });
}

export async function getPendingPosts(
  client: unknown,
  userId: string | null,
): Promise<Post[]> {
  if (!userId) return [];
  const db = client as QueryClient;

  const { data } = await db
    .from("posts")
    .select(`*, daily_usage:daily_usage!posts_daily_usage_id_fkey!inner(${PUBLIC_DAILY_USAGE_FIELDS})`)
    .eq("user_id", userId)
    .is("description", null)
    .eq("images", "[]")
    .order("date", { ascending: false, referencedTable: "daily_usage" })
    .order("created_at", { ascending: false })
    .limit(5);

  return ((data ?? []) as FeedPostRow[]).map(normalizeFeedPost);
}
