import { NextResponse } from "next/server";
import { safeAuthNext } from "@/lib/supabase/redirect";
import { after } from "@/lib/utils/after";
import { ACTIVATION_ANONYMOUS_COOKIE, deriveActivationState, getCookieValue } from "@/lib/analytics/activation";
import { captureServerActivationEvent, hasServerAnalyticsConsent, identifyServerActivationUser } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

function authenticatedRedirect(url: string) {
  const response = NextResponse.redirect(url);
  // The anonymous identity is linked at most once, before any account switch.
  response.cookies.delete(ACTIVATION_ANONYMOUS_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const origin = requestOrigin;
  const code = searchParams.get("code");
  const returnTo = safeAuthNext(searchParams.get("next"));
  const next = returnTo ?? "/feed";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // For GitHub OAuth: try to claim GitHub handle as Straude username
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const db = getServiceClient();
        const { data: profile } = await db
          .from("users")
          .select("username, github_username, onboarding_completed")
          .eq("id", user.id)
          .single();
        const anonymousId = getCookieValue(
          request.headers.get("cookie"),
          ACTIVATION_ANONYMOUS_COOKIE,
        );

        if (hasServerAnalyticsConsent(request)) after(async () => {
          if (anonymousId) {
            await identifyServerActivationUser({
              analyticsConsent: true,
              distinctId: user.id,
              anonymousDistinctId: anonymousId,
              properties: {
                is_authenticated: true,
                activation_state: "signed_up",
              },
            });
          }

          if (!profile?.onboarding_completed) {
            await captureServerActivationEvent({
              analyticsConsent: true,
              event: "signup_completed",
              distinctId: user.id,
              properties: {
                surface: "auth_callback",
                "$insert_id": `signup_completed:${user.id}`,
                activation_state: deriveActivationState({ isAuthenticated: true }),
                is_authenticated: true,
              },
            });
          }
        });

        if (profile && !profile.username && profile.github_username) {
          const sanitized = profile.github_username
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 20);
          if (/^[a-zA-Z0-9_]{3,20}$/.test(sanitized)) {
            // Best-effort: if taken, onboarding will handle it
            await db
              .from("users")
              .update({ username: sanitized })
              .eq("id", user.id);
          }
        }

        // Send new users to onboarding instead of feed
        if (profile && !profile.onboarding_completed && next === "/feed") {
          return authenticatedRedirect(`${origin}/onboarding`);
        }
      }

      return authenticatedRedirect(`${origin}${next}`);
    }
  }

  const retryParams = new URLSearchParams({ error: "auth" });
  if (returnTo) retryParams.set("next", returnTo);
  return NextResponse.redirect(`${origin}/login?${retryParams}`);
}
