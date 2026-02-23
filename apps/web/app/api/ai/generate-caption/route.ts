import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { images, usage } = await request.json();

  if (!images || !Array.isArray(images) || images.length === 0) {
    return NextResponse.json(
      { error: "At least one image is required" },
      { status: 400 }
    );
  }

  if (images.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 images allowed" },
      { status: 400 }
    );
  }

  // Only allow images hosted on our own Supabase storage to prevent SSRF
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const allowedOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
  for (const url of images) {
    if (typeof url !== "string") {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }
    try {
      const parsed = new URL(url);
      if (!allowedOrigin || parsed.origin !== allowedOrigin) {
        return NextResponse.json(
          { error: "Images must be hosted on Straude storage" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 503 }
    );
  }

  const anthropic = new Anthropic({ apiKey });

  const imageContent = images.map((url: string) => ({
    type: "image" as const,
    source: { type: "url" as const, url },
  }));

  let response: Awaited<ReturnType<typeof anthropic.messages.create>>;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `You are writing a short social post caption for a developer sharing their Claude Code usage stats on Straude (like Strava for coding).

Usage stats for today:
- Cost: $${usage?.costUSD ?? 0}
- Tokens: ${(usage?.totalTokens ?? 0).toLocaleString()} (input: ${(usage?.inputTokens ?? 0).toLocaleString()}, output: ${(usage?.outputTokens ?? 0).toLocaleString()})
- Models: ${(usage?.models ?? []).join(", ") || "Unknown"}
- Sessions: ${usage?.sessionCount ?? 1}

Based on the screenshots of what they were working on and the usage stats, write:
1. A short title (max 100 chars) — like a Strava workout title. Examples: "Morning refactor session", "Migrating to TypeScript", "Bug hunting in the auth layer"
2. A description (max 5000 chars) — casual, developer-friendly. Mention what was accomplished based on the screenshots. Keep it conversational like a Strava caption.

Return as JSON: { "title": "...", "description": "..." }`,
            },
          ],
        },
      ],
    });
  } catch {
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 503 }
    );
  }

  // Extract JSON from the response
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  try {
    // Try to parse the entire response as JSON, or extract from a code block
    const jsonMatch = text.match(/\{[\s\S]*"title"[\s\S]*"description"[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      title: String(parsed.title).slice(0, 100),
      description: String(parsed.description).slice(0, 5000),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response" },
      { status: 500 }
    );
  }
}
