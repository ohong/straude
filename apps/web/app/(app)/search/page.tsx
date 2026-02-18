"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import type { User } from "@/types";
import { Avatar } from "@/components/ui/Avatar";

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      // Reflect search query in URL for deep-linking
      const params = new URLSearchParams({ q: query });
      router.replace(`/search?${params.toString()}`, { scroll: false });

      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
      const data = await res.json();
      setResults(data.users ?? []);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [query, router]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background px-6 py-3">
        <div className="flex items-center gap-3 rounded-[4px] border border-border px-4 py-2 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ThariqS, adocomplete, lydiahallie"
            autoFocus
            aria-label="Search users"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
        </div>
      </header>

      <div>
        {query.length < 2 && !loading && results.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-muted">
            Search for users by username
          </p>
        )}
        {loading && (
          <p className="px-6 py-8 text-center text-sm text-muted">Searching&hellip;</p>
        )}
        {!loading && query.length >= 2 && results.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-muted">
            No users found for &ldquo;{query}&rdquo;
          </p>
        )}
        {results.map((user) => {
          const hasProfile = !!user.username;
          const Wrapper = hasProfile ? Link : "div";
          const wrapperProps = hasProfile
            ? { href: `/u/${user.username}` }
            : {};

          return (
            <Wrapper
              key={user.id}
              {...(wrapperProps as any)}
              className="flex items-center gap-4 border-b border-border px-6 py-4 hover:bg-subtle"
            >
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
            </Wrapper>
          );
        })}
      </div>
    </>
  );
}
