import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ShareCardImage } from "@/lib/utils/share-image";
import { DEFAULT_SHARE_THEME, type ShareThemeId } from "@/lib/share-themes";
import { loadFonts } from "@/lib/og-fonts";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const themeParam = request.nextUrl.searchParams.get("theme");
  const themeId: ShareThemeId =
    themeParam === "light" || themeParam === "dark" || themeParam === "accent"
      ? themeParam
      : DEFAULT_SHARE_THEME;

  const { data: post, error } = await supabase
    .from("posts")
    .select(
      `
      id, title, description, images,
      user:users!posts_user_id_fkey(username, avatar_url, display_name),
      daily_usage:daily_usage!posts_daily_usage_id_fkey(cost_usd, input_tokens, output_tokens, models, is_verified)
    `
    )
    .eq("id", id)
    .single();

  if (error || !post) {
    return new Response("Post not found", { status: 404 });
  }

  const u = post.user as unknown as {
    username: string;
    avatar_url: string | null;
    display_name: string | null;
  };
  const usage = post.daily_usage as unknown as {
    cost_usd: number;
    input_tokens: number;
    output_tokens: number;
    models: string[];
    is_verified: boolean;
  } | null;

  try {
    const fonts = await loadFonts();

    return new ImageResponse(
      <ShareCardImage
        post={{
          title: post.title,
          description: post.description,
          images: post.images ?? [],
          username: u?.username ?? "anonymous",
          avatar_url: u?.avatar_url ?? null,
          cost_usd: usage?.cost_usd ?? null,
          input_tokens: usage?.input_tokens ?? 0,
          output_tokens: usage?.output_tokens ?? 0,
          models: usage?.models ?? [],
          is_verified: usage?.is_verified ?? false,
        }}
        themeId={themeId}
      />,
      { width: 1080, height: 1080, fonts }
    );
  } catch (err) {
    console.error("Share image generation failed:", err);
    return new Response("Image generation failed", { status: 500 });
  }
}
