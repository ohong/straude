"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

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

  useEffect(() => {
    if (!POSTHOG_KEY || initialized.current) return;
    posthog.init(POSTHOG_KEY, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2025-05-24",
      capture_pageview: false,
      person_profiles: "identified_only",
    });
    initialized.current = true;
    setReady(true);

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

    return () => subscription.unsubscribe();
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker ready={ready} />
      </Suspense>
      {children}
    </PHProvider>
  );
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
