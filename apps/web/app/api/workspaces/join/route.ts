import { getServiceClient } from '@/lib/supabase/service';
import { WorkspaceError, workspaceBody, workspaceResponse, workspaceRpc, workspaceString, workspaceTokenHash } from '@/lib/workspaces';
export async function POST(request: Request) {
  return workspaceResponse(request, async (auth) => {
    const body = await workspaceBody(request);
    const token = workspaceString(body.token, 'invitation', 100);
    const { data, error } = await getServiceClient().auth.admin.getUserById(auth.userId);
    if (error || !data.user?.email || !data.user.email_confirmed_at) throw new WorkspaceError('Confirm your invited email address before joining', 403);
    return workspaceRpc(auth.userId, 'join', null, { token_hash: workspaceTokenHash(token), actor_email: data.user.email.toLowerCase() });
  });
}
