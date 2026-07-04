"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ConsentAwareAnalytics } from "@/components/providers/ConsentAwareAnalytics";
import { useAnalyticsConsent } from "@/components/providers/useAnalyticsConsent";
import { captureConsentedPostHogEvent } from "@/lib/analytics/client";

export function PublicAnalytics() {
  const analyticsConsent = useAnalyticsConsent();

  return (
    <>
      <Suspense fallback={null}>
        <PublicPageviewTracker enabled={analyticsConsent} />
      </Suspense>
      <ConsentAwareAnalytics />
    </>
  );
}

function PublicPageviewTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastCapturedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !pathname) return;

    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    const url = `${window.location.origin}${path}`;

    if (url === lastCapturedUrlRef.current) return;
    lastCapturedUrlRef.current = url;

    void captureConsentedPostHogEvent("$pageview", { $current_url: url });
  }, [enabled, pathname, searchParams]);

  return null;
}
