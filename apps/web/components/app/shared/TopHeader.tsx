"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Bell, Plus, Upload, PenSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";

interface TopHeaderProps {
  username: string | null;
  avatarUrl: string | null;
}

const navLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/search", label: "Search" },
] as const;

export function TopHeader({ username, avatarUrl }: TopHeaderProps) {
  const pathname = usePathname();
  const [plusOpen, setPlusOpen] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plusOpen) return;
    function handleClick(e: MouseEvent) {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) {
        setPlusOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [plusOpen]);

  return (
    <header className="sticky top-0 z-20 hidden border-b border-border bg-background lg:block">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 lg:px-6">
        {/* Left — Brand */}
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span
            className="inline-block h-5 w-5 bg-accent"
            style={{
              clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
            }}
          />
          STRAUDE
        </Link>

        {/* Center — Nav */}
        <nav className="flex items-center gap-6">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "pb-0.5 text-sm font-medium transition-colors",
                  active
                    ? "border-b-2 border-accent text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right — Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/notifications"
            className="text-muted hover:text-foreground"
          >
            <Bell size={20} />
          </Link>

          <Link href={`/u/${username ?? ""}`}>
            <Avatar
              src={avatarUrl}
              size="xs"
              fallback={username || "?"}
            />
          </Link>

          <div ref={plusRef} className="relative">
            <button
              type="button"
              onClick={() => setPlusOpen((v) => !v)}
              className="rounded p-1.5 text-muted hover:bg-subtle hover:text-foreground"
            >
              <Plus size={20} />
            </button>

            {plusOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded border border-border bg-background shadow-lg">
                <Link
                  href="/settings/import"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-subtle"
                  onClick={() => setPlusOpen(false)}
                >
                  <Upload size={16} />
                  Upload Activity
                </Link>
                <Link
                  href="/settings/import"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-subtle"
                  onClick={() => setPlusOpen(false)}
                >
                  <PenSquare size={16} />
                  Create Post
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
