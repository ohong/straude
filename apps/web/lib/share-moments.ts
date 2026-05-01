import type { DailyUsage, Post, User } from "@/types";
import { formatCurrency, formatTokens } from "@/lib/utils/format";

type ShareMomentPost = {
  images?: Post["images"] | null;
  kudos_count?: Post["kudos_count"];
  comment_count?: Post["comment_count"];
  daily_usage?: Pick<
    DailyUsage,
    "cost_usd" | "output_tokens" | "models" | "is_verified"
  > | null;
  user?: Pick<User, "username"> | null;
};

export type ShareMoment = {
  label: string;
  headline: string;
  detail: string;
  inviteText: string;
};

function hasMeaningfulSpend(cost: number | null | undefined): cost is number {
  return typeof cost === "number" && Number.isFinite(cost) && cost > 0;
}

function getMomentModelLabel(models: string[] | null | undefined): string | null {
  if (!models || models.length === 0) return null;
  if (models.some((model) => /claude-opus-4|opus/i.test(model))) return "Claude Opus";
  if (models.some((model) => /claude-sonnet-4|sonnet/i.test(model))) return "Claude Sonnet";
  if (models.some((model) => /claude-haiku-4|haiku/i.test(model))) return "Claude Haiku";
  const first = models[0]!;
  if (/^gpt-/i.test(first)) {
    return first.replace(/^gpt/i, "GPT").replace(/-codex$/i, "-Codex");
  }
  if (/^o4/i.test(first)) return "o4";
  if (/^o3/i.test(first)) return "o3";
  return first;
}

export function buildShareMoment(post: ShareMomentPost): ShareMoment {
  const usage = post.daily_usage;
  const outputTokens = usage?.output_tokens ?? 0;
  const spend = usage?.cost_usd;
  const modelLabel = getMomentModelLabel(usage?.models);
  const imageCount = post.images?.length ?? 0;
  const kudosCount = post.kudos_count ?? 0;
  const commentCount = post.comment_count ?? 0;

  if (outputTokens >= 1_000_000) {
    return {
      label: "Output PR",
      headline: `${formatTokens(outputTokens)} output shipped`,
      detail: modelLabel
        ? `${modelLabel} session with a seven-figure token day.`
        : "Seven-figure output day.",
      inviteText: "Think you can outship this?",
    };
  }

  if (hasMeaningfulSpend(spend) && spend >= 100) {
    return {
      label: "Big Build Day",
      headline: `$${formatCurrency(spend)} verified session`,
      detail: modelLabel
        ? `${modelLabel} carried the spend.`
        : "High-intensity coding session.",
      inviteText: "Challenge a teammate to beat this session.",
    };
  }

  if ((usage?.models?.length ?? 0) >= 3) {
    return {
      label: "Toolkit Flex",
      headline: `${usage?.models.length} models in one session`,
      detail: modelLabel
        ? `${modelLabel} led a multi-model build.`
        : "Multi-model build log.",
      inviteText: "Send this to another multi-model builder.",
    };
  }

  if (imageCount > 0) {
    return {
      label: "Receipts Attached",
      headline: `${imageCount} screenshot${imageCount === 1 ? "" : "s"} on the build log`,
      detail: outputTokens > 0
        ? `${formatTokens(outputTokens)} output with visible proof-of-work.`
        : "Visual proof-of-work ready to share.",
      inviteText: "Share the receipts with a friend.",
    };
  }

  if (kudosCount + commentCount >= 3) {
    return {
      label: "Community Pull",
      headline: `${kudosCount} kudo${kudosCount === 1 ? "" : "s"} · ${commentCount} comment${commentCount === 1 ? "" : "s"}`,
      detail: "This session is already pulling people in.",
      inviteText: "Bring another builder into the thread.",
    };
  }

  if (outputTokens > 0) {
    return {
      label: "Build Log",
      headline: `${formatTokens(outputTokens)} output tracked`,
      detail: modelLabel
        ? `${modelLabel} session logged on Straude.`
        : "Session logged on Straude.",
      inviteText: "Share this build log with a peer.",
    };
  }

  return {
    label: "Share Ready",
    headline: "Session logged on Straude",
    detail: "Turn this build into a public proof-of-work card.",
    inviteText: "Invite another builder to log theirs.",
  };
}

export function buildInviteUrl(origin: string, username: string | null | undefined) {
  return new URL(username ? `/join/${username}` : "/", origin).toString();
}
