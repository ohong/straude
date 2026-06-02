"use client";

import { Analytics } from "@vercel/analytics/next";
import { useAnalyticsConsent } from "@/components/providers/useAnalyticsConsent";

export function ConsentAwareAnalytics() {
  const enabled = useAnalyticsConsent();

  return enabled ? <Analytics /> : null;
}
