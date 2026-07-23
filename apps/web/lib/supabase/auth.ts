import { cache } from "react";
import { getServiceClient } from "./service";
import { createClient } from "./server";

export type AuthIdentity = {
  id: string;
  email: string | null;
};

export type ShellProfile = {
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
  team_url: string | null;
  team_favicon_url: string | null;
  onboarding_completed: boolean | null;
  streak_freezes: number | null;
};

export type AuthContext = {
  identity: AuthIdentity | null;
  profile: ShellProfile | null;
};

export const getAuthIdentity = cache(async (): Promise<AuthIdentity | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims.sub;
  const email = data?.claims.email;

  if (error || typeof subject !== "string" || subject.length === 0) {
    return null;
  }

  return {
    id: subject,
    email: typeof email === "string" ? email : null,
  };
});

export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const identity = await getAuthIdentity();

  if (!identity) {
    return { identity: null, profile: null };
  }

  const db = getServiceClient();
  const { data } = await db
    .from("users")
    .select(
      "username, avatar_url, display_name, team_url, team_favicon_url, onboarding_completed, streak_freezes"
    )
    .eq("id", identity.id)
    .single();

  return {
    identity,
    profile: data as ShellProfile | null,
  };
});
