"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/utils/format";
import type { CompanySuggestionStatus } from "@/types";

type AdminSuggestionRow = {
  id: string;
  company_name: string;
  company_url: string;
  policy_description: string;
  source_url: string;
  status: CompanySuggestionStatus;
  is_hidden: boolean;
  created_at: string;
  user?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
};

const FILTERS: Array<{ value: "all" | CompanySuggestionStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "all", label: "All" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "published", label: "Published" },
];

const STATUS_OPTIONS: CompanySuggestionStatus[] = [
  "new",
  "accepted",
  "rejected",
  "published",
];

function statusLabel(status: CompanySuggestionStatus): string {
  return status[0]!.toUpperCase() + status.slice(1);
}

export function CompanySuggestionsInbox({
  initialSuggestions,
}: {
  initialSuggestions: AdminSuggestionRow[];
}) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [filter, setFilter] = useState<"all" | CompanySuggestionStatus>("new");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const next = {
      all: suggestions.length,
      new: 0,
      accepted: 0,
      rejected: 0,
      published: 0,
    };
    for (const s of suggestions) {
      next[s.status] += 1;
    }
    return next;
  }, [suggestions]);

  const filtered = useMemo(() => {
    if (filter === "all") return suggestions;
    return suggestions.filter((s) => s.status === filter);
  }, [filter, suggestions]);

  async function patchSuggestion(id: string, payload: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/company-suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Update failed");
        return;
      }
      const updated = body.suggestion as AdminSuggestionRow;
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updated } : s)),
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="admin-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Company Suggestions</h3>
          <p className="text-sm" style={{ color: "var(--admin-fg-secondary)" }}>
            Review user-submitted company suggestions for The Prometheus List.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className="rounded-[4px] border px-2.5 py-1.5 text-xs font-medium"
            style={{
              borderColor: "var(--admin-border)",
              background: filter === item.value ? "var(--admin-pill-active-bg)" : "var(--admin-pill-bg)",
              color: filter === item.value ? "var(--admin-pill-active-fg)" : "var(--admin-fg-secondary)",
            }}
          >
            {item.label}
            <span className="ml-1 tabular-nums opacity-75">
              ({item.value === "all" ? counts.all : counts[item.value]})
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 text-sm" style={{ color: "#C94A4A" }} role="alert">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--admin-fg-secondary)" }}>
          No suggestions in this filter.
        </p>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--admin-border)" }}>
          {filtered.map((row) => {
            const username = row.user?.username ?? null;
            const isSaving = savingId === row.id;
            return (
              <article key={row.id} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {username ? (
                      <Link href={`/u/${username}`} className="font-semibold" style={{ color: "var(--admin-accent)" }}>
                        @{username}
                      </Link>
                    ) : (
                      <span className="font-semibold" style={{ color: "var(--admin-fg-secondary)" }}>
                        Unknown user
                      </span>
                    )}
                    <span suppressHydrationWarning style={{ color: "var(--admin-fg-secondary)" }}>
                      {timeAgo(row.created_at)}
                    </span>
                    {row.is_hidden && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          background: "var(--admin-pill-bg)",
                          color: "var(--admin-fg-secondary)",
                        }}
                      >
                        Hidden
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={row.status}
                      onChange={(e) => {
                        void patchSuggestion(row.id, { status: e.target.value });
                      }}
                      disabled={isSaving}
                      className="rounded-[4px] border px-2 py-1 text-xs"
                      style={{
                        borderColor: "var(--admin-border)",
                        background: "var(--admin-card)",
                        color: "var(--admin-fg)",
                      }}
                      aria-label={`Status for suggestion ${row.company_name}`}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        void patchSuggestion(row.id, { is_hidden: !row.is_hidden });
                      }}
                      className="rounded-[4px] border px-2 py-1 text-xs"
                      style={{
                        borderColor: "var(--admin-border)",
                        color: "var(--admin-fg-secondary)",
                      }}
                    >
                      {row.is_hidden ? "Unhide" : "Hide"}
                    </button>
                  </div>
                </div>

                <p className="text-sm font-medium">{row.company_name}</p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--admin-fg-secondary)" }}>
                  {row.policy_description}
                </p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs" style={{ color: "var(--admin-fg-secondary)" }}>
                  <a href={row.company_url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "var(--admin-accent)" }}>
                    Website
                  </a>
                  <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "var(--admin-accent)" }}>
                    Source
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
