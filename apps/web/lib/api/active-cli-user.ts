import { getServiceClient } from "@/lib/supabase/service";

export class CliIdentityUnavailableError extends Error {
  constructor() {
    super("CLI identity verification is unavailable");
    this.name = "CliIdentityUnavailableError";
  }
}

export async function isActiveCliUser(userId: string): Promise<boolean> {
  try {
    const { data, error } = await getServiceClient().auth.admin.getUserById(userId);
    if (error) {
      if (error.code === "user_not_found") return false;
      throw new CliIdentityUnavailableError();
    }
    if (!data.user) return false;

    const bannedUntil = data.user.banned_until;
    if (!bannedUntil) return true;

    const bannedUntilMs = Date.parse(bannedUntil);
    return Number.isFinite(bannedUntilMs) && bannedUntilMs <= Date.now();
  } catch (error) {
    if (error instanceof CliIdentityUnavailableError) throw error;
    throw new CliIdentityUnavailableError();
  }
}
