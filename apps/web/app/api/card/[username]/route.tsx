import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { loadFonts } from "@/lib/og-fonts";
import { getGithubCardData } from "@/lib/share-assets/github-card-data";
import {
  GithubCardImage,
  PrivateCardImage,
} from "@/lib/share-assets/github-card-image";

type RouteContext = { params: Promise<{ username: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { username } = await context.params;
  const db = getServiceClient();

  const { data: profile } = await db
    .from("users")
    .select("id, username, display_name, is_public")
    .eq("username", username)
    .single();

  if (!profile?.username) {
    return new Response("Not found", { status: 404 });
  }

  const themeParam = request.nextUrl.searchParams.get("theme");
  const themeId = themeParam === "dark" ? ("dark" as const) : ("light" as const);

  // Private profiles get a placeholder card (not 404, so embeds don't break)
  if (!profile.is_public) {
    const fonts = await loadFonts();
    const response = new ImageResponse(
      <PrivateCardImage username={profile.username} themeId={themeId} />,
      { width: 495, height: 270, fonts }
    );
    response.headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=3600"
    );
    return response;
  }

  try {
    const [fonts, data] = await Promise.all([
      loadFonts(),
      getGithubCardData(db, profile),
    ]);

    const response = new ImageResponse(
      <GithubCardImage data={data} themeId={themeId} />,
      { width: 495, height: 270, fonts }
    );

    response.headers.set(
      "Cache-Control",
      "public, max-age=7200, s-maxage=7200, stale-while-revalidate=3600"
    );

    return response;
  } catch (error) {
    console.error("GitHub card image generation failed:", error);
    return new Response("Image generation failed", { status: 500 });
  }
}
