import { workspaceBody, workspaceResponse, workspaceRpc, workspaceString } from '@/lib/workspaces';
export async function GET(request: Request) {
  return workspaceResponse(request, (auth) => workspaceRpc(auth.userId, 'list'));
}
export async function POST(request: Request) {
  return workspaceResponse(request, async (auth) => {
    const body = await workspaceBody(request);
    return workspaceRpc(auth.userId, 'create', null, { name: workspaceString(body.name, 'workspace name') });
  });
}
