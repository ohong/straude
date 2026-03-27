import type { MetadataRoute } from "next";
import { getServiceClient } from "@/lib/supabase/service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getServiceClient();
  const { data: users } = await db
    .from("users")
    .select("username, updated_at")
    .eq("is_public", true)
    .eq("onboarding_completed", true)
    .not("username", "is", null);

  const staticPages: MetadataRoute.Sitemap = [
    { url: "https://straude.com", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://straude.com/feed", lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: "https://straude.com/leaderboard", lastModified: new Date(), changeFrequency: "hourly", priority: 0.8 },
    { url: "https://straude.com/open", lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: "https://straude.com/cli", lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: "https://straude.com/privacy", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: "https://straude.com/terms", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  const userPages: MetadataRoute.Sitemap = (users ?? []).map((u) => ({
    url: `https://straude.com/u/${u.username}`,
    lastModified: new Date(u.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...userPages];
}
