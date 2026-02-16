import type { WallOfLovePost } from "@/types";

function WallOfLoveCard({ post }: { post: WallOfLovePost }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-4 block break-inside-avoid rounded-xl border border-[#E5E5E5] bg-white p-5 transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
    >
      {/* Author row */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E5E5E5] text-xs font-semibold text-muted">
          {post.author_name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight">
            {post.author_name}
          </span>
          <span className="text-xs text-muted">{post.author_handle}</span>
        </div>
      </div>

      {/* Post text */}
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-foreground">
        {post.text}
      </p>

      {/* Date */}
      <p className="mt-3 text-xs text-muted">{post.date}</p>
    </a>
  );
}

export function WallOfLove({ posts }: { posts: WallOfLovePost[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="bg-[#F7F5F0] py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-8">
        <h2 className="mb-12 text-center text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.02em]">
          Loved by developers
        </h2>

        {/* Masonry grid via CSS columns */}
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {posts.map((post) => (
            <WallOfLoveCard key={post.url} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
