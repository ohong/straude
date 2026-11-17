import { redirect } from "next/navigation";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { authPathWithNext } from "@/lib/supabase/redirect";
import { JoinWorkspaceClient } from "@/components/app/workspaces/JoinWorkspaceClient";

export default async function JoinWorkspacePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await getAuthIdentity())) redirect(authPathWithNext("/login", `/workspaces/join/${encodeURIComponent(token)}`));
  return <JoinWorkspaceClient token={token} />;
}
