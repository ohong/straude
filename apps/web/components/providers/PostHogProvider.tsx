"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { PostHogPageView } from "@posthog/next";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/**
 * Wraps posthog-js/react PostHogProvider with deferred initialization.
 *
 * @posthog/next's built-in ClientPostHogProvider calls posthog.init() during
 * the render phase, which injects a <script> into the DOM before React
 * finishes hydration — causing hydration mismatches. This wrapper defers
 * init() to useEffect so scripts are only injected after hydration.
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
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}

function identifyUser(user: User) {
  const meta = user.user_metadata ?? {};
  posthog.identify(user.id, {
    email: user.email,
    github_username: meta.user_name,
    avatar_url: meta.avatar_url,
  });
}
