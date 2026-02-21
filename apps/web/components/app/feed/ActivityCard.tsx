"use client";

import Link from "next/link";
import { Zap, MessageCircle, Share2, CheckCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ImageGrid } from "@/components/app/shared/ImageGrid";
import { ImageLightbox } from "@/components/app/shared/ImageLightbox";
import { cn } from "@/lib/utils/cn";
import { formatTokens } from "@/lib/utils/format";
import { mentionsToMarkdownLinks } from "@/lib/utils/mentions";
import type { Post, Comment } from "@/types";
import dynamic from "next/dynamic";
import { useState } from "react";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  loading: () => null,
});

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatModel(models: string[]) {
  if (!models || models.length === 0) return null;
  const m = models[0];
  if (m.includes("opus")) return "Claude Opus";
  if (m.includes("sonnet")) return "Claude Sonnet";
  if (m.includes("haiku")) return "Claude Haiku";
  return m;
}

export function ActivityCard({ post }: { post: Post }) {
  const [kudosed, setKudosed] = useState(post.has_kudosed ?? false);
  const [kudosCount, setKudosCount] = useState(post.kudos_count ?? 0);
  const [animating, setAnimating] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  async function handleShare() {
    const url = `${window.location.origin}/post/${post.id}`;
    await navigator.clipboard.writeText(url);
  }

  return (
    <article className="border-b border-border p-6">
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
            <span suppressHydrationWarning>{timeAgo(post.created_at)}</span>
            {usage?.models && usage.models.length > 0 && (
              <>
                <span>&middot;</span>
                <span>{formatModel(usage.models)}</span>
              </>
            )}
            {usage?.is_verified && (
              <span className="inline-flex items-center gap-1 font-semibold text-accent">
                <CheckCircle size={12} />
                Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <Link href={`/post/${post.id}`} className="mt-4 block">
        {post.title && (
          <h2 className="text-xl font-medium hover:underline" style={{ letterSpacing: "-0.02em" }}>
            {post.title}
          </h2>
        )}
        {post.description && (
          <div className="mt-2 text-[0.95rem] leading-relaxed [&_a]:text-accent [&_a]:underline [&_code]:bg-subtle [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-[family-name:var(--font-mono)] [&_code]:text-sm [&_pre]:mt-2 [&_pre]:overflow-x-auto [&_pre]:border-l-2 [&_pre]:border-l-accent [&_pre]:bg-subtle [&_pre]:p-3 [&_pre]:font-[family-name:var(--font-mono)] [&_pre]:text-sm [&_ul]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-0.5 [&_blockquote]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-l-muted [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-3.5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mt-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-wider [&_h4]:text-muted [&_h5]:mt-2 [&_h5]:text-sm [&_h5]:font-semibold [&_h6]:mt-2 [&_h6]:text-xs [&_h6]:font-semibold [&_h6]:text-muted [&_hr]:my-3 [&_hr]:border-border [&_del]:text-muted [&_del]:line-through">
            <ReactMarkdown
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
                  <> &middot; {formatModel(usage.models)}</>
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
      </Link>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-6 border-t border-dashed border-muted/30 pt-4">
        <button
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
        <button
          onClick={handleShare}
          className="ml-auto flex items-center gap-2 text-sm font-semibold hover:text-accent"
        >
          Share <Share2 size={16} aria-hidden="true" />
        </button>
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
