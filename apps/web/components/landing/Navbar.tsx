import Link from "next/link";
import { BoltIcon } from "@/components/landing/icons";
import { SignupCtaLink } from "@/components/landing/LandingActivationActions";
import { MobileNav } from "@/components/landing/MobileNav";

export function Navbar({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const light = variant === "light";
  const text = light ? "text-foreground" : "text-landing-text";
  const hoverCta = light ? "hover:text-foreground" : "hover:text-landing-text";

  return (
    <nav
      className="sticky top-0 left-0 w-full z-50"
    >
      <div className="flex justify-between items-start px-8 py-8">
        {/* Logo */}
        <Link
          href="/"
          className={`flex items-center gap-2 font-[family-name:var(--font-mono)] font-bold text-2xl ${text}`}
        >
          <BoltIcon className="w-6 h-6 text-accent" />
          STRAUDE
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8 font-[family-name:var(--font-mono)] text-sm uppercase">
          <Link
            href="/feed"
            className={`${text} hover:text-accent transition-colors`}
          >
            Feed
          </Link>
          <Link
            href="/leaderboard"
            className={`${text} hover:text-accent transition-colors`}
          >
            Leaderboard
          </Link>
          <Link
            href="/token-rich"
            className={`${text} hover:text-accent transition-colors`}
          >
            Prometheus List
          </Link>
          <SignupCtaLink
            ctaLocation="nav_desktop"
            className={`text-accent ${hoverCta} transition-colors`}
          >
            Get Started
          </SignupCtaLink>
        </div>

        <MobileNav variant={variant} />
      </div>
    </nav>
  );
}
