"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { ProductHuntBadge } from "./ProductHuntBadge";
import { useClipboardFeedback } from "@/lib/utils/useClipboardFeedback";

function CopySnippet({ command }: { command: string }) {
  const { copied, copyText } = useClipboardFeedback();

  return (
    <button
      type="button"
      onClick={() => void copyText(command)}
      className="inline-flex cursor-pointer items-center gap-4 border border-landing-border bg-landing-panel px-4 py-3 font-[family-name:var(--font-mono)] text-sm text-landing-muted transition-[border-color,transform] hover:border-landing-dim active:scale-[0.97]"
    >
      ${" "}
      <span className="text-landing-text">{command}</span>
      {copied && (
        <Check size={16} className="text-accent" aria-hidden="true" />
      )}
    </button>
  );
}

export function Hero() {
  return (
    <header className="min-h-screen flex flex-col justify-center px-8 lg:px-16 pt-32 relative">
      <div className="max-w-[900px]">
        <div className="mb-6">
          <ProductHuntBadge />
        </div>
        <p className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-landing-muted mb-4">
          {"// STRAVA FOR CLAUDE CODE"}
        </p>

        <h1 className="text-[clamp(3rem,8vw,7rem)] font-medium tracking-[-0.03em] leading-[1.1] text-landing-text text-balance mb-8">
          Code like
          <br />
          an athlete.
        </h1>

        <p className="font-[family-name:var(--font-mono)] text-base text-landing-muted max-w-[500px]">
          One command to log your Claude Code usage. Track spend, compare
          pace, keep the streak alive.
        </p>

        <div className="flex flex-wrap gap-4 mt-10">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center bg-accent text-landing-bg font-[family-name:var(--font-mono)] text-sm font-bold uppercase px-8 py-4 border border-accent hover:bg-transparent hover:text-accent active:scale-[0.97] transition-all duration-200"
          >
            Start Your Streak
          </Link>
          <CopySnippet command="npx straude" />
        </div>

        {/* Terminal output */}
        <div className="mt-10 font-[family-name:var(--font-mono)] text-[0.8rem] text-landing-muted leading-relaxed max-w-[600px]">
          <span className="block text-landing-text">
            &gt; npx straude
          </span>
          <span className="block">Analyzing ~/.config/claude/projects/...</span>
          <span className="block">
            Tokens: <span className="text-landing-text">27.8M</span> (input:{" "}
            <span className="text-landing-text">963k</span>, output:{" "}
            <span className="text-landing-text">75k</span>)
          </span>
          <span className="block">
            Models: <span className="text-landing-text">opus-4-6, claude-sonnet-4-6, claude-haiku-4-5</span>
          </span>
          <span className="block">
            Est. Cost: <span className="text-accent">$19.93</span>
          </span>
          <span className="block text-accent">
            [OK] Session logged. Current streak: 18 days {"🔥"}
          </span>
        </div>
      </div>
    </header>
  );
}
