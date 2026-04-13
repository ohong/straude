import type { SupabaseClient } from "@supabase/supabase-js";
import type { Comment } from "@/types";

export interface CommentReactionRow {
  comment_id: string;
  user_id: string;
}

export async function loadPostComments(opts: {
  supabase: SupabaseClient;
  postId: string;
  viewerId?: string | null;
  limit?: number;
  cursor?: string | null;
}) {
  const limit = Math.min(opts.limit ?? 100, 200);

  let query = opts.supabase
    .from("comments")
    .select("*, user:users!comments_user_id_fkey(id, username, display_name, bio, avatar_url, is_public)")
    .eq("post_id", opts.postId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (opts.cursor) {
    query = query.gt("created_at", opts.cursor);
  }

  const { data: rawComments, error } = await query;

  if (error) {
    return { comments: [] as Comment[], nextCursor: undefined, error };
  }

  const commentIds = (rawComments ?? []).map((comment: { id: string }) => comment.id);
  const { data: reactionRows, error: reactionsError } = commentIds.length
    ? await opts.supabase
        .from("comment_reactions")
        .select("comment_id, user_id")
        .in("comment_id", commentIds)
    : { data: [] as CommentReactionRow[], error: null };

  if (reactionsError) {
    return { comments: [] as Comment[], nextCursor: undefined, error: reactionsError };
  }

  const comments = enrichComments(rawComments ?? [], reactionRows ?? [], opts.viewerId);
  const nextCursor =
    (rawComments ?? []).length === limit
      ? rawComments![rawComments!.length - 1]?.created_at
      : undefined;

  return { comments, nextCursor, error: null };
}

export function enrichComments(
  comments: Comment[],
  reactionRows: CommentReactionRow[],
  viewerId?: string | null,
): Comment[] {
  const reactionCounts = new Map<string, number>();
  const replyCounts = new Map<string, number>();
  const reactedIds = new Set<string>();

  for (const row of reactionRows) {
    reactionCounts.set(row.comment_id, (reactionCounts.get(row.comment_id) ?? 0) + 1);
    if (viewerId && row.user_id === viewerId) {
      reactedIds.add(row.comment_id);
    }
  }

  for (const comment of comments) {
    if (comment.parent_comment_id) {
      replyCounts.set(
        comment.parent_comment_id,
        (replyCounts.get(comment.parent_comment_id) ?? 0) + 1,
      );
    }
  }

  return comments.map((comment) => ({
    ...comment,
    parent_comment_id: comment.parent_comment_id ?? null,
    reaction_count: comment.reaction_count ?? reactionCounts.get(comment.id) ?? 0,
    has_reacted: comment.has_reacted ?? reactedIds.has(comment.id),
    reply_count: comment.reply_count ?? replyCounts.get(comment.id) ?? 0,
  }));
}

export function buildCommentTree(comments: Comment[]): Comment[] {
  const byId = new Map<string, Comment>();
  const roots: Comment[] = [];

  for (const comment of comments) {
    byId.set(comment.id, {
      ...comment,
      replies: [],
    });
  }

  for (const comment of comments) {
    const current = byId.get(comment.id)!;
    const parentId = current.parent_comment_id;
    const parent = parentId ? byId.get(parentId) : null;

    if (parent) {
      parent.replies = [...(parent.replies ?? []), current];
      parent.reply_count = parent.replies.length;
    } else {
      roots.push(current);
    }
  }

  return roots;
}
