import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set up your profile — Straude",
};

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Already onboarded — send to feed
  const { data: profile } = await supabase
    .from("users")
    .select("username, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed && profile?.username) {
    redirect("/feed");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
