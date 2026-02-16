"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { href: "/feed", label: "Home", icon: Home },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/settings/import", label: "Post", icon: Plus },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileNav({ username }: { username: string | null }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex h-[60px] items-center justify-around border-t border-border bg-background lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const resolvedHref = label === "Profile" && username ? `/u/${username}` : href;
        const isActive =
          label === "Profile"
            ? pathname.startsWith("/u/")
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={resolvedHref}
            className={cn(
              "flex flex-col items-center gap-0.5 text-muted",
              isActive && "text-accent"
            )}
          >
            <Icon size={24} />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
