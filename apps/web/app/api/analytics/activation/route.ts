import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ACTIVATION_ANONYMOUS_COOKIE,
  ACTIVATION_ANONYMOUS_COOKIE_MAX_AGE,
  deriveActivationState,
  getCookieValue,
  isActivationEventName,
  sanitizeActivationProperties,
} from "@/lib/analytics/activation";
import { captureServerActivationEvent, identifyServerActivationUser } from "@/lib/analytics/server";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const CLIENT_EVENT_ALLOWLIST = new Set([
  "landing_primary_cta_clicked",
  "guest_signup_cta_clicked",
  "signup_started",
  "onboarding_profile_started",
  "sync_command_copied",
  "first_sync_nudge_clicked",
  "activation_completed",
]);

async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function rateLimitSubject(request: Request, userId: string | null): string {
  if (userId) return userId;

  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  let body: { event?: unknown; properties?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isActivationEventName(body.event) || !CLIENT_EVENT_ALLOWLIST.has(body.event)) {
    return NextResponse.json({ error: "Invalid activation event" }, { status: 400 });
  }

  const userId = await getUserId();
  const limited = await rateLimit(
    "activation-analytics",
    rateLimitSubject(request, userId),
    { limit: 20, windowSeconds: 60 },
  );
  if (limited) return limited;

  const cookieHeader = request.headers.get("cookie");
  const existingAnonymousId = getCookieValue(cookieHeader, ACTIVATION_ANONYMOUS_COOKIE);
  const anonymousId = existingAnonymousId ?? randomUUID();
  const distinctId = userId ?? anonymousId;
  const isAuthenticated = Boolean(userId);
  const properties = sanitizeActivationProperties({
    ...(typeof body.properties === "object" && body.properties !== null ? body.properties : {}),
    is_authenticated: isAuthenticated,
    activation_state: deriveActivationState({
      isAuthenticated,
      syncCommandCopied: body.event === "sync_command_copied",
      webSyncConfirmed: body.event === "activation_completed",
    }),
  });

  if (userId && existingAnonymousId) {
    await identifyServerActivationUser({
      distinctId: userId,
      anonymousDistinctId: existingAnonymousId,
      properties: {
        is_authenticated: true,
        activation_state: properties.activation_state,
      },
    });
  }

  await captureServerActivationEvent({
    event: body.event,
    distinctId,
    properties,
  });

  const response = NextResponse.json({ ok: true });
  if (!existingAnonymousId) {
    response.cookies.set({
      name: ACTIVATION_ANONYMOUS_COOKIE,
      value: anonymousId,
      path: "/",
      maxAge: ACTIVATION_ANONYMOUS_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
  }
  return response;
}
