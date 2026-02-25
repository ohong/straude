"use client";

import Link from "next/link";
import { Zap, MessageCircle, CheckCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatTokens } from "@/lib/utils/format";
import { motion, type Variants } from "motion/react";
import type { Post } from "@/types";

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
  if (models.some((m) => m.includes("opus"))) return "Claude Opus";
  if (models.some((m) => m.includes("sonnet"))) return "Claude Sonnet";
  if (models.some((m) => m.includes("haiku"))) return "Claude Haiku";
  return models[0];
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

function ReadOnlyCard({ post, index }: { post: Post; index: number }) {
  const user = post.user;
  const usage = post.daily_usage;
  const kudosCount = post.kudos_count ?? 0;
  const commentCount = post.comment_count ?? 0;

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      className="rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-6 transition-[border-color,box-shadow] duration-300 hover:border-accent/30 hover:shadow-[0_8px_32px_rgba(223,86,31,0.06)]"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Avatar
          src={user?.avatar_url}
          alt={user?.username ?? ""}
          size="md"
          fallback={user?.username ?? "?"}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">
              {user?.username ?? "anonymous"}
            </span>
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
                <CheckCircle size={12} aria-hidden="true" />
                Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mt-4">
        {post.title && (
          <h3 className="text-lg font-medium" style={{ letterSpacing: "-0.02em" }}>
            {post.title}
          </h3>
        )}
        {post.description && (
          <p className="mt-2 text-[0.95rem] leading-relaxed text-muted line-clamp-3">
            {post.description}
          </p>
        )}

        {/* Stats grid */}
        {usage && (
          <div className={`mt-4 grid gap-4 ${usage.is_verified ? "grid-cols-3" : "grid-cols-2"}`}>
            {usage.is_verified ? (
              <div>
                <p className="text-[0.7rem] uppercase tracking-widest text-muted">Cost</p>
                <p className="font-[family-name:var(--font-mono)] text-[1.1rem] font-medium tabular-nums text-accent">
                  ${Number(usage.cost_usd).toFixed(2)}
                </p>
              </div>
            ) : (
              <p className="col-span-2 text-xs text-muted">
                Uploaded via JSON
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
      </div>

      {/* Actions — redirect to signup */}
      <div className="mt-4 flex items-center gap-6 border-t border-dashed border-muted/30 pt-4">
        <Link
          href="/signup"
          className="flex items-center gap-2 text-sm font-semibold hover:text-accent"
        >
          <Zap size={16} aria-hidden="true" />
          {kudosCount} {kudosCount === 1 ? "kudo" : "kudos"}
        </Link>
        <Link
          href="/signup"
          className="flex items-center gap-2 text-sm font-semibold hover:text-accent"
        >
          <MessageCircle size={16} aria-hidden="true" />
          {commentCount} {commentCount === 1 ? "comment" : "comments"}
        </Link>
      </div>
    </motion.div>
  );
}

export function LiveFeed({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="bg-[#F7F5F0] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-8">
        <motion.div
          className="flex flex-col items-center text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <span className="inline-block font-[family-name:var(--font-mono)] text-xs tracking-[0.2em] uppercase text-accent mb-4">
            Live from the feed
          </span>
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-[-0.03em] leading-tight text-balance">
            See what builders are logging
          </h2>
          <p className="mt-4 text-lg text-muted max-w-lg">
            Real sessions, real spend, real output. Updated every time someone syncs.
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-2xl gap-6">
          {posts.map((post, i) => (
            <ReadOnlyCard key={post.id} post={post} index={i} />
          ))}
        </div>

        <motion.div
          className="mt-12 flex justify-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        >
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-4 text-base font-bold text-white transition-[filter,box-shadow] duration-150 hover:brightness-110 hover:shadow-lg hover:shadow-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Join the feed
            <svg
              className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
