"use client";

import { Suspense, useEffect, useState } from "react";
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
  const [lastCapturedUrl, setLastCapturedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !pathname) return;

    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    const url = `${window.location.origin}${path}`;

    if (url === lastCapturedUrl) return;
    setLastCapturedUrl(url);

    void captureConsentedPostHogEvent("$pageview", { $current_url: url });
  }, [enabled, lastCapturedUrl, pathname, searchParams]);

  return null;
}
