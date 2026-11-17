import { redirect } from "next/navigation";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { authPathWithNext } from "@/lib/supabase/redirect";
import { WorkspaceDetailClient } from "@/components/app/workspaces/WorkspaceDetailClient";

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getAuthIdentity())) redirect(authPathWithNext("/login", `/workspaces/${encodeURIComponent(id)}`));
  return <WorkspaceDetailClient workspaceId={id} />;
}
