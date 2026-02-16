import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Stats } from "@/components/landing/Stats";
import { Testimonial } from "@/components/landing/Testimonial";
import { WallOfLove } from "@/components/landing/WallOfLove";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { wallOfLovePosts } from "@/content/wall-of-love";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Testimonial />
        <Features />
        <HowItWorks />
        <WallOfLove posts={wallOfLovePosts} />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
