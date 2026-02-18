import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Agentation } from "agentation";
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
  openGraph: {
    type: "website",
    siteName: "Straude",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-[family-name:var(--font-main)] antialiased" style={{ isolation: "isolate", position: "relative" }}>
        {children}
        <Analytics />
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
