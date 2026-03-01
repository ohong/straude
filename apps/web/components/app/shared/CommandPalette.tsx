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
            className={`flex cursor-pointer items-center px-4 py-3 text-sm ${
              active ? "bg-hover text-accent" : "text-foreground"
            }`}
          >
            {item.name}
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

  const actions: Action[] = [
    {
      id: "feed",
      name: "Feed",
      shortcut: [],
      perform: () => router.push("/feed"),
    },
    {
      id: "leaderboard",
      name: "Leaderboard",
      shortcut: [],
      perform: () => router.push("/leaderboard"),
    },
    {
      id: "search",
      name: "Search",
      shortcut: [],
      perform: () => router.push("/search"),
    },
    {
      id: "settings",
      name: "Settings",
      shortcut: [],
      perform: () => router.push("/settings"),
    },
    {
      id: "new-post",
      name: "New Post",
      shortcut: [],
      perform: () => router.push("/post/new"),
    },
    {
      id: "recap",
      name: "Recap",
      shortcut: [],
      perform: () => router.push("/recap"),
    },
    {
      id: "profile",
      name: "Profile",
      shortcut: [],
      perform: () => router.push(username ? `/u/${username}` : "/feed"),
    },
  ];

  return (
    <KBarProvider actions={actions}>
      <KBarPortal>
        <KBarPositioner className="z-50 bg-foreground/40">
          <KBarAnimator className="mx-auto mt-[20vh] w-full max-w-[600px] rounded-[4px] border border-border bg-background">
            <KBarSearch className="w-full border-b border-border bg-background px-4 py-3 font-mono text-base text-foreground outline-none" />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {children}
    </KBarProvider>
  );
}
