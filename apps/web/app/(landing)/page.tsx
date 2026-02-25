import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Stats } from "@/components/landing/Stats";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { LiveFeed } from "@/components/landing/LiveFeed";
import { Features } from "@/components/landing/Features";
import { WallOfLove } from "@/components/landing/WallOfLove";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { wallOfLovePosts } from "@/content/wall-of-love";
import { getServiceClient } from "@/lib/supabase/service";
import type { Metadata } from "next";
import type { Post } from "@/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Straude — Strava for Claude Code",
  description:
    "One command to log your Claude Code output. Track your spend, compare your pace, keep the streak alive.",
};

async function getPublicFeedPosts(): Promise<Post[]> {
  try {
    const supabase = getServiceClient();

    const { data: posts, error } = await supabase
      .from("posts")
      .select(`
        *,
        user:users!posts_user_id_fkey!inner(*),
        daily_usage:daily_usage!posts_daily_usage_id_fkey(*),
        kudos_count:kudos(count),
        comment_count:comments(count)
      `)
      .eq("user.is_public", true)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error || !posts) return [];

    // Fetch kudos user avatars for all posts
    const postIds = posts.map((p) => p.id);
    const { data: recentKudos } = postIds.length
      ? await supabase
          .from("kudos")
          .select("post_id, user:users!kudos_user_id_fkey(avatar_url, username)")
          .in("post_id", postIds)
          .order("created_at", { ascending: false })
          .limit(postIds.length * 3)
      : { data: [] };

    const kudosUsersMap = new Map<string, Array<{ avatar_url: string | null; username: string | null }>>();
    for (const k of recentKudos ?? []) {
      const list = kudosUsersMap.get(k.post_id) ?? [];
      if (list.length < 3) {
        list.push(k.user as any);
        kudosUsersMap.set(k.post_id, list);
      }
    }

    return posts.map((p) => ({
      ...p,
      kudos_count: p.kudos_count?.[0]?.count ?? 0,
      kudos_users: kudosUsersMap.get(p.id) ?? [],
      comment_count: p.comment_count?.[0]?.count ?? 0,
      has_kudosed: false,
    }));
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const feedPosts = await getPublicFeedPosts();

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <ProductShowcase />
        <LiveFeed posts={feedPosts} />
        <Features />
        <WallOfLove posts={wallOfLovePosts} />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
