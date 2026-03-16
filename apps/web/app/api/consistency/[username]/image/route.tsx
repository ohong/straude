import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { loadFonts } from "@/lib/og-fonts";
import { getProfileShareCardData } from "@/lib/share-assets/profile-card-data";
import { ProfileShareCardImage } from "@/lib/share-assets/profile-card-image";

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
    return new Response("Profile not found", { status: 404 });
  }

  if (!profile.is_public) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== profile.id) {
      return new Response("Profile not found", { status: 404 });
    }
  }

  try {
    const [fonts, data] = await Promise.all([
      loadFonts(),
      getProfileShareCardData(db, profile),
    ]);

    const response = new ImageResponse(<ProfileShareCardImage data={data} />, {
      width: 1200,
      height: 630,
      fonts,
    });

    if (request.nextUrl.searchParams.get("download") === "1") {
      response.headers.set(
        "Content-Disposition",
        `attachment; filename="straude-consistency-${profile.username}.png"`
      );
    }

    return response;
  } catch (error) {
    console.error("Consistency image generation failed:", error);
    return new Response("Image generation failed", { status: 500 });
  }
}
