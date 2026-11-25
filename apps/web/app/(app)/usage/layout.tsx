import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Usage",
  description: "Your spend and tokens by tool, model and day.",
};

export default function UsageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
