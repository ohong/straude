import { getServiceClient } from "@/lib/supabase/service";
import { checkAndAwardAchievements } from "@/lib/achievements";
import { sendReferralJoinedEmail } from "@/lib/email/send-referral-joined-email";

export async function attributeReferral(
  newUserId: string,
  referrerUsername: string,
): Promise<void> {
  const db = getServiceClient();

  // Look up referrer
  const { data: referrer } = await db
    .from("users")
    .select("id, email_notifications")
    .eq("username", referrerUsername)
    .single();

  if (!referrer || referrer.id === newUserId) return;

  // Check idempotency — don't overwrite existing referred_by
  const { data: existing } = await db
    .from("users")
    .select("referred_by")
    .eq("id", newUserId)
    .single();

  if (existing?.referred_by) return;

  // Set referred_by
  await db
    .from("users")
    .update({ referred_by: referrer.id })
    .eq("id", newUserId)
    .is("referred_by", null);

  // Create mutual follows
  await db.from("follows").upsert(
    [
      { follower_id: newUserId, following_id: referrer.id },
      { follower_id: referrer.id, following_id: newUserId },
    ],
    { onConflict: "follower_id,following_id", ignoreDuplicates: true },
  );

  // Notify referrer
  await db.from("notifications").insert({
    user_id: referrer.id,
    actor_id: newUserId,
    type: "referral",
    post_id: null,
    comment_id: null,
  });

  // Get new user's username + referrer email for email
  const [{ data: newUser }, { data: authUser }] = await Promise.all([
    db.from("users").select("username").eq("id", newUserId).single(),
    db.auth.admin.getUserById(referrer.id),
  ]);

  // Crew count for email
  const { count: crewCount } = await db
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", referrer.id);

  if (authUser?.user?.email) {
    sendReferralJoinedEmail({
      referrerId: referrer.id,
      referrerEmailNotifications: referrer.email_notifications ?? true,
      referrerEmail: authUser.user.email,
      newUserId,
      newUsername: newUser?.username ?? null,
      crewCount: crewCount ?? 1,
    }).catch(() => {});
  }

  // Check referral achievements
  checkAndAwardAchievements(referrer.id, "referral").catch(() => {});
}
