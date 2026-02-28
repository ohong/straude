"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, MessageCircle, CheckCircle, MoreHorizontal, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ImageGrid } from "@/components/app/shared/ImageGrid";
import { ImageLightbox } from "@/components/app/shared/ImageLightbox";
import { ShareMenu } from "./ShareMenu";
import { cn } from "@/lib/utils/cn";
import { formatTokens } from "@/lib/utils/format";
import { mentionsToMarkdownLinks } from "@/lib/utils/mentions";
import type { Post, Comment, ModelBreakdownEntry } from "@/types";
import dynamic from "next/dynamic";
import { useState } from "react";
import remarkBreaks from "remark-breaks";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  loading: () => null,
});

function timeAgo(dateStr: string, usageDate?: string | null) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  // Prefer usage date (user's local date) over created_at (UTC) to avoid timezone shift
  if (usageDate) {
    return new Date(usageDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function prettifyModel(model: string): string {
  if (/claude-opus-4/i.test(model)) return "Claude Opus";
  if (/claude-sonnet-4/i.test(model)) return "Claude Sonnet";
  if (/claude-haiku-4/i.test(model)) return "Claude Haiku";
  if (/gpt-5/i.test(model)) return "GPT-5";
  if (/gpt-4o/i.test(model)) return "GPT-4o";
  if (/^o3/i.test(model)) return "o3";
  if (/^o4/i.test(model)) return "o4";
  // Legacy: broader Claude matching
  if (model.includes("opus")) return "Claude Opus";
  if (model.includes("sonnet")) return "Claude Sonnet";
  if (model.includes("haiku")) return "Claude Haiku";
  return model;
}

function formatModels(
  models: string[] | undefined,
  breakdown: ModelBreakdownEntry[] | null | undefined,
): string | null {
  // With model_breakdown data: show cost percentages
  if (breakdown && breakdown.length > 0) {
    const totalCost = breakdown.reduce((sum, e) => sum + e.cost_usd, 0);
    if (totalCost <= 0) return null;

    // Deduplicate by pretty name, summing costs
    const byCostMap = new Map<string, number>();
    for (const entry of breakdown) {
      const name = prettifyModel(entry.model);
      byCostMap.set(name, (byCostMap.get(name) ?? 0) + entry.cost_usd);
    }

    // Sort by cost descending
    const sorted = [...byCostMap.entries()].sort((a, b) => b[1] - a[1]);

    return sorted
      .map(([name, cost]) => `${Math.round((cost / totalCost) * 100)}% ${name}`)
      .join(", ");
  }

  // Legacy fallback: pick highest-tier model
  if (!models || models.length === 0) return null;
  if (models.some((m) => m.includes("opus"))) return "Claude Opus";
  if (models.some((m) => m.includes("sonnet"))) return "Claude Sonnet";
  if (models.some((m) => m.includes("haiku"))) return "Claude Haiku";
  return prettifyModel(models[0]!);
}

function CompletenessRing({ post }: { post: Post }) {
  const missing = [
    !post.title && "title",
    !post.description && "description",
    !post.images?.length && "images",
  ].filter(Boolean) as string[];
  const steps = 3 - missing.length;
  const pct = 25 + steps * 25;
  const r = 7;
  const c = 2 * Math.PI * r;
  const tooltip = missing.length === 0
    ? "Post is complete"
    : `Add ${missing.join(", ")} to complete this post`;
  return (
    <svg width="18" height="18" className="shrink-0" aria-label={`${pct}% complete`}>
      <title>{tooltip}</title>
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" />
      <circle
        cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2"
        className="text-accent"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

export function ActivityCard({ post, userId }: { post: Post; userId?: string | null }) {
  const router = useRouter();
  const [kudosed, setKudosed] = useState(post.has_kudosed ?? false);
  const [kudosCount, setKudosCount] = useState(post.kudos_count ?? 0);
  const [animating, setAnimating] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwn = userId != null && userId === post.user_id;

  const commentCount = post.comment_count ?? 0;
  const recentComments = post.recent_comments ?? [];
  const user = post.user;
  const usage = post.daily_usage;

  async function toggleKudos() {
    const method = kudosed ? "DELETE" : "POST";
    setKudosed(!kudosed);
    setKudosCount((c) => (kudosed ? c - 1 : c + 1));
    if (!kudosed) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 200);
    }
    await fetch(`/api/posts/${post.id}/kudos`, { method });
  }

  return (
    <article className="border-b border-border px-4 py-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={user?.username ? `/u/${user.username}` : "#"}>
          <Avatar
            src={user?.avatar_url}
            alt={user?.username ?? ""}
            size="md"
            fallback={user?.username ?? "?"}
          />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={user?.username ? `/u/${user.username}` : "#"}
              className="font-semibold hover:underline"
            >
              {user?.username ?? "anonymous"}
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span suppressHydrationWarning>{timeAgo(post.created_at, usage?.date)}</span>
            {usage?.models && usage.models.length > 0 && (
              <>
                <span>&middot;</span>
                <span>{formatModels(usage.models, usage.model_breakdown)}</span>
              </>
            )}
            {usage?.is_verified && (
              <span className="inline-flex items-center gap-1 font-semibold text-accent">
                <CheckCircle size={12} aria-hidden="true" />
                Verified
              </span>
            )}
            {isOwn && <CompletenessRing post={post} />}
          </div>
        </div>
        {isOwn && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded p-1 text-muted hover:bg-subtle hover:text-foreground"
              aria-label="Post options"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded border border-border bg-background shadow-lg">
                  <Link
                    href={`/post/${post.id}?edit=1`}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-subtle"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Pencil size={14} /> Edit
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Body — clickable card, but not an <a> to avoid nesting with @mention links */}
      <div
        className="mt-4 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        role="link"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) return;
          router.push(`/post/${post.id}`);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !(e.target as HTMLElement).closest("a")) {
            router.push(`/post/${post.id}`);
          }
        }}
      >
        {post.title && (
          <h2 className="text-xl font-medium hover:underline" style={{ letterSpacing: "-0.02em" }}>
            {post.title}
          </h2>
        )}
        {post.description && (
          <div className="mt-2 text-[0.95rem] leading-relaxed [&_p+p]:mt-3 [&_a]:text-accent [&_a]:underline [&_code]:bg-subtle [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-[family-name:var(--font-mono)] [&_code]:text-sm [&_pre]:mt-2 [&_pre]:overflow-x-auto [&_pre]:border-l-2 [&_pre]:border-l-accent [&_pre]:bg-subtle [&_pre]:p-3 [&_pre]:font-[family-name:var(--font-mono)] [&_pre]:text-sm [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-0.5 [&_blockquote]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-l-muted [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-3.5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mt-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-wider [&_h4]:text-muted [&_h5]:mt-2 [&_h5]:text-sm [&_h5]:font-semibold [&_h6]:mt-2 [&_h6]:text-xs [&_h6]:font-semibold [&_h6]:text-muted [&_hr]:my-3 [&_hr]:border-border [&_del]:text-muted [&_del]:line-through">
            <ReactMarkdown
              remarkPlugins={[remarkBreaks]}
              allowedElements={[
                "p", "strong", "em", "del", "code", "pre", "a", "br",
                "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
              ]}
              unwrapDisallowed
            >
              {mentionsToMarkdownLinks(post.description)}
            </ReactMarkdown>
          </div>
        )}

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <ImageGrid images={post.images} onImageClick={setLightboxIndex} />
        )}

        {/* Stats grid */}
        {usage && (
          <div className={cn("mt-4 grid gap-4", usage.is_verified ? "grid-cols-3" : "grid-cols-2")}>
            {usage.is_verified ? (
              <div>
                <p className="text-[0.7rem] uppercase tracking-widest text-muted">Cost</p>
                <p className="font-[family-name:var(--font-mono)] text-[1.1rem] font-medium tabular-nums text-accent">
                  ${Number(usage.cost_usd).toFixed(2)}
                </p>
              </div>
            ) : (
              <p className="col-span-2 text-xs text-muted">
                Uploaded by the user via JSON
                {usage.models && usage.models.length > 0 && (
                  <> &middot; {formatModels(usage.models, usage.model_breakdown)}</>
                )}
              </p>
            )}
            <div>
              <p className="text-[0.7rem] uppercase tracking-widest text-muted">Input</p>
              <p className="font-[family-name:var(--font-mono)] text-[1.1rem] font-medium tabular-nums">
                {formatTokens(Number(usage.input_tokens))}
              </p>
            </div>
            <div>
              <p className="text-[0.7rem] uppercase tracking-widest text-muted">Output</p>
              <p className="font-[family-name:var(--font-mono)] text-[1.1rem] font-medium tabular-nums">
                {formatTokens(Number(usage.output_tokens))}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-6 border-t border-dashed border-muted/30 pt-4">
        <button
          type="button"
          onClick={toggleKudos}
          className={cn(
            "flex items-center gap-2 text-sm font-semibold hover:text-accent",
            kudosed && "text-accent"
          )}
        >
          {(post.kudos_users ?? []).length > 0 && (
            <div className="flex -space-x-1.5">
              {(post.kudos_users ?? []).slice(0, 3).map((u, i) => (
                <Avatar
                  key={u.username ?? i}
                  src={u.avatar_url}
                  alt={u.username ?? ""}
                  size="xs"
                  fallback={u.username ?? "?"}
                  className="ring-2 ring-background"
                />
              ))}
            </div>
          )}
          <span
            className={cn("inline-block transition-transform", animating && "scale-120")}
            style={{ transitionDuration: "200ms" }}
          >
            <Zap size={16} fill={kudosed ? "currentColor" : "none"} aria-hidden="true" />
          </span>
          {kudosCount} {kudosCount === 1 ? "kudo" : "kudos"}
        </button>
        <Link
          href={`/post/${post.id}`}
          className="flex items-center gap-2 text-sm font-semibold hover:text-accent"
        >
          <MessageCircle size={16} aria-hidden="true" />
          {commentCount} {commentCount === 1 ? "comment" : "comments"}
        </Link>
        <ShareMenu postId={post.id} />
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && post.images && (
        <ImageLightbox
          images={post.images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Inline comments preview */}
      {recentComments.length > 0 && (
        <div className="mt-4 space-y-3">
          {recentComments.slice(0, 2).map((c) => (
            <div key={c.id} className="flex items-start gap-3 text-sm">
              <Link href={c.user?.username ? `/u/${c.user.username}` : "#"} className="shrink-0">
                <Avatar
                  src={c.user?.avatar_url}
                  alt={c.user?.username ?? ""}
                  size="sm"
                  fallback={c.user?.username ?? "?"}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Link href={c.user?.username ? `/u/${c.user.username}` : "#"} className="font-semibold hover:underline">
                    {c.user?.username ?? "anonymous"}
                  </Link>
                  <span className="shrink-0 text-xs text-muted" suppressHydrationWarning>
                    {timeAgo(c.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 text-foreground/80">{c.content}</p>
              </div>
            </div>
          ))}
          {commentCount > 2 && (
            <Link
              href={`/post/${post.id}`}
              className="block text-sm text-muted hover:text-foreground"
            >
              View all {commentCount} comments
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
