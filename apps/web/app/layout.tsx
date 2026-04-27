import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Agentation } from "agentation";
import Script from "next/script";
import { PostHogClientProvider } from "@/components/providers/PostHogProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { getThemeBootstrapScript } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-main",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://straude.com"),
  title: {
    default: "Straude",
    template: "%s | Straude",
  },
  description:
    "Strava for Claude Code. Track your AI-assisted coding sessions, share your wins, and compete on the leaderboard.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Straude",
    title: "Straude — Code like an athlete.",
    description:
      "Track your Claude Code spend. Compete with friends. Share your breakthrough sessions.",
    locale: "en_US",
    url: "https://straude.com",
    images: [
      {
        url: "/og-image.png?v=2",
        width: 1200,
        height: 630,
        alt: "Straude — Code like an athlete. Track your Claude Code spend, compete with friends, share your breakthrough sessions.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Straude — Code like an athlete.",
    description:
      "Track your Claude Code spend. Compete with friends. Share your breakthrough sessions.",
    images: [
      {
        url: "/og-image.png?v=2",
        width: 1200,
        height: 630,
        alt: "Straude — Code like an athlete. Track your Claude Code spend, compete with friends, share your breakthrough sessions.",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Straude",
              url: "https://straude.com",
              description:
                "Strava for Claude Code. Track your AI-assisted coding sessions, share your wins, and compete on the leaderboard.",
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Straude",
              url: "https://straude.com",
              logo: "https://straude.com/icon.svg",
              description:
                "Strava for Claude Code. Track your AI-assisted coding sessions, share your wins, and compete on the leaderboard.",
              sameAs: ["https://github.com/ohong/straude"],
            }),
          }}
        />
      </head>
      <body
        className="bg-background font-[family-name:var(--font-main)] text-foreground antialiased"
        style={{ isolation: "isolate", position: "relative" }}
      >
        <Script id="straude-theme" strategy="beforeInteractive">
          {getThemeBootstrapScript()}
        </Script>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[4px] focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-foreground"
        >
          Skip to content
        </a>
        <PostHogClientProvider>
          <QueryProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </QueryProvider>
        </PostHogClientProvider>
        <Analytics />
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
