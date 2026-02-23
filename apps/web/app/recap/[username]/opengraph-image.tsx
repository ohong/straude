import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getServiceClient } from "@/lib/supabase/service";
import { getRecapData } from "@/lib/utils/recap";
import { RecapCardImage } from "@/lib/utils/recap-image";
import { getBackgroundById, DEFAULT_BACKGROUND_ID } from "@/lib/recap-backgrounds";

export const alt = "Straude Recap";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadBackgroundAsDataUri(bgId: string): Promise<string | undefined> {
  const bg = getBackgroundById(bgId);
  try {
    const imgPath = join(process.cwd(), "public", bg.src);
    const buffer = await readFile(imgPath);
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const [interBold, interMedium] = await Promise.all([
    readFile(join(process.cwd(), "assets/Inter-Bold.ttf")),
    readFile(join(process.cwd(), "assets/Inter-Medium.ttf")),
  ]);

  const supabase = getServiceClient();

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, is_public")
    .eq("username", username)
    .single();

  if (!profile || !profile.is_public) {
    // Fallback: generic Straude card (light theme)
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
      {
        ...size,
        fonts: [
          { name: "Inter", data: interBold, style: "normal" as const, weight: 700 as const },
          { name: "Inter", data: interMedium, style: "normal" as const, weight: 500 as const },
        ],
      }
    );
  }

  const [data, backgroundImageSrc] = await Promise.all([
    getRecapData(
      supabase,
      profile.id,
      profile.username!,
      profile.is_public,
      "week"
    ),
    loadBackgroundAsDataUri(DEFAULT_BACKGROUND_ID),
  ]);

  return new ImageResponse(
    <RecapCardImage data={data} format="landscape" backgroundImageSrc={backgroundImageSrc} />,
    {
      ...size,
      fonts: [
        { name: "Inter", data: interBold, style: "normal" as const, weight: 700 as const },
        { name: "Inter", data: interMedium, style: "normal" as const, weight: 500 as const },
      ],
    }
  );
}
