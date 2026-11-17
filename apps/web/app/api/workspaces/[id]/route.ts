import { WorkspaceError, newWorkspaceToken, workspaceBody, workspaceResponse, workspaceRpc, workspaceString, workspaceTokenHash, workspaceUuid } from '@/lib/workspaces';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return workspaceResponse(request, async (auth) => workspaceRpc(auth.userId, 'detail', workspaceUuid((await context.params).id)));
}
export async function POST(request: Request, context: Context) {
  return workspaceResponse(request, async (auth) => {
    const id = workspaceUuid((await context.params).id);
    const body = await workspaceBody(request);
    if (body.action === 'invite') {
      const email = workspaceString(body.email, 'email', 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new WorkspaceError('Invalid email');
      const token = newWorkspaceToken();
      const result = await workspaceRpc(auth.userId, 'invite', id, { email, token_hash: workspaceTokenHash(token) });
      return { ...result, token };
    }
    if (body.action === 'revoke') return workspaceRpc(auth.userId, 'revoke', id, { invite_id: workspaceUuid(body.invite_id) });
    if (body.action === 'remove') return workspaceRpc(auth.userId, 'remove', id, { user_id: workspaceUuid(body.user_id) });
    throw new WorkspaceError('Unknown workspace action');
  });
}
