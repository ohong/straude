import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { useReportWebVitals } from "next/web-vitals";
import {
  PostHogClientProvider,
  WebVitalsReporter,
} from "@/components/providers/PostHogProvider";

const mocks = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "ph_test";

  return {
    capture: vi.fn(),
    init: vi.fn(),
    analyticsConsent: false,
    unsubscribe: vi.fn(),
    reportWebVitals: undefined as
      | Parameters<typeof useReportWebVitals>[0]
      | undefined,
  };
});

vi.mock("next/web-vitals", () => ({
  useReportWebVitals: (reporter: Parameters<typeof useReportWebVitals>[0]) => {
    mocks.reportWebVitals = reporter;
  },
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: mocks.capture,
    identify: vi.fn(),
    init: mocks.init,
    reset: vi.fn(),
  },
}));

vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/providers/useAnalyticsConsent", () => ({
  useAnalyticsConsent: () => mocks.analyticsConsent,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: mocks.unsubscribe } },
      }),
    },
  }),
}));

describe("WebVitalsReporter", () => {
  beforeEach(() => {
    mocks.capture.mockClear();
    mocks.init.mockClear();
    mocks.analyticsConsent = false;
    mocks.reportWebVitals = undefined;
    mocks.unsubscribe.mockClear();
    window.__straudePostHogInitialized = undefined;
    window.history.replaceState({}, "", "/feed?sort=recent");
  });

  it("enables built-in web vitals only after analytics consent", async () => {
    const { rerender } = render(
      <PostHogClientProvider>
        <div>Content</div>
      </PostHogClientProvider>,
    );

    expect(mocks.init).not.toHaveBeenCalled();

    mocks.analyticsConsent = true;
    rerender(
      <PostHogClientProvider>
        <div>Content</div>
      </PostHogClientProvider>,
    );

    await waitFor(() => expect(mocks.init).toHaveBeenCalledOnce());
    expect(mocks.init).toHaveBeenCalledWith(
      "ph_test",
      expect.objectContaining({
        capture_performance: { web_vitals: true },
      }),
    );
  });

  it("buffers TTFB until PostHog is ready and ignores built-in metrics", async () => {
    const { rerender } = render(<WebVitalsReporter ready={false} />);

    act(() => {
      mocks.reportWebVitals?.({
        name: "LCP",
        id: "lcp-1",
        value: 450,
        delta: 450,
        rating: "good",
        entries: [],
        navigationType: "navigate",
      });
      mocks.reportWebVitals?.({
        name: "TTFB",
        id: "ttfb-1",
        value: 180,
        delta: 180,
        rating: "good",
        entries: [],
        navigationType: "navigate",
      });
    });

    expect(mocks.capture).not.toHaveBeenCalled();

    rerender(<WebVitalsReporter ready />);

    await waitFor(() => {
      expect(mocks.capture).toHaveBeenCalledOnce();
    });
    expect(mocks.capture).toHaveBeenCalledWith("web_vital_ttfb", {
      metric_name: "TTFB",
      value_ms: 180,
      metric_id: "ttfb-1",
      rating: "good",
      navigation_type: "navigate",
      pathname: "/feed",
      $current_url: "http://localhost:3000/feed?sort=recent",
    });
  });

  it("does not report the same TTFB metric twice", async () => {
    render(<WebVitalsReporter ready />);
    const metric = {
      name: "TTFB" as const,
      id: "ttfb-1",
      value: 180,
      delta: 180,
      rating: "good" as const,
      entries: [],
      navigationType: "navigate" as const,
    };

    act(() => mocks.reportWebVitals?.(metric));
    await waitFor(() => expect(mocks.capture).toHaveBeenCalledOnce());
    act(() => mocks.reportWebVitals?.(metric));

    expect(mocks.capture).toHaveBeenCalledOnce();
  });
});
