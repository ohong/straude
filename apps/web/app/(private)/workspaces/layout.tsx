import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Private workspaces — Straude",
  description: "Review and share work usage in a private Straude workspace.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function WorkspacesLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="border-b border-border"><nav aria-label="Workspace navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5"><Link href="/workspaces" className="font-mono text-lg font-semibold">STRAUDE <span className="text-accent">/ TEAMS</span></Link><Link href="/workspaces" className="text-sm underline underline-offset-4">Workspaces</Link><Link href="/recap" className="text-sm underline underline-offset-4">Personal recap</Link><Link href="/feed" className="text-sm underline underline-offset-4">Community</Link><Link href="/settings" className="text-sm underline underline-offset-4">Settings</Link></nav></header>
    <main id="main-content" className="mx-auto max-w-6xl px-5 py-8 sm:py-12">{children}</main>
  </div>;
}
