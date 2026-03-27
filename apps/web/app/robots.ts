import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/og-image", "/onboarding", "/settings"],
      },
    ],
    sitemap: "https://straude.com/sitemap.xml",
  };
}
