"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { BoltIcon } from "@/components/landing/icons";

export function Navbar({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authHref, setAuthHref] = useState("/signup");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem("straude_returning")) setAuthHref("/login");
    } catch {}
  }, []);

  // Focus trap, Escape handler, and body scroll lock when mobile menu is open
  useEffect(() => {
    if (!mobileOpen) return;

    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      // Focus trap
      if (e.key === "Tab" && menuRef.current) {
        const focusable = menuRef.current.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    // Focus first link on open
    requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector<HTMLElement>("a, button");
      first?.focus();
    });

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  const light = variant === "light";
  const text = light ? "text-foreground" : "text-landing-text";
  const hoverCta = light ? "hover:text-foreground" : "hover:text-landing-text";
  const mobileBg = light
    ? "border-border bg-background/95"
    : "border-landing-border bg-landing-bg/95";

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
            href="/token-rich"
            className={`${text} hover:text-accent transition-colors`}
          >
            Prometheus List
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
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            ref={menuRef}
            className={`md:hidden border-t ${mobileBg} backdrop-blur-md px-8 pb-8 pt-6`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            role="dialog"
            aria-label="Mobile navigation"
          >
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
                href="/token-rich"
                className={text}
                onClick={() => setMobileOpen(false)}
              >
                Prometheus List
              </Link>
              <Link
                href={authHref}
                className="text-accent"
                onClick={() => setMobileOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
