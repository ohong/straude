"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export interface CrewMember {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export function CrewPopover({
  count,
  members,
}: {
  count: number;
  members: CrewMember[];
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        className="flex flex-col text-left"
        aria-label={`Crew: ${count} recruited user${count === 1 ? "" : "s"}`}
      >
        <p className="text-[0.7rem] uppercase tracking-widest text-muted">
          Crew
        </p>
        <p className="inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-lg font-medium tabular-nums">
          <Users size={16} className="text-accent" />
          {count}
        </p>
      </button>

      <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden min-w-[180px] rounded-md border border-border bg-background p-2 shadow-lg group-hover:pointer-events-auto group-hover:block group-focus-within:pointer-events-auto group-focus-within:block">
        <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted">
          Recruited
        </p>
        <ul className="flex flex-col gap-1.5">
          {members.map((member) => (
            <li key={member.username}>
              <Link
                href={`/u/${member.username}`}
                className="flex items-center gap-2 rounded-[4px] px-1.5 py-1 text-sm hover:bg-subtle transition-colors"
              >
                <Avatar
                  src={member.avatar_url}
                  alt={member.username}
                  size="xs"
                  fallback={member.username}
                />
                <span className="truncate font-medium">
                  {member.display_name ?? `@${member.username}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
