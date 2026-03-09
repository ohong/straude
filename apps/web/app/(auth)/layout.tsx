import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in to Straude",
  description:
    "Sign in or create an account to start tracking your Claude Code sessions on Straude.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
