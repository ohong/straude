"use client";

import { useState } from "react";
import { UserPlus, Check } from "lucide-react";

export function InviteButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(`https://straude.com/join/${username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 border border-border px-3 py-1 text-sm font-semibold hover:bg-subtle"
      style={{ borderRadius: 4 }}
    >
      {copied ? (
        <>
          <Check size={14} className="text-accent" />
          Copied
        </>
      ) : (
        <>
          <UserPlus size={14} />
          Invite
        </>
      )}
    </button>
  );
}
