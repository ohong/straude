import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { DevAgentation } from "@/components/dev/DevAgentation";
import { getThemeBootstrapScript } from "@/lib/theme";
import {
  organizationJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from "@/lib/structured-data";
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
    "Log daily usage from Claude Code, Codex, and other coding tools. Track tokens, estimated API cost, and streaks.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Straude",
    title: "Straude — Code like an athlete.",
    description:
      "Log daily usage from Claude Code, Codex, and other coding tools. Track tokens, estimated API cost, and streaks.",
    locale: "en_US",
    url: "https://straude.com",
    images: [
      {
        url: "/og-image.png?v=2",
        width: 1200,
        height: 630,
        alt: "Straude — Code like an athlete. Daily coding activity, estimated cost, and streaks.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Straude — Code like an athlete.",
    description:
      "Log daily usage from Claude Code, Codex, and other coding tools. Track tokens, estimated API cost, and streaks.",
    images: [
      {
        url: "/og-image.png?v=2",
        width: 1200,
        height: 630,
        alt: "Straude — Code like an athlete. Daily coding activity, estimated cost, and streaks.",
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
            __html: serializeJsonLd(websiteJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(organizationJsonLd),
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
        {children}
        <DevAgentation />
      </body>
    </html>
  );
}
