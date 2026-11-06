import { WorkspaceError, workspaceBody, workspaceResponse, workspaceRpc, workspaceString, workspaceUuid } from '@/lib/workspaces';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return workspaceResponse(request, async (auth) => {
    const body = await workspaceBody(request);
    if (body.work_only !== true) throw new WorkspaceError('Confirm this is a work-only source before collecting usage');
    return workspaceRpc(auth.userId, 'source', workspaceUuid((await context.params).id), {
      ...(body.previous_device_id !== undefined ? { previous_device_id: workspaceUuid(body.previous_device_id) } : {}),
      installation_id: workspaceUuid(body.installation_id), name: workspaceString(body.name, 'source name'), work_only: true,
    });
  });
}
