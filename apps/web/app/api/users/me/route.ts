import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COUNTRY_TO_REGION } from "@/lib/constants/regions";
import { sendWelcomeEmail } from "@/lib/email/send-welcome-email";

const ALLOWED_FIELDS = [
  "username",
  "display_name",
  "bio",
  "country",
  "link",
  "is_public",
  "timezone",
  "avatar_url",
  "github_username",
  "onboarding_completed",
  "email_notifications",
  "email_mention_notifications",
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  // Validate username if provided
  if (updates.username !== undefined) {
    const username = updates.username as string;
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3-20 alphanumeric characters or underscores" },
        { status: 400 }
      );
    }
  }

  // Validate bio length
  if (updates.bio !== undefined && typeof updates.bio === "string" && updates.bio.length > 160) {
    return NextResponse.json(
      { error: "Bio must be at most 160 characters" },
      { status: 400 }
    );
  }

  // Auto-derive region from country
  if (updates.country !== undefined) {
    const country = updates.country as string | null;
    if (country) {
      updates.region = COUNTRY_TO_REGION[country.toUpperCase()] ?? null;
    } else {
      updates.region = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const isOnboardingUpdate = updates.onboarding_completed === true;

  const { data: profile, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    // Unique constraint on username
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget welcome email on first onboarding completion.
  // Resend idempotency key (welcome/{userId}) deduplicates at the provider level,
  // so even a rare double-submit only sends one email.
  if (isOnboardingUpdate && user.email) {
    sendWelcomeEmail({
      userId: user.id,
      email: user.email,
      username: (profile as Record<string, unknown>).username as string | null,
    }).catch(() => {
      // Swallow — email failure must not break onboarding
    });
  }

  return NextResponse.json(profile);
}
