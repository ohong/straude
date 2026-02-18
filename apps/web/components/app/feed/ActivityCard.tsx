"use client";

import Link from "next/link";
import { Zap, MessageCircle, Share2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatTokens } from "@/lib/utils/format";
import type { Post } from "@/types";
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
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
              {user?.username?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}
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
          <div className="mt-2 text-[0.95rem] leading-relaxed [&_a]:text-accent [&_a]:underline [&_code]:bg-subtle [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-[family-name:var(--font-mono)] [&_code]:text-sm [&_pre]:mt-2 [&_pre]:overflow-x-auto [&_pre]:border-l-2 [&_pre]:border-l-accent [&_pre]:bg-subtle [&_pre]:p-3 [&_pre]:font-[family-name:var(--font-mono)] [&_pre]:text-sm">
            <ReactMarkdown
              allowedElements={["p", "strong", "em", "code", "pre", "a", "br"]}
              unwrapDisallowed
            >
              {post.description}
            </ReactMarkdown>
          </div>
        )}

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <div
            className={cn(
              "mt-3 grid gap-2",
              post.images.length > 1 ? "grid-cols-2" : "grid-cols-1"
            )}
          >
            {post.images.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                width={600}
                height={400}
                loading="lazy"
                className={cn(
                  "w-full rounded",
                  post.images.length === 3 && i === 0 && "row-span-2"
                )}
              />
            ))}
          </div>
        )}

        {/* Stats grid */}
        {usage && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[0.7rem] uppercase tracking-widest text-muted">Cost</p>
              <p className="font-[family-name:var(--font-mono)] text-[1.1rem] font-medium tabular-nums text-accent">
                ${Number(usage.cost_usd).toFixed(2)}
              </p>
            </div>
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
      <div className="mt-4 flex gap-6 border-t border-dashed border-muted/30 pt-4">
        <button
          onClick={toggleKudos}
          className={cn(
            "flex items-center gap-2 text-sm font-semibold hover:text-accent",
            kudosed && "text-accent"
          )}
        >
          <span
            className={cn("inline-block transition-transform", animating && "scale-120")}
            style={{ transitionDuration: "200ms" }}
          >
            <Zap size={16} fill={kudosed ? "currentColor" : "none"} aria-hidden="true" />
          </span>
          Kudos ({kudosCount})
        </button>
        <Link
          href={`/post/${post.id}`}
          className="flex items-center gap-2 text-sm font-semibold hover:text-accent"
        >
          <MessageCircle size={16} aria-hidden="true" />
          Comment ({post.comment_count ?? 0})
        </Link>
        <button
          onClick={handleShare}
          className="ml-auto flex items-center gap-2 text-sm font-semibold hover:text-accent"
        >
          <span className="sr-only">Copy link to post</span>
          Share <Share2 size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
