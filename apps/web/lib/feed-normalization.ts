import { firstRelation } from "@/lib/utils/first-relation";
import type { CommentPreviewItem, FeedPostRow, Post, UserSummary } from "@/types";

export type JoinedUserSummary = UserSummary[] | null;

export type RawCommentPreviewRow = Omit<CommentPreviewItem, "user"> & {
  user: JoinedUserSummary;
};

export function normalizeFeedPost(post: FeedPostRow): Post {
  return {
    ...post,
    kudos_count: typeof post.kudos_count === "number" ? post.kudos_count : post.kudos_count?.[0]?.count ?? 0,
    comment_count: typeof post.comment_count === "number" ? post.comment_count : post.comment_count?.[0]?.count ?? 0,
  };
}

export function normalizeCommentPreview(comment: RawCommentPreviewRow): CommentPreviewItem {
  return {
    id: comment.id,
    post_id: comment.post_id,
    content: comment.content,
    created_at: comment.created_at,
    user: firstRelation(comment.user) ?? undefined,
  };
}
