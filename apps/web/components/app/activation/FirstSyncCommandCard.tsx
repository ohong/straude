"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy } from "lucide-react";
import { trackActivationEvent } from "@/lib/analytics/client";

const SYNC_COMMAND = "npx straude@latest";

export function FirstSyncCommandCard({
  surface,
}: {
  surface: "feed" | "profile";
}) {
  const [copied, setCopied] = useState(false);
  const location = `${surface}_empty_state`;

  function handleCopy() {
    navigator.clipboard.writeText(SYNC_COMMAND).then(() => {
      trackActivationEvent("sync_command_copied", {
        surface: "empty_state",
        cta_location: location,
        command: SYNC_COMMAND,
        activation_state: "sync_command_copied",
        is_authenticated: true,
      });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    });
  }

  return (
    <section
      aria-label="Sync your first session"
      className="mx-auto flex w-full max-w-xl flex-col items-center border border-border bg-subtle px-4 py-5 text-center sm:px-6"
    >
      <p className="text-lg font-medium">Sync your first session</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        Your first sync creates your profile stats, streak, spend totals, and a
        shareable session history.
      </p>

      <button
        type="button"
        onClick={handleCopy}
        className="mt-5 flex w-full max-w-md items-center justify-between gap-3 rounded border border-border bg-background px-4 py-3 font-[family-name:var(--font-mono)] text-sm transition-[border-color,background-color] hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Copy first sync command"
      >
        <span className="truncate text-foreground">{SYNC_COMMAND}</span>
        {copied ? (
          <Check size={16} className="shrink-0 text-accent" aria-hidden="true" />
        ) : (
          <Copy size={16} className="shrink-0 text-muted" aria-hidden="true" />
        )}
      </button>
      <p className="mt-1.5 text-xs text-muted">
        {copied ? "Copied to clipboard" : "Run this after a Claude Code or Codex session"}
      </p>

      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/onboarding"
          onClick={() =>
            trackActivationEvent("first_sync_nudge_clicked", {
              surface: "empty_state",
              cta_location: location,
              destination: "/onboarding",
              activation_state: "signed_up",
              is_authenticated: true,
            })
          }
          className="inline-flex items-center justify-center gap-1.5 rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
        >
          Continue setup
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <Link href="/feed" className="text-sm text-muted hover:text-foreground">
          Browse the feed
        </Link>
      </div>
    </section>
  );
}
