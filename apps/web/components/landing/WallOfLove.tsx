"use client";

import Image from "next/image";
import type { WallOfLovePost } from "@/types";
import { motion, type Variants } from "motion/react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const wallCardVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.08,
      duration: 0.55,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

function WallOfLoveCard({
  post,
  index,
}: {
  post: WallOfLovePost;
  index: number;
}) {
  const initials = post.author_name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <motion.a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block break-inside-avoid mb-5 border border-[#222] bg-white/[0.03] p-6 transition-[border-color] duration-300 hover:border-accent/40"
      custom={index}
      variants={wallCardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
    >
      {/* Header: avatar + name + X icon */}
      <div className="flex items-start gap-3">
        {post.author_avatar ? (
          <Image
            src={post.author_avatar}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#222] text-xs font-semibold text-[#888]">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-bold leading-tight text-[#F0F0F0]">
            {post.author_name}
          </span>
          <span className="block text-sm text-[#888]">
            {post.author_handle}
          </span>
        </div>

        <XIcon className="h-5 w-5 shrink-0 text-[#333]" />
      </div>

      {/* Post text */}
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-[#aaa]">
        {post.text}
      </p>

      {/* Date */}
      <p className="mt-4 text-xs text-[#555] font-[family-name:var(--font-mono)]">
        {post.date}
      </p>
    </motion.a>
  );
}

export function WallOfLove({ posts }: { posts: WallOfLovePost[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="border-t border-[#222] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-8">
        <motion.div
          className="flex flex-col items-center text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-medium tracking-[-0.03em] text-balance text-[#F0F0F0]">
            Everybody is <span className="text-accent">Claudemaxxing</span>.
            Are you?
          </h2>
        </motion.div>

        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5">
          {posts.map((post, i) => (
            <WallOfLoveCard key={post.url} post={post} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
