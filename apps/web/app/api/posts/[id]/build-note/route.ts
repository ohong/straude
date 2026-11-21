import { NextResponse } from "next/server";
import { verifyCliToken } from "@/lib/api/cli-auth";
import { isActiveCliUser } from "@/lib/api/active-cli-user";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get("authorization");
  let userId: string | null;
  if (authorization) {
    userId = verifyCliToken(authorization);
    if (userId && !await isActiveCliUser(userId)) userId = null;
  } else {
    const client = await createClient();
    userId = (await client.auth.getUser()).data.user?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: "Sign in to add a note." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 100 || /[\r\n]/.test(title)) {
    return NextResponse.json({ error: "Use one line of up to 100 characters." }, { status: 400 });
  }
  const { id } = await context.params;
  // A sync receipt can stay open after another device has edited the same post.
  const { data, error } = await getServiceClient().from("posts")
    .update({ title, usage_generated_title: false })
    .eq("id", id).eq("user_id", userId).eq("usage_generated_title", true)
    .select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not save your note. Try again." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "This post changed. Open it to edit its title." }, { status: 409 });
  return NextResponse.json({ saved: true });
}
