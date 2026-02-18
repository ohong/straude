"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

function CopyCommand({ command }: { command: string }) {
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
      className="group/copy inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.08] px-4 py-2 font-[family-name:var(--font-mono)] text-sm text-white/70 backdrop-blur-sm transition-[border-color,background-color,color] duration-150 hover:border-white/30 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <span>{command}</span>
      {copied ? (
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
      ) : (
        <svg
          className="h-4 w-4 opacity-50 transition-opacity group-hover/copy:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

function TerminalMockup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`relative w-full max-w-lg transition-all duration-1000 ${
        visible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-8 scale-95"
      }`}
    >
      {/* Terminal window */}
      <div className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm overflow-hidden shadow-2xl shadow-accent/5">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <div className="h-3 w-3 rounded-full bg-white/20" />
          <div className="h-3 w-3 rounded-full bg-white/20" />
          <div className="h-3 w-3 rounded-full bg-white/20" />
          <span className="ml-2 font-[family-name:var(--font-mono)] text-[11px] text-white/40">
            terminal
          </span>
        </div>

        {/* Terminal content */}
        <div className="p-5 font-[family-name:var(--font-mono)] text-sm">
          <div className="flex items-center gap-2 text-white/50">
            <span className="text-accent">$</span>
            <span className="text-white/90">bunx straude</span>
          </div>
          <div className="mt-3 text-white/40 text-xs leading-relaxed">
            <p>Scanning usage data...</p>
            <p className="mt-1 flex items-center gap-2">
              <span className="text-accent">{">>>"}</span>
              <span className="text-white/70">Found 3 sessions today</span>
            </p>
            <p className="mt-1 flex items-center gap-2">
              <span className="text-accent">{">>>"}</span>
              <span className="text-white/70">$4.82 across 2 models</span>
            </p>
            <p className="mt-1 flex items-center gap-2">
              <span className="text-accent">{">>>"}</span>
              <span className="text-white/70">142,847 tokens</span>
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2">
            <span className="text-accent text-xs font-bold">POSTED</span>
            <span className="text-white/60 text-xs">
              straude.com/u/ohong/feb-18
            </span>
          </div>
        </div>
      </div>

      {/* Glow effect */}
      <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-accent/20 via-transparent to-transparent opacity-40 blur-xl -z-10" />
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-[100vh] overflow-hidden">
      {/* FLUX.2-generated background image */}
      <Image
        src="/hero-bg.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center"
        quality={90}
      />

      {/* Darken overlay for text readability */}
      <div className="pointer-events-none absolute inset-0 bg-black/40 z-[1]" />

      {/* Grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] z-[2]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          animation: "grain 8s steps(10) infinite",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto flex max-w-[1280px] flex-col items-center gap-16 px-6 pt-36 pb-28 md:flex-row md:items-center md:gap-16 md:px-8 md:pt-44 md:pb-36">
        {/* Text */}
        <div className="flex max-w-2xl flex-1 flex-col items-center text-center md:items-start md:text-left">
          <div className="animate-fade-in-up">
            <span className="inline-block font-[family-name:var(--font-mono)] text-xs tracking-[0.2em] uppercase text-accent mb-6">
              Strava for Claude Code
            </span>
          </div>

          <h1
            className="text-[clamp(2.8rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.04em] text-white animate-fade-in-up delay-100"
            style={{ textWrap: "balance" }}
          >
            Every session counts.
          </h1>

          <p
            className="mt-6 text-lg text-white/60 md:text-xl max-w-md animate-fade-in-up delay-200"
            style={{ textWrap: "pretty" }}
          >
            One command to log your Claude Code output. Track your spend,
            compare your pace, keep the streak alive.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up delay-300">
            <Link
              href="/signup"
              className="group relative inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-4 text-base font-bold text-white transition-[filter,box-shadow] duration-150 hover:brightness-110 hover:shadow-lg hover:shadow-accent/20 md:text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-accent"
            >
              Start Your Streak
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
            <CopyCommand command="npx straude@latest" />
          </div>
        </div>

        {/* Terminal mockup */}
        <div className="flex flex-1 items-center justify-center animate-fade-in delay-400">
          <TerminalMockup />
        </div>
      </div>
    </section>
  );
}
