import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecapData } from "@/lib/utils/recap";
import { RecapCardImage } from "@/lib/utils/recap-image";
import { getBackgroundById, DEFAULT_BACKGROUND_ID } from "@/lib/recap-backgrounds";
import { loadFonts } from "@/lib/og-fonts";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("username, is_public")
    .eq("id", user.id)
    .single();

  if (!profile?.username) {
    return new Response("Profile not found", { status: 404 });
  }

  const periodParam = request.nextUrl.searchParams.get("period");
  const period = periodParam === "month" ? "month" : ("week" as const);
  const bgParam = request.nextUrl.searchParams.get("bg") ?? DEFAULT_BACKGROUND_ID;

  const bg = getBackgroundById(bgParam);

  try {
    const [fonts, data] = await Promise.all([
      loadFonts(),
      getRecapData(supabase, user.id, profile.username, profile.is_public, period),
    ]);

    const response = new ImageResponse(
      <RecapCardImage data={data} format="landscape" backgroundCss={bg.css} />,
      { width: 1200, height: 630, fonts }
    );

    response.headers.set(
      "Content-Disposition",
      `attachment; filename="straude-recap-${period}.png"`
    );

    return response;
  } catch (err) {
    console.error("Recap image generation failed:", err);
    return new Response("Image generation failed", { status: 500 });
  }
}
