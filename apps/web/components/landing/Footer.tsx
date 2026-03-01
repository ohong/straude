"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BoltIcon } from "@/components/landing/icons";

export function Footer() {
  const [utc, setUtc] = useState("UTC 00:00:00");

  useEffect(() => {
    function tick() {
      setUtc(`UTC ${new Date().toISOString().substring(11, 19)}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="border-t border-landing-border px-8 py-10 flex flex-col gap-8 md:flex-row md:justify-between md:items-end">
      {/* Brand */}
      <div className="flex items-center gap-2 font-[family-name:var(--font-mono)] font-bold text-base text-landing-text">
        <BoltIcon className="w-4 h-4 text-accent" />
        STRAUDE
      </div>

      {/* Status */}
      <div className="font-[family-name:var(--font-mono)] text-xs text-landing-muted flex flex-col gap-1">
        <div>
          STATUS: <span className="text-accent">ONLINE</span>
        </div>
        <div>SYS LATENCY: 12ms</div>
        <div suppressHydrationWarning>{utc}</div>
      </div>

      {/* Links + copyright */}
      <div className="font-[family-name:var(--font-mono)] text-xs text-landing-muted flex flex-col gap-1 md:text-right">
        <div className="flex gap-4 md:justify-end">
          <Link
            href="/privacy"
            className="hover:text-landing-text transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:text-landing-text transition-colors"
          >
            Terms
          </Link>
          <a
            href="https://github.com/ohong/straude"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-landing-text transition-colors"
          >
            GitHub
          </a>
        </div>
        <div>&copy; 2026 PACIFIC SYSTEMS, INC. d/b/a STRAUDE</div>
        <div>DESIGNED FOR PEAK PERFORMERS</div>
      </div>
    </footer>
  );
}
