import { NextResponse } from "next/server";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { getServiceClient } from "@/lib/supabase/service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthIdentity();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const decision = await request.json().catch(() => null);
  if (typeof decision?.approve !== "boolean" || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid follow request" }, { status: 400 });
  }
  const { error } = await getServiceClient().rpc("review_follow_request", {
    p_owner: user.id, p_request: id, p_approve: decision.approve,
  });
  if (error) return NextResponse.json({ error: "Could not review request" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
