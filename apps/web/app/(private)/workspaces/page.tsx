import { redirect } from "next/navigation";
import { getAuthIdentity } from "@/lib/supabase/auth";
import { WorkspaceListClient } from "@/components/app/workspaces/WorkspaceListClient";

export default async function WorkspacesPage() {
  if (!(await getAuthIdentity())) redirect("/login?next=%2Fworkspaces");
  return <WorkspaceListClient />;
}
