import { redirect } from "next/navigation";
import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/service";
import { Avatar } from "@/components/ui/Avatar";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { HalftoneCanvas } from "@/components/landing/HalftoneCanvas";
import { RefCookie } from "./ref-cookie";
import { Flame } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = getServiceClient();

  const { data: referrer } = await supabase
    .from("users")
    .select("username, display_name, avatar_url, is_public")
    .eq("username", username)
    .single();

  if (!referrer || !referrer.is_public) {
    return { title: "Join Straude" };
  }

  // Fetch total spend for description
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .single();

  const { data: totalRows } = await supabase
    .from("daily_usage")
    .select("cost_usd, model_breakdown")
    .eq("user_id", user?.id ?? "");

  const totalSpend = totalRows?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;

  let claudeSpend = 0;
  let codexSpend = 0;
  for (const row of totalRows ?? []) {
    for (const m of (row.model_breakdown as Array<{ model: string; cost_usd: number }>) ?? []) {
      if (/^(gpt|codex|o[1-9])/i.test(m.model)) {
        codexSpend += m.cost_usd;
      } else {
        claudeSpend += m.cost_usd;
      }
    }
  }
  const primaryTool = codexSpend > claudeSpend ? "Codex" : "Claude Code";

  const description =
    totalSpend > 0
      ? `@${username} has spent $${totalSpend.toFixed(2)} on ${primaryTool}. Think you can keep up?`
      : `@${username} just joined Straude. Race them to the top.`;

  return {
    title: `Join @${username} on Straude`,
    description,
    openGraph: {
      title: `Join @${username} on Straude`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `Join @${username} on Straude`,
      description,
    },
  };
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = getServiceClient();

  const { data: referrer } = await supabase
    .from("users")
    .select("id, username, display_name, avatar_url, is_public")
    .eq("username", username)
    .single();

  if (!referrer || !referrer.is_public) {
    redirect("/signup");
  }

  // Fetch stats in parallel
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthName = now.toLocaleString("en-US", { month: "long" });

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [{ data: monthlyRows }, { data: weeklyRows }, { data: totalRows }, streakResult] =
    await Promise.all([
      supabase
        .from("daily_usage")
        .select("cost_usd")
        .eq("user_id", referrer.id)
        .gte("date", monthStart),
      supabase
        .from("daily_usage")
        .select("cost_usd")
        .eq("user_id", referrer.id)
        .gte("date", sevenDaysAgo),
      supabase
        .from("daily_usage")
        .select("cost_usd, model_breakdown")
        .eq("user_id", referrer.id),
      supabase.rpc("calculate_user_streak", {
        p_user_id: referrer.id,
        p_freeze_days: 0,
      }),
    ]);

  const monthlySpend =
    monthlyRows?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;
  const weeklySpend =
    weeklyRows?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;
  const totalSpend =
    totalRows?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;
  const streak = (streakResult?.data as number) ?? 0;

  // Determine primary tool by total spend across model breakdowns
  let claudeSpend = 0;
  let codexSpend = 0;
  for (const row of totalRows ?? []) {
    for (const m of (row.model_breakdown as Array<{ model: string; cost_usd: number }>) ?? []) {
      if (/^(gpt|codex|o[1-9])/i.test(m.model)) {
        codexSpend += m.cost_usd;
      } else {
        claudeSpend += m.cost_usd;
      }
    }
  }
  const primaryTool = codexSpend > claudeSpend ? "Codex" : "Claude Code";

  // Choose competitive headline
  let headline: string;
  let subline: string;

  if (totalSpend > 0) {
    headline = `@${username} has spent $${totalSpend.toFixed(2)} on ${primaryTool}.`;
    subline = "Think you can keep up?";
  } else if (streak > 0) {
    headline = `@${username} has a ${streak}-day streak going.`;
    subline = "Start yours.";
  } else {
    headline = `@${username} just joined Straude.`;
    subline = "Race them to the top.";
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-[#ededed]">
      <RefCookie username={username} />
      <HalftoneCanvas />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />

        <main className="flex flex-1 flex-col items-center justify-center px-5 py-24 sm:py-20">
          <div className="mx-auto w-full max-w-md text-center">
            <div className="flex justify-center">
              <Avatar
                src={referrer.avatar_url}
                alt={referrer.username ?? ""}
                size="lg"
                fallback={referrer.username ?? "?"}
              />
            </div>

            <h1
              className="mt-5 text-balance text-xl font-semibold sm:mt-6 sm:text-3xl"
              style={{ letterSpacing: "-0.03em" }}
            >
              {headline}
            </h1>
            <p className="mt-2 text-base text-[#999] sm:text-xl">{subline}</p>

            {/* Stats row */}
            <div className="mt-8 flex justify-center gap-6 sm:mt-10 sm:gap-10">
              {streak > 0 && (
                <div>
                  <p className="text-[0.6rem] uppercase tracking-widest text-[#555] sm:text-[0.65rem]">
                    Streak
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 font-mono text-base font-medium tabular-nums text-accent sm:text-lg">
                    <Flame size={14} className="sm:h-4 sm:w-4" />
                    {streak}d
                  </p>
                </div>
              )}
              <div>
                <p className="text-[0.6rem] uppercase tracking-widest text-[#555] sm:text-[0.65rem]">
                  This Week
                </p>
                <p className="mt-1 font-mono text-base font-medium tabular-nums text-accent sm:text-lg">
                  ${weeklySpend.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[0.6rem] uppercase tracking-widest text-[#555] sm:text-[0.65rem]">
                  {monthName}
                </p>
                <p className="mt-1 font-mono text-base font-medium tabular-nums text-accent sm:text-lg">
                  ${monthlySpend.toFixed(2)}
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 sm:mt-10">
              <Link
                href="/signup"
                className="inline-block rounded bg-accent px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:px-10 sm:py-3.5"
              >
                Claim Your Profile
              </Link>
              <p className="mt-3 text-xs text-[#555] sm:text-sm">
                One command. See where you rank.
              </p>
            </div>
          </div>
        </main>

        <Footer hideLogo />
      </div>
    </div>
  );
}
