import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Agentation } from "agentation";
import Script from "next/script";
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
      <body
        className="bg-background font-[family-name:var(--font-main)] text-foreground antialiased"
        style={{ isolation: "isolate", position: "relative" }}
      >
        <Script id="straude-theme" strategy="beforeInteractive">
          {getThemeBootstrapScript()}
        </Script>
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
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
