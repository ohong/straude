import {
  normalizeCommentPreview,
  normalizeFeedPost,
  type JoinedUserSummary,
  type RawCommentPreviewRow,
} from "@/lib/feed-normalization";
import { firstRelation } from "@/lib/utils/first-relation";
import type { CommentPreviewItem, FeedPostRow, Post, UserSummary } from "@/types";

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

type KudosRow = {
  post_id: string;
  user: JoinedUserSummary;
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
  publicReadClient = userScopedClient,
}: {
  posts: FeedPostRow[];
  userId: string | null;
  userScopedClient: unknown;
  publicReadClient?: unknown;
}): Promise<Post[]> {
  const userClient = userScopedClient as QueryClient;
  const readClient = publicReadClient as QueryClient;
  const normalized = posts.map(normalizeFeedPost);
  const postIds = normalized.map((post) => post.id);

  if (postIds.length === 0) return normalized;

  const [{ data: userKudos }, { data: recentKudos, error: kudosError }, { data: recentComments }] =
    await Promise.all([
      userId
        ? userClient
            .from("kudos")
            .select("post_id")
            .eq("user_id", userId)
            .in("post_id", postIds)
        : Promise.resolve({ data: [] as { post_id: string }[] }),
      readClient
        .from("kudos")
        .select("post_id, user:users!kudos_user_id_fkey(avatar_url, username)")
        .in("post_id", postIds)
        .order("created_at", { ascending: false })
        .limit(Math.min(postIds.length * 3, 60)),
      readClient
        .from("comments")
        .select("id, post_id, content, created_at, user:users!comments_user_id_fkey(username, avatar_url)")
        .is("parent_comment_id", null)
        .in("post_id", postIds)
        .order("created_at", { ascending: false })
        .limit(Math.min(postIds.length * 2, 40)),
    ]);

  if (kudosError) {
    console.error("[feed] kudos users fetch error:", kudosError);
  }

  const kudosedSet = new Set(
    ((userKudos ?? []) as { post_id: string }[]).map((k) => k.post_id),
  );
  const kudosUsersMap = new Map<string, UserSummary[]>();

  for (const kudos of (recentKudos ?? []) as KudosRow[]) {
    const list = kudosUsersMap.get(kudos.post_id) ?? [];
    const userSummary = firstRelation(kudos.user);
    if (list.length < 3 && userSummary) {
      list.push(userSummary);
      kudosUsersMap.set(kudos.post_id, list);
    }
  }

  const commentsMap = new Map<string, CommentPreviewItem[]>();
  for (const comment of (recentComments ?? []) as RawCommentPreviewRow[]) {
    const list = commentsMap.get(comment.post_id) ?? [];
    if (list.length < 2) {
      list.push(normalizeCommentPreview(comment));
      commentsMap.set(comment.post_id, list);
    }
  }

  for (const [, list] of commentsMap) {
    list.reverse();
  }

  return normalized.map((post) => ({
    ...post,
    kudos_users: kudosUsersMap.get(post.id) ?? [],
    recent_comments: commentsMap.get(post.id) ?? [],
    has_kudosed: kudosedSet.has(post.id),
  }));
}

export async function getPendingPosts(
  client: unknown,
  userId: string | null,
): Promise<Post[]> {
  if (!userId) return [];
  const db = client as QueryClient;

  const { data } = await db
    .from("posts")
    .select("*, daily_usage:daily_usage!posts_daily_usage_id_fkey!inner(*)")
    .eq("user_id", userId)
    .is("description", null)
    .eq("images", "[]")
    .order("date", { ascending: false, referencedTable: "daily_usage" })
    .order("created_at", { ascending: false })
    .limit(5);

  return ((data ?? []) as FeedPostRow[]).map(normalizeFeedPost);
}
