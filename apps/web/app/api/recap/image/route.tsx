import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecapData } from "@/lib/utils/recap";
import { RecapCardImage } from "@/lib/utils/recap-image";
import { getBackgroundById, DEFAULT_BACKGROUND_ID } from "@/lib/recap-backgrounds";

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

  const [interBold, interMedium, data, backgroundImageSrc] = await Promise.all([
    readFile(join(process.cwd(), "assets/Inter-Bold.ttf")),
    readFile(join(process.cwd(), "assets/Inter-Medium.ttf")),
    getRecapData(supabase, user.id, profile.username, profile.is_public, period),
    loadBackgroundAsDataUri(bgParam),
  ]);

  const response = new ImageResponse(
    <RecapCardImage data={data} format="square" backgroundImageSrc={backgroundImageSrc} />,
    {
      width: 1080,
      height: 1080,
      fonts: [
        { name: "Inter", data: interBold, style: "normal" as const, weight: 700 as const },
        { name: "Inter", data: interMedium, style: "normal" as const, weight: 500 as const },
      ],
    }
  );

  // Add download headers
  response.headers.set(
    "Content-Disposition",
    `attachment; filename="straude-recap-${period}.png"`
  );

  return response;
}
