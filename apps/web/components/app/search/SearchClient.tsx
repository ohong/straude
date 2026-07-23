"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import type { User } from "@/types";
import { Avatar } from "@/components/ui/Avatar";

export type SearchUser = Pick<
  User,
  "id" | "username" | "display_name" | "bio" | "avatar_url" | "is_public"
>;

export default function SearchClient({
  initialQuery,
  initialResults,
}: {
  initialQuery: string;
  initialResults: SearchUser[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchUser[]>(initialResults);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleSearch(value: string) {
    setQuery(value);
    clearTimeout(timerRef.current);

    if (value.length < 2) {
      setResults([]);
      setLoading(false);
      router.replace("/search", { scroll: false });
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ q: value });
      router.replace(`/search?${params.toString()}`, { scroll: false });

      const res = await fetch(`/api/search?q=${encodeURIComponent(value)}&limit=20`);
      const data = await res.json().catch(() => ({}));
      setResults(res.ok ? (data.users ?? []) : []);
      setLoading(false);
    }, 300);
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background px-[var(--app-page-padding-x)] py-3">
        <div className="flex items-center gap-3 rounded-[4px] border border-border px-4 py-2 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by username or email"
            aria-label="Search users"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
        </div>
      </header>

      <div>
        {query.length < 2 && !loading && results.length === 0 && (
          <p className="px-[var(--app-page-padding-x)] py-8 text-center text-sm text-muted">
            Search by username or email
          </p>
        )}
        {loading && (
          <p className="px-[var(--app-page-padding-x)] py-8 text-center text-sm text-muted">Searching&hellip;</p>
        )}
        {!loading && query.length >= 2 && results.length === 0 && (
          <p className="px-[var(--app-page-padding-x)] py-8 text-center text-sm text-muted">
            No users found for &ldquo;{query}&rdquo;
          </p>
        )}
        {results.map((user) => {
          const content = (
            <>
              <Avatar
                src={user.avatar_url}
                alt={user.username ?? user.display_name ?? ""}
                fallback={user.display_name ?? user.username ?? "?"}
                size="md"
              />
              <div className="flex-1 overflow-hidden">
                <p className="font-medium">
                  {user.username
                    ? user.username
                    : user.display_name ?? "New user"}
                </p>
                {user.username ? (
                  user.bio && (
                    <p className="truncate text-sm text-muted">{user.bio}</p>
                  )
                ) : (
                  <p className="text-sm text-muted">
                    Hasn&apos;t set up their profile yet
                  </p>
                )}
              </div>
            </>
          );

          return user.username ? (
            <Link
              key={user.id}
              href={`/u/${user.username}`}
              className="flex items-center gap-4 border-b border-border px-[var(--app-page-padding-x)] py-4 hover:bg-subtle"
            >
              {content}
            </Link>
          ) : (
            <div
              key={user.id}
              className="flex items-center gap-4 border-b border-border px-[var(--app-page-padding-x)] py-4"
            >
              {content}
            </div>
          );
        })}
      </div>
    </>
  );
}
