import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { COUNTRY_TO_REGION } from "@/lib/constants/regions";
import { sendWelcomeEmail } from "@/lib/email/send-welcome-email";
import { attributeReferral } from "@/lib/referral";

const ALLOWED_FIELDS = [
  "username",
  "display_name",
  "bio",
  "heard_about",
  "country",
  "link",
  "is_public",
  "timezone",
  "avatar_url",
  "github_username",
  "onboarding_completed",
  "email_notifications",
  "email_mention_notifications",
  "email_dm_notifications",
] as const;

const BIO_MAX_LENGTH = 160;
const HEARD_ABOUT_MAX_LENGTH = 500;

function normalizeProfileLink(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Profile link must be a URL");
  }

  const link = value.trim();
  if (!link) return null;

  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch (err) {
    throw new Error("Profile link must be a valid URL", { cause: err });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Profile link must use http or https");
  }

  return link;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const [{ data: profile, error }, { count: crewCount }] = await Promise.all([
    db
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single(),
    db
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", user.id),
  ]);

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...profile,
    crew_count: crewCount ?? 0,
  });
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
  if (
    updates.bio !== undefined &&
    typeof updates.bio === "string" &&
    updates.bio.length > BIO_MAX_LENGTH
  ) {
    return NextResponse.json(
      { error: `Bio must be at most ${BIO_MAX_LENGTH} characters` },
      { status: 400 }
    );
  }

  if (updates.heard_about !== undefined) {
    if (updates.heard_about === null) {
      // Allow callers to clear the field explicitly.
    } else if (typeof updates.heard_about === "string") {
      const heardAbout = updates.heard_about.trim();

      if (heardAbout.length > HEARD_ABOUT_MAX_LENGTH) {
        return NextResponse.json(
          {
            error:
              `How you heard about Straude must be at most ${HEARD_ABOUT_MAX_LENGTH} characters`,
          },
          { status: 400 }
        );
      }

      updates.heard_about = heardAbout || null;
    } else {
      return NextResponse.json(
        { error: "How you heard about Straude must be text" },
        { status: 400 }
      );
    }
  }

  if (updates.link !== undefined) {
    try {
      updates.link = normalizeProfileLink(updates.link);
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 }
      );
    }
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

  const db = getServiceClient();
  const { data: profile, error } = await db
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
    }).catch(() => {});
  }

  // Auto-follow top active users so new users see content in their feed
  if (isOnboardingUpdate) {
    autoFollowTopUsers(user.id).catch(() => {});

    // Attribute referral from cookie
    const refUsername = request.cookies.get("ref")?.value;
    if (refUsername) {
      attributeReferral(user.id, refUsername).catch(() => {});
    }
  }

  return NextResponse.json(profile);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const confirmUsername = typeof body.username === "string" ? body.username.trim() : "";

  if (!confirmUsername) {
    return NextResponse.json(
      { error: "Username confirmation is required" },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile || profile.username !== confirmUsername) {
    return NextResponse.json(
      { error: "Username does not match" },
      { status: 400 },
    );
  }

  // Instead of admin.deleteUser() (which cascades and destroys other users'
  // data), we selectively delete owned content and anonymize the profile.
  // This preserves: daily_usage (north star metric), the user's comments on
  // other posts, their kudos, and DM history for the other party.
  const db = getServiceClient();

  // 1. Delete owned content and relationships
  const deletions = [
    db.from("posts").delete().eq("user_id", user.id),
    db.from("follows").delete().or(`follower_id.eq.${user.id},following_id.eq.${user.id}`),
    db.from("notifications").delete().or(`user_id.eq.${user.id},actor_id.eq.${user.id}`),
    db.from("user_achievements").delete().eq("user_id", user.id),
    db.from("user_levels").delete().eq("user_id", user.id),
    db.from("device_usage").delete().eq("user_id", user.id),
    db.from("prompt_submissions").delete().eq("user_id", user.id),
    db.from("cli_auth_codes").delete().eq("user_id", user.id),
  ];

  const results = await Promise.all(deletions);
  const deletionError = results.find((r) => r.error);
  if (deletionError?.error) {
    return NextResponse.json(
      { error: "Failed to delete account data" },
      { status: 500 },
    );
  }

  // 2. Anonymize the profile (keep row for FK integrity with daily_usage, comments, DMs)
  const { error: updateError } = await db
    .from("users")
    .update({
      username: `deleted_${user.id.slice(0, 8)}`,
      display_name: null,
      bio: null,
      avatar_url: null,
      country: null,
      region: null,
      link: null,
      github_username: null,
      heard_about: null,
      is_public: false,
      email_notifications: false,
      email_mention_notifications: false,
      email_dm_notifications: false,
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to anonymize account" },
      { status: 500 },
    );
  }

  // 3. Ban the auth user so they cannot sign in again
  const { error: banError } = await db.auth.admin.updateUserById(user.id, {
    ban_duration: "876600h",
  });

  if (banError) {
    return NextResponse.json(
      { error: "Failed to disable account" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

async function autoFollowTopUsers(userId: string) {
  const db = getServiceClient();
  const { data: topUsers } = await db
    .from("leaderboard_weekly")
    .select("user_id")
    .neq("user_id", userId)
    .order("total_cost", { ascending: false })
    .limit(3);

  if (!topUsers?.length) return;

  await db.from("follows").upsert(
    topUsers.map((u) => ({ follower_id: userId, following_id: u.user_id })),
    { onConflict: "follower_id,following_id", ignoreDuplicates: true },
  );
}
