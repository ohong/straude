"use client";

import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
  type Action,
} from "kbar";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/providers/ThemeProvider";
import { createClient } from "@/lib/supabase/client";

function RenderResults() {
  const { results } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === "string" ? (
          <div className="px-4 py-2 text-xs uppercase text-muted">{item}</div>
        ) : (
          <div
            className={`flex cursor-pointer items-center justify-between px-4 py-3 text-sm ${
              active ? "bg-hover text-accent" : "text-foreground"
            }`}
          >
            <span>{item.name}</span>
            {item.shortcut && item.shortcut.length > 0 && (
              <span className="flex gap-1">
                {item.shortcut.map((key) => (
                  <kbd
                    key={key}
                    className="rounded border border-border bg-subtle px-1.5 py-0.5 font-mono text-xs text-muted"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            )}
          </div>
        )
      }
    />
  );
}

export function CommandPalette({
  username,
  children,
}: {
  username?: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();

  const actions: Action[] = [
    {
      id: "feed",
      name: "Feed",
      shortcut: ["g", "f"],
      perform: () => router.push("/feed"),
    },
    {
      id: "leaderboard",
      name: "Leaderboard",
      shortcut: ["g", "l"],
      perform: () => router.push("/leaderboard"),
    },
    {
      id: "search",
      name: "Search",
      shortcut: ["/"],
      perform: () => router.push("/search"),
    },
    {
      id: "settings",
      name: "Settings",
      shortcut: ["g", "s"],
      perform: () => router.push("/settings"),
    },
    {
      id: "new-post",
      name: "New Post",
      shortcut: ["c"],
      perform: () => router.push("/post/new"),
    },
    {
      id: "recap",
      name: "Recap",
      shortcut: ["g", "r"],
      perform: () => router.push("/recap"),
    },
    {
      id: "prompts",
      name: "Prompts",
      shortcut: ["g", "p"],
      perform: () => router.push("/prompts"),
    },
    {
      id: "profile",
      name: "Profile",
      shortcut: ["g", "m"],
      perform: () => router.push(username ? `/u/${username}` : "/feed"),
    },
    {
      id: "logout",
      name: "Log out",
      section: "Account",
      shortcut: [],
      perform: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
      },
    },
    {
      id: "theme-light",
      name: "Light theme",
      section: "Theme",
      shortcut: [],
      perform: () => setTheme("light"),
    },
    {
      id: "theme-dark",
      name: "Dark theme",
      section: "Theme",
      shortcut: [],
      perform: () => setTheme("dark"),
    },
    {
      id: "theme-system",
      name: "System theme",
      section: "Theme",
      shortcut: [],
      perform: () => setTheme("system"),
    },
  ];

  return (
    <KBarProvider actions={actions}>
      <KBarPortal>
        <KBarPositioner className="z-50 bg-overlay">
          <KBarAnimator className="mx-auto mt-[20vh] w-full max-w-[600px] rounded-[4px] border border-border bg-background">
            <KBarSearch className="w-full border-b border-border bg-background px-4 py-3 font-mono text-base text-foreground outline-none placeholder:text-muted" />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </KBarProvider>
  );
}
