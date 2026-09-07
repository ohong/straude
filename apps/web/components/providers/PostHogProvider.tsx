"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useAnalyticsConsent } from "@/components/providers/useAnalyticsConsent";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

declare global {
  interface Window {
    __straudePostHogInitialized?: boolean;
  }
}

/**
 * Wraps posthog-js/react PostHogProvider with deferred initialization.
 *
 * @posthog/next's ClientPostHogProvider calls posthog.init() during render,
 * which injects a <script> before hydration finishes — causing mismatches.
 * We defer init() to useEffect, then gate the manual pageview tracker on a
 * `ready` flag so the initial $pageview isn't dropped before init runs.
 *
 * Also wires Supabase auth state to posthog.identify / posthog.reset so
 * logged-in users carry stable distinct_ids and logout doesn't leak the
 * previous user's identity onto the next session.
 */
export function PostHogClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const analyticsConsent = useAnalyticsConsent();

  useEffect(() => {
    if (!analyticsConsent || !POSTHOG_KEY || initialized.current) return;
    let readyTimer: number | null = null;
    posthog.init(POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2025-05-24",
      capture_pageview: false,
      capture_performance: { web_vitals: true },
      person_profiles: "identified_only",
    });
    initialized.current = true;
    window.__straudePostHogInitialized = true;
    readyTimer = window.setTimeout(() => setReady(true), 0);

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        posthog.reset();
        return;
      }
      if (
        (event === "INITIAL_SESSION" || event === "SIGNED_IN") &&
        session?.user
      ) {
        identifyUser(session.user);
      }
    });

    return () => {
      if (readyTimer !== null) window.clearTimeout(readyTimer);
      subscription.unsubscribe();
    };
  }, [analyticsConsent]);

  return (
    <PHProvider client={posthog}>
      <WebVitalsReporter ready={ready} />
      <Suspense fallback={null}>
        <PageviewTracker ready={ready} />
      </Suspense>
      {children}
    </PHProvider>
  );
}

type WebVitalsMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

type TtfbSample = {
  metric: WebVitalsMetric;
  currentUrl: string;
  pathname: string;
};

/**
 * PostHog's built-in web-vitals capture omits TTFB. Keep this reporter limited
 * to TTFB so LCP, CLS, FCP, and INP are not counted twice.
 */
export function WebVitalsReporter({ ready }: { ready: boolean }) {
  const [ttfbSample, setTtfbSample] = useState<TtfbSample | null>(null);
  const reportedMetricIds = useRef(new Set<string>());
  const reportWebVitals = useCallback((metric: WebVitalsMetric) => {
    if (metric.name !== "TTFB") return;

    setTtfbSample({
      metric,
      currentUrl: window.location.href,
      pathname: window.location.pathname,
    });
  }, []);

  useReportWebVitals(reportWebVitals);

  useEffect(() => {
    if (
      !ready ||
      !ttfbSample ||
      reportedMetricIds.current.has(ttfbSample.metric.id)
    ) {
      return;
    }

    reportedMetricIds.current.add(ttfbSample.metric.id);
    posthog.capture("web_vital_ttfb", {
      metric_name: "TTFB",
      value_ms: ttfbSample.metric.value,
      metric_id: ttfbSample.metric.id,
      rating: ttfbSample.metric.rating,
      navigation_type: ttfbSample.metric.navigationType,
      pathname: ttfbSample.pathname,
      $current_url: ttfbSample.currentUrl,
    });
  }, [ready, ttfbSample]);

  return null;
}

function PageviewTracker({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ready || !pathname) return;
    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    const url = `${window.location.origin}${path}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [ready, pathname, searchParams]);

  return null;
}

function identifyUser(user: User) {
  const meta = user.user_metadata ?? {};
  posthog.identify(user.id, {
    email: user.email,
    github_username: meta.user_name,
    avatar_url: meta.avatar_url,
  });
}
