import type { Metadata } from "next";
import { CookieConsentModal } from "@/components/landing/CookieConsentModal";

export const metadata: Metadata = {
  title: { absolute: "Straude — Strava for Claude Code" },
  description:
    "Track your Claude Code usage, share your wins, and compete on the leaderboard. The social platform for AI-assisted coding.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <CookieConsentModal />
    </>
  );
}
