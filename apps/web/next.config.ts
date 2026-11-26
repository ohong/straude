import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { loopbackHttpUrl } from "./lib/supabase/local-url";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "1",
  analyzerMode: "json",
  openAnalyzer: false,
});

const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  process.env.NODE_ENV === "development" ? "'unsafe-eval'" : null,
  "https://va.vercel-scripts.com",
].filter(Boolean).join(" ");

// WebKit upgrades loopback asset URLs to HTTPS even when the local server only speaks HTTP.
const servesLocalHttp = !process.env.VERCEL
  && loopbackHttpUrl(process.env.NEXT_PUBLIC_APP_URL)?.protocol === "http:";
const localSupabase = process.env.VERCEL ? null : loopbackHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const localSupabaseSource = localSupabase ? ` ${localSupabase.origin}` : "";

const nextConfig: NextConfig = {
  typescript: { tsconfigPath: "tsconfig.check.json" },
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "unavatar.io" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/avatars/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/post-images/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/team-favicons/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/sign/dm-attachments/**" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "motion/react", "recharts"],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // HTML and Markdown share canonical URLs; keep CDN variants isolated.
          { key: "Vary", value: "Accept, Accept-Encoding" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://avatars.githubusercontent.com https://unavatar.io https://*.supabase.co https://api.producthunt.com${localSupabaseSource}`,
              "font-src 'self' data:",
              `connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com${localSupabaseSource}`,
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              ...(servesLocalHttp ? [] : ["upgrade-insecure-requests"]),
            ].join("; "),
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
