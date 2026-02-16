import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#0A0A0A] py-16">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-8 px-6 md:flex-row md:justify-between md:px-8">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div
            className="h-5 w-5 bg-accent"
            style={{
              clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
            }}
          />
          <span className="text-sm font-semibold tracking-tight text-white">
            STRAUDE
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6 text-sm text-white/40">
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms
          </Link>
          <a
            href="https://github.com/ohong/straude"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>

        {/* Copyright */}
        <div className="flex flex-col items-center gap-1 text-xs text-white/30 md:items-end">
          <span>Built with Claude Code</span>
          <span>&copy; 2026 Straude</span>
        </div>
      </div>
    </footer>
  );
}
