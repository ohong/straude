"use client";

import type { WallOfLovePost } from "@/types";
import { useEffect, useRef, useState } from "react";

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

function WallOfLoveCard({
  post,
  index,
  inView,
}: {
  post: WallOfLovePost;
  index: number;
  inView: boolean;
}) {
  const initials = post.author_name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-2xl border border-[#E5E5E5] bg-white p-6 transition-all duration-500 hover:shadow-[0_8px_32px_rgba(0,0,0,0.06)] hover:border-accent/20 ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Header: avatar + name + X icon */}
      <div className="flex items-start gap-3">
        {post.author_avatar ? (
          <img
            src={post.author_avatar}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5E5E5] text-xs font-semibold text-muted">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-bold leading-tight text-foreground">
            {post.author_name}
          </span>
          <span className="block text-sm text-muted">
            {post.author_handle}
          </span>
        </div>

        <XIcon className="h-5 w-5 shrink-0 text-foreground/30" />
      </div>

      {/* Post text */}
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-foreground">
        {post.text}
      </p>

      {/* Date */}
      <p className="mt-4 text-xs text-muted">{post.date}</p>
    </a>
  );
}

export function WallOfLove({ posts }: { posts: WallOfLovePost[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.1 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  if (posts.length === 0) return null;

  return (
    <section className="bg-white py-24 md:py-32">
      <div ref={ref} className="mx-auto max-w-[1280px] px-6 md:px-8">
        <div className="flex flex-col items-center text-center mb-14">
          <span className="font-[family-name:var(--font-mono)] text-xs tracking-[0.2em] uppercase text-accent mb-4">
            Social proof
          </span>
          <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-[-0.03em]">
            Everyone is Claudemaxxing
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <WallOfLoveCard
              key={post.url}
              post={post}
              index={i}
              inView={inView}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
