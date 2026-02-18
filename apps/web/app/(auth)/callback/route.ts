import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/feed";
  // Prevent open redirect: only allow relative paths starting with /
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/feed";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // For GitHub OAuth: try to claim GitHub handle as Straude username
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("username, github_username")
          .eq("id", user.id)
          .single();

        if (profile && !profile.username && profile.github_username) {
          const sanitized = profile.github_username
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 20);
          if (/^[a-zA-Z0-9_]{3,20}$/.test(sanitized)) {
            // Best-effort: if taken, onboarding will handle it
            await supabase
              .from("users")
              .update({ username: sanitized })
              .eq("id", user.id);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
