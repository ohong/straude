import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Stats } from "@/components/landing/Stats";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WallOfLove } from "@/components/landing/WallOfLove";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { wallOfLovePosts } from "@/content/wall-of-love";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Straude — Strava for Claude Code",
  description:
    "One command to log your Claude Code output. Track your spend, compare your pace, keep the streak alive.",
};

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <ProductShowcase />
        <Features />
        <HowItWorks />
        <WallOfLove posts={wallOfLovePosts} />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
