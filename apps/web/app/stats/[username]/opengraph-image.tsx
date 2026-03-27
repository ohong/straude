import { ImageResponse } from "next/og";
import { getServiceClient } from "@/lib/supabase/service";
import { loadFonts } from "@/lib/og-fonts";
import { getProfileShareCardData } from "@/lib/share-assets/profile-card-data";
import { ProfileShareCardImage } from "@/lib/share-assets/profile-card-image";

export const alt = "Straude Stats Card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = getServiceClient();

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, display_name, is_public")
    .eq("username", username)
    .single();

  if (!profile?.username || !profile.is_public) {
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
            backgroundColor: "#FBF5EE",
            fontFamily: "Inter",
            color: "#1F1A16",
          }}
        >
          <svg width="56" height="56" viewBox="0 0 32 32">
            <polygon points="6.4,0 25.6,0 32,32 0,32" fill="#DF561F" />
          </svg>
          <div
            style={{
              marginTop: 18,
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: "-0.04em",
            }}
          >
            STRAUDE
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 24,
              fontWeight: 500,
              color: "#705D4F",
            }}
          >
            Code like an athlete.
          </div>
        </div>
      ),
      { ...size, fonts: await loadFonts() }
    );
  }

  const [fonts, data] = await Promise.all([
    loadFonts(),
    getProfileShareCardData(supabase, profile),
  ]);

  return new ImageResponse(<ProfileShareCardImage data={data} />, {
    ...size,
    fonts,
  });
}
