"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const navLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

export function GuestHeader() {
  const pathname = usePathname();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <div
            className="h-5 w-5 bg-accent"
            style={{
              clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
            }}
          />
          <span className="text-base font-semibold tracking-tight">
            STRAUDE
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-subtle text-foreground"
                  : "text-muted hover:text-foreground"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="text-sm font-medium text-muted hover:text-foreground transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition-[filter] duration-150"
        >
          Sign up
        </Link>
      </div>
    </header>
  );
}
