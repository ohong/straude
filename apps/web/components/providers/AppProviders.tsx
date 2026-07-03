"use client";

import { ConsentAwareAnalytics } from "@/components/providers/ConsentAwareAnalytics";
import { PostHogClientProvider } from "@/components/providers/PostHogProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PostHogClientProvider>
      <QueryProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryProvider>
      <ConsentAwareAnalytics />
    </PostHogClientProvider>
  );
}
