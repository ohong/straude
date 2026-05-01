import { ImageResponse } from "next/og";
import { getServiceClient } from "@/lib/supabase/service";
import { getRecapData } from "@/lib/utils/recap";
import { RecapCardImage } from "@/lib/utils/recap-image";
import { getBackgroundById, DEFAULT_BACKGROUND_ID } from "@/lib/recap-backgrounds";
import { loadFonts } from "@/lib/og-fonts";

export const alt = "Straude Recap";
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

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, is_public")
    .eq("username", username)
    .single();

  if (!profile || !profile.is_public) {
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
            backgroundColor: "#fff",
            color: "#000",
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
              color: "#666",
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

  const bg = getBackgroundById(DEFAULT_BACKGROUND_ID);

  const data = await getRecapData(
    supabase,
    profile.id,
    profile.username!,
    profile.is_public,
    "week"
  );

  return new ImageResponse(
    <RecapCardImage data={data} format="landscape" backgroundCss={bg.css} />,
    { ...size, fonts }
  );
}
