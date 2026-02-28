"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BoltIcon } from "@/components/landing/icons";

export function Navbar({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authHref, setAuthHref] = useState("/signup");

  useEffect(() => {
    try {
      if (localStorage.getItem("straude_returning")) setAuthHref("/login");
    } catch {}
  }, []);

  const light = variant === "light";
  const text = light ? "text-[#111]" : "text-[#F0F0F0]";
  const hoverCta = light ? "hover:text-[#111]" : "hover:text-[#F0F0F0]";
  const mobileBg = light
    ? "border-[#ddd] bg-white/95"
    : "border-[#222] bg-[#050505]/95";

  return (
    <nav className="fixed top-0 left-0 w-full z-50">
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
            href={authHref}
            className={`text-accent ${hoverCta} transition-colors`}
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className={`md:hidden ${text}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className={`md:hidden border-t ${mobileBg} backdrop-blur-md px-8 pb-8 pt-6`}>
          <div className="flex flex-col gap-6 font-[family-name:var(--font-mono)] text-sm uppercase">
            <Link
              href="/feed"
              className={text}
              onClick={() => setMobileOpen(false)}
            >
              Feed
            </Link>
            <Link
              href="/leaderboard"
              className={text}
              onClick={() => setMobileOpen(false)}
            >
              Leaderboard
            </Link>
            <Link
              href={authHref}
              className="text-accent"
              onClick={() => setMobileOpen(false)}
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
