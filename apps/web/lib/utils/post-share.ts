import type { DailyUsage, Post, User } from "@/types";
import { getShareModelLabel } from "@straude/shared/models";
import { formatCurrency, formatTokens } from "./format";

export { prettifyModel, getShareModelLabel } from "@straude/shared/models";

type ShareablePost = Pick<Post, "id" | "title" | "images"> & {
  user?: Pick<User, "username"> | null;
  daily_usage?: Pick<
    DailyUsage,
    "cost_usd" | "output_tokens" | "models" | "is_verified"
  > | null;
};

export function buildPostShareUrl(origin: string, postId: string) {
  return new URL(`/post/${postId}`, origin).toString();
}

export function getPostShareFilename(postId: string) {
  return `straude-${postId.slice(0, 8)}.png`;
}

export function buildPostShareText(post: ShareablePost) {
  const title = post.title?.trim();
  const lines: string[] = [];

  if (title) {
    lines.push(title);
  } else {
    lines.push("Tracked a Claude Code session");
  }

  const details: string[] = [];
  const spend = post.daily_usage?.cost_usd;
  if (typeof spend === "number" && Number.isFinite(spend) && spend > 0) {
    details.push(
      post.daily_usage?.is_verified
        ? `$${formatCurrency(spend)} verified spend`
        : `$${formatCurrency(spend)} spend`
    );
  }

  const outputTokens = post.daily_usage?.output_tokens ?? 0;
  if (outputTokens > 0) {
    details.push(`${formatTokens(outputTokens)} output`);
  }

  const model = getShareModelLabel(post.daily_usage?.models);
  if (model) {
    details.push(model);
  }

  const imageCount = post.images?.length ?? 0;
  if (imageCount > 0) {
    details.push(`${imageCount} screenshot${imageCount === 1 ? "" : "s"}`);
  }

  if (details.length > 0) {
    lines.push(details.join(" · "));
  }

  const username = post.user?.username;
  lines.push(username ? `Tracked on Straude by @${username}` : "Tracked on Straude");

  return lines.join("\n");
}

export function buildPostIntentUrl(post: ShareablePost, origin: string) {
  const params = new URLSearchParams({
    text: buildPostShareText(post),
    url: buildPostShareUrl(origin, post.id),
  });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
