"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { PostHogPageView } from "@posthog/next";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY!;

/**
 * Wraps posthog-js/react PostHogProvider with deferred initialization.
 *
 * @posthog/next's built-in ClientPostHogProvider calls posthog.init() during
 * the render phase, which injects a <script> into the DOM before React
 * finishes hydration — causing hydration mismatches. This wrapper defers
 * init() to useEffect so scripts are only injected after hydration.
 */
export function PostHogClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!POSTHOG_KEY || initialized.current) return;
    posthog.init(POSTHOG_KEY, {
      api_host: "/ingest",
      capture_pageview: false, // PostHogPageView handles this
    });
    initialized.current = true;
  }, []);

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
