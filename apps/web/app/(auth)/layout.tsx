import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in to Straude",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
