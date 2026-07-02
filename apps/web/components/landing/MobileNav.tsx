"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { trackActivationEvent } from "@/lib/analytics/client";

const NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/token-rich", label: "Prometheus List" },
] as const;

export function MobileNav({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const light = variant === "light";
  const text = light ? "text-foreground" : "text-landing-text";
  const mobileBg = light
    ? "border-border bg-background/95"
    : "border-landing-border bg-landing-bg/95";

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab" || !menuRef.current) return;

      const focusable = menuRef.current.querySelectorAll<HTMLElement>(
        'a, button, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  return (
    <>
      <button
        type="button"
        className={`md:hidden ${text}`}
        onClick={() => setMobileOpen((open) => !open)}
        aria-label="Toggle menu"
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {mobileOpen && (
        <div
          ref={menuRef}
          className={`md:hidden border-t ${mobileBg} px-8 pb-8 pt-6 backdrop-blur-md`}
          role="dialog"
          aria-label="Mobile navigation"
        >
          <div className="flex flex-col gap-6 font-[family-name:var(--font-mono)] text-sm uppercase">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={text}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/signup"
              className="text-accent"
              onClick={() => {
                trackActivationEvent("landing_primary_cta_clicked", {
                  surface: "landing",
                  cta_location: "nav_mobile",
                  destination: "/signup",
                  activation_state: "anonymous",
                  is_authenticated: false,
                });
                setMobileOpen(false);
              }}
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
