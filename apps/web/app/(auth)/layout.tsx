import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in to Straude",
  description:
    "Sign in or create an account to start tracking your Claude Code sessions on Straude.",
  alternates: { canonical: "/login" },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
