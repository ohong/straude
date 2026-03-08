import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://straude.com", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://straude.com/feed", lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: "https://straude.com/leaderboard", lastModified: new Date(), changeFrequency: "hourly", priority: 0.8 },
    { url: "https://straude.com/privacy", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: "https://straude.com/terms", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
