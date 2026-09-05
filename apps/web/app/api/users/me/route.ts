import { NextResponse, type NextRequest } from "next/server";
import { after } from "@/lib/utils/after";
import { captureServerActivationEvent } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { COUNTRY_TO_REGION } from "@/lib/constants/regions";
import { sendWelcomeEmail } from "@/lib/email/send-welcome-email";
import { attributeReferral } from "@/lib/referral";
import { normalizeTeamUrl, resolveTeamFavicon } from "@/lib/team-favicon";
import { isAllowedAvatarUrl } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";

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
const DISPLAY_NAME_MAX_LENGTH = 100;
const PROFILE_URL_MAX_LENGTH = 2048;
const GITHUB_USERNAME_PATTERN = /^(?!-)[a-zA-Z0-9-]{1,39}(?<!-)$/;

type ActivationUsageRow = {
  id: string;
  session_count: number | string | null;
  total_tokens: number | string | null;
};

function normalizeProfileLink(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Profile link must be a URL");
  }

  const link = value.trim();
  if (!link) return null;
  if (link.length > PROFILE_URL_MAX_LENGTH) {
    throw new Error(`Profile link must be at most ${PROFILE_URL_MAX_LENGTH} characters`);
  }

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

  const limited = await rateLimit("profile-update", user.id, { limit: 20 });
  if (limited) return limited;

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsedBody as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  // Validate username if provided
  if (updates.username !== undefined) {
    if (
      typeof updates.username !== "string"
      || !/^[a-zA-Z0-9_]{3,20}$/.test(updates.username)
    ) {
      return NextResponse.json(
        { error: "Username must be 3-20 alphanumeric characters or underscores" },
        { status: 400 }
      );
    }
  }

  if (updates.display_name !== undefined) {
    if (
      updates.display_name !== null
      && (typeof updates.display_name !== "string"
        || updates.display_name.length > DISPLAY_NAME_MAX_LENGTH)
    ) {
      return NextResponse.json(
        { error: `Display name must be text of at most ${DISPLAY_NAME_MAX_LENGTH} characters` },
        { status: 400 },
      );
    }
  }

  if (updates.bio !== undefined) {
    if (
      updates.bio !== null
      && (typeof updates.bio !== "string" || updates.bio.length > BIO_MAX_LENGTH)
    ) {
      return NextResponse.json(
        { error: `Bio must be text of at most ${BIO_MAX_LENGTH} characters` },
        { status: 400 }
      );
    }
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

  if (updates.avatar_url !== undefined) {
    if (
      updates.avatar_url !== null
      && (typeof updates.avatar_url !== "string"
        || updates.avatar_url.length > PROFILE_URL_MAX_LENGTH
        || !isAllowedAvatarUrl(updates.avatar_url))
    ) {
      return NextResponse.json(
        { error: "Avatar URL must use an approved image provider" },
        { status: 400 },
      );
    }
  }

  if (updates.github_username !== undefined) {
    if (
      updates.github_username !== null
      && (typeof updates.github_username !== "string"
        || !GITHUB_USERNAME_PATTERN.test(updates.github_username))
    ) {
      return NextResponse.json(
        { error: "GitHub username is invalid" },
        { status: 400 },
      );
    }
  }

  if (updates.timezone !== undefined) {
    if (typeof updates.timezone !== "string" || updates.timezone.length > 64) {
      return NextResponse.json({ error: "Timezone is invalid" }, { status: 400 });
    }
    const timezone = updates.timezone || "UTC";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      return NextResponse.json({ error: "Timezone is invalid" }, { status: 400 });
    }
    updates.timezone = timezone;
  }

  for (const field of [
    "is_public",
    "onboarding_completed",
    "email_notifications",
    "email_mention_notifications",
    "email_dm_notifications",
  ] as const) {
    if (updates[field] !== undefined && typeof updates[field] !== "boolean") {
      return NextResponse.json(
        { error: `${field} must be a boolean` },
        { status: 400 },
      );
    }
  }

  const db = getServiceClient();

  // Team affiliation: validate URL and derive cached favicon URL via the
  // resolver. team_favicon_url is server-derived only — never accepted from
  // the client body.
  if (body.team_url !== undefined) {
    if (body.team_url === null || body.team_url === "") {
      updates.team_url = null;
      updates.team_favicon_url = null;
    } else if (
      typeof body.team_url === "string"
      && body.team_url.length <= PROFILE_URL_MAX_LENGTH
    ) {
      const teamUrl = normalizeTeamUrl(body.team_url);
      if (!teamUrl) {
        return NextResponse.json(
          { error: "Team URL must be a valid http(s) URL" },
          { status: 400 },
        );
      }
      const { data: currentTeam } = await db.from("users")
        .select("team_url,team_favicon_url").eq("id", user.id).maybeSingle();
      const result = currentTeam?.team_url === teamUrl && currentTeam.team_favicon_url
        ? { ok: true, teamUrl, teamFaviconUrl: currentTeam.team_favicon_url }
        : await resolveTeamFavicon(teamUrl);
      if (!result.ok) {
        return NextResponse.json(
          { error: "Team URL must be a valid http(s) URL" },
          { status: 400 },
        );
      }
      updates.team_url = result.teamUrl;
      updates.team_favicon_url = result.teamFaviconUrl;
    } else {
      return NextResponse.json(
        { error: "Team URL must be a string or null" },
        { status: 400 },
      );
    }
  }

  // Auto-derive region from country
  if (updates.country !== undefined) {
    if (
      updates.country !== null
      && (typeof updates.country !== "string"
        || !(updates.country.toUpperCase() in COUNTRY_TO_REGION))
    ) {
      return NextResponse.json({ error: "Country is invalid" }, { status: 400 });
    }
    const country = updates.country ? updates.country.toUpperCase() : null;
    updates.country = country;
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
  let activationUsage: ActivationUsageRow | null = null;

  if (isOnboardingUpdate) {
    const { data: usageRow, error: usageError } = await db
      .from("daily_usage")
      .select("id,session_count,total_tokens")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (usageError) {
      return NextResponse.json(
        { error: "Unable to verify first sync" },
        { status: 500 },
      );
    }

    if (!usageRow) {
      return NextResponse.json(
        { error: "Sync your first session before completing onboarding" },
        { status: 409 },
      );
    }

    activationUsage = usageRow as ActivationUsageRow;
  }

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
    after(() => captureServerActivationEvent({
      event: "activation_completed",
      distinctId: user.id,
      properties: {
        surface: "onboarding",
        activation_state: "activated",
        is_authenticated: true,
        session_count: Number(activationUsage?.session_count ?? 0),
        total_tokens: Number(activationUsage?.total_tokens ?? 0),
        "$insert_id": activationUsage?.id
          ? `activation_completed:${activationUsage.id}`
          : `activation_completed:${user.id}`,
      },
    }));

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
    db.from("usage_installation_aliases").delete().eq("user_id", user.id),
    db.from("usage_agent_daily").delete().eq("user_id", user.id),
    db.from("usage_submission_outcomes").delete().eq("user_id", user.id),
    db.from("usage_device_reconciliation_decisions").delete().eq("user_id", user.id),
    // Ledger before-images contain private usage data; repair batches can span users.
    db.from("usage_corrections_ledger").delete().eq("user_id", user.id),
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

  // Decisions restrict candidate deletion, so they must finish successfully first.
  const { error: candidateDeletionError } = await db
    .from("usage_device_reconciliation_candidates")
    .delete()
    .eq("user_id", user.id);
  if (candidateDeletionError) {
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
