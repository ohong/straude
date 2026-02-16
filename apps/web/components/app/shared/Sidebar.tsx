"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ username }: { username: string | null }) {
  const pathname = usePathname();

  return (
    <>
      {/* Brand */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <Link href="/feed" className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span
            className="inline-block h-6 w-6 bg-accent"
            style={{ clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)" }}
          />
          STRAUDE
        </Link>
      </div>

      {/* Nav */}
      <nav>
        <ul>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const resolvedHref = label === "Profile" && username ? `/u/${username}` : href;
            const isActive =
              label === "Profile"
                ? pathname.startsWith("/u/")
                : pathname.startsWith(href);

            return (
              <li key={href} className="border-b border-border">
                <Link
                  href={resolvedHref}
                  className={cn(
                    "flex items-center justify-between px-4 py-4 text-[1.1rem] hover:bg-subtle",
                    isActive && "border-l-4 border-l-accent pl-[calc(1rem-4px)]"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={20} />
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Spacer + bottom stat */}
      <div className="mt-auto border-t border-border p-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
          Current Goal
        </p>
        <p className="font-[family-name:var(--font-mono)] text-[2.5rem] leading-none tracking-tight" style={{ letterSpacing: "-0.03em" }}>
          0
        </p>
        <p className="mt-1 text-sm">Days streaked</p>
      </div>
    </>
  );
}
