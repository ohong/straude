import { ImageResponse } from "next/og";
import { getServiceClient } from "@/lib/supabase/service";
import { loadFonts } from "@/lib/og-fonts";

export const alt = "Join Straude";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const fonts = await loadFonts();
  const supabase = getServiceClient();

  const { data: referrer } = await supabase
    .from("users")
    .select("id, username, avatar_url, is_public")
    .eq("username", username)
    .single();

  if (!referrer || !referrer.is_public) {
    return fallbackImage(fonts);
  }

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [{ data: weeklyRows }, { data: totalRows }, streakResult] =
    await Promise.all([
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

  const weeklySpend =
    weeklyRows?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;
  const totalSpend =
    totalRows?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;
  const streak = (streakResult?.data as number) ?? 0;

  let claudeSpend = 0;
  let codexSpend = 0;
  for (const row of totalRows ?? []) {
    for (const m of (row.model_breakdown as Array<{
      model: string;
      cost_usd: number;
    }>) ?? []) {
      if (/^(gpt|codex|o[1-9])/i.test(m.model)) {
        codexSpend += m.cost_usd;
      } else {
        claudeSpend += m.cost_usd;
      }
    }
  }
  const primaryTool = codexSpend > claudeSpend ? "Codex" : "Claude Code";

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

  const { data: monthlyRows } = await supabase
    .from("daily_usage")
    .select("cost_usd")
    .eq("user_id", referrer.id)
    .gte("date", monthStart);
  const monthlySpend =
    monthlyRows?.reduce((s, r) => s + Number(r.cost_usd), 0) ?? 0;

  const finalStats: { label: string; value: string }[] = [];
  if (streak > 0) finalStats.push({ label: "Streak", value: `${streak}d` });
  finalStats.push({ label: "This Week", value: `$${weeklySpend.toFixed(2)}` });
  finalStats.push({ label: monthName, value: `$${monthlySpend.toFixed(2)}` });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        {/* Halftone-style dot pattern background */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            backgroundImage:
              "radial-gradient(circle, rgba(223,86,31,0.12) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Avatar */}
          {referrer.avatar_url ? (
            <img
              src={referrer.avatar_url}
              alt=""
              width={120}
              height={120}
              style={{
                borderRadius: "50%",
                border: "4px solid rgba(255,255,255,0.15)",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                backgroundColor: "#222",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                fontWeight: 700,
                color: "#ededed",
              }}
            >
              {(username[0] ?? "?").toUpperCase()}
            </div>
          )}

          {/* Headline */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "#ededed",
              marginTop: 24,
              textAlign: "center",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              maxWidth: 900,
            }}
          >
            {headline}
          </div>

          {/* Subline */}
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: "#999",
              marginTop: 12,
            }}
          >
            {subline}
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 64,
              marginTop: 40,
            }}
          >
            {finalStats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#555",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#DF561F",
                    marginTop: 6,
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <div
            style={{
              marginTop: 36,
              backgroundColor: "#DF561F",
              borderRadius: 8,
              padding: "14px 48px",
              fontSize: 20,
              fontWeight: 600,
              color: "#fff",
            }}
          >
            Claim Your Profile
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "#555",
              marginTop: 14,
            }}
          >
            One command. See where you rank.
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            right: 32,
            fontSize: 16,
            fontWeight: 500,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          straude.com
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}

function fallbackImage(fonts: Awaited<ReturnType<typeof loadFonts>>) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          fontFamily: "Inter",
        }}
      >
        <svg width="48" height="48" viewBox="0 0 32 32">
          <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
        </svg>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#ededed",
            marginTop: 16,
            letterSpacing: "-0.03em",
          }}
        >
          STRAUDE
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 500,
            color: "#999",
            marginTop: 8,
          }}
        >
          Strava for Claude Code
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
