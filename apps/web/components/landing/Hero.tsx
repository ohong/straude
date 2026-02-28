"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

function CopySnippet({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [command]);

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-4 border border-[#222] bg-black/50 px-4 py-3 font-[family-name:var(--font-mono)] text-sm text-[#888] hover:border-[#444] transition-colors cursor-pointer"
    >
      ${" "}
      <span className="text-[#F0F0F0]">{command}</span>
      {copied && (
        <svg
          className="h-4 w-4 text-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </button>
  );
}

export function Hero() {
  return (
    <header className="min-h-screen flex flex-col justify-center px-8 lg:px-16 pt-32 relative">
      <div className="max-w-[900px]">
        <p className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-wider text-[#888] mb-4">
          // STRAVA FOR CLAUDE CODE
        </p>

        <h1 className="text-[clamp(3rem,8vw,7rem)] font-medium tracking-[-0.03em] leading-[1.1] text-[#F0F0F0] mb-8">
          Code like
          <br />
          an athlete.
        </h1>

        <p className="font-[family-name:var(--font-mono)] text-base text-[#888] max-w-[500px]">
          One command to log your Claude Code output. Track your spend, compare
          your pace, keep the streak alive.
        </p>

        <div className="flex flex-wrap gap-4 mt-10">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center bg-accent text-[#050505] font-[family-name:var(--font-mono)] text-sm font-bold uppercase px-8 py-4 border border-accent hover:bg-transparent hover:text-accent transition-all duration-200"
          >
            Start Your Streak
          </Link>
          <CopySnippet command="npx straude@latest" />
        </div>

        {/* Terminal output */}
        <div className="mt-10 font-[family-name:var(--font-mono)] text-[0.8rem] text-[#888] leading-relaxed max-w-[600px]">
          <span className="block text-[#F0F0F0]">
            &gt; straude scan --session current
          </span>
          <span className="block">Analyzing ~/.config/claude/projects/...</span>
          <span className="block">
            Tokens: <span className="text-[#F0F0F0]">27.8M</span> (input:{" "}
            <span className="text-[#F0F0F0]">963k</span>, output:{" "}
            <span className="text-[#F0F0F0]">75k</span>)
          </span>
          <span className="block">
            Models: <span className="text-[#F0F0F0]">opus-4-6, claude-sonnet-4-6, claude-haiku-4-5</span>
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
