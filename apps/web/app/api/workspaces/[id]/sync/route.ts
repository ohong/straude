import { parseWorkspaceSync } from '@straude/shared';
import { WorkspaceError, workspaceBody, workspaceResponse, workspaceRpc, workspaceUuid } from '@/lib/workspaces';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return workspaceResponse(request, async (auth) => {
    const body = await workspaceBody(request);
    let sync;
    try { sync = parseWorkspaceSync(body); } catch (error) {
      throw new WorkspaceError(error instanceof Error ? error.message : 'Invalid private sync');
    }
    return workspaceRpc(auth.userId, 'sync', workspaceUuid((await context.params).id), { ...sync });
  });
}
