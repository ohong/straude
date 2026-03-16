import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { loadFonts } from "@/lib/og-fonts";
import { ShareCardImage } from "@/lib/utils/share-image";
import { DEFAULT_SHARE_THEME } from "@/lib/share-themes";

export const alt = "Straude Session Card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
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

  if (!post) {
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
        </div>
      ),
      { ...size, fonts: await loadFonts() }
    );
  }

  const userRow = Array.isArray(post.user) ? post.user[0] : post.user;
  const usageRow = Array.isArray(post.daily_usage)
    ? post.daily_usage[0]
    : post.daily_usage;

  const user = userRow as unknown as {
    username: string;
    avatar_url: string | null;
    display_name: string | null;
  } | null;
  const usage = usageRow as unknown as {
    cost_usd: number;
    input_tokens: number;
    output_tokens: number;
    models: string[];
    is_verified: boolean;
  } | null;

  const fonts = await loadFonts();

  return new ImageResponse(
    <ShareCardImage
      post={{
        title: post.title,
        description: post.description,
        images: post.images ?? [],
        username: user?.username ?? "anonymous",
        avatar_url: user?.avatar_url ?? null,
        cost_usd: usage?.cost_usd ?? null,
        input_tokens: usage?.input_tokens ?? 0,
        output_tokens: usage?.output_tokens ?? 0,
        models: usage?.models ?? [],
        is_verified: usage?.is_verified ?? false,
      }}
      themeId={DEFAULT_SHARE_THEME}
    />,
    { ...size, fonts }
  );
}
