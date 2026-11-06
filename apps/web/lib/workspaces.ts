import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { resolveUsageDevicesAuth, usageDevicesHeaders, type UsageDevicesAuth } from '@/app/api/usage/devices/auth';
import { getServiceClient } from '@/lib/supabase/service';

export class WorkspaceError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export function workspaceTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function newWorkspaceToken(): string { return randomBytes(32).toString('base64url'); }
export async function workspaceRpc(
  actorId: string, action: string, workspaceId: string | null = null,
  input: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const { data, error } = await getServiceClient().rpc('workspace_action', {
    p_actor: actorId, p_action: action, p_workspace: workspaceId, p_input: input,
  });
  if (error) {
    if (error.code === '42501') throw new WorkspaceError(error.message, 403);
    if (['22023', '22P02', '23514', '23505'].includes(error.code)) throw new WorkspaceError(error.message);
    throw new WorkspaceError('Workspace unavailable. Please retry.', 503);
  }
  return data as Record<string, unknown>;
}
export async function workspaceBody(request: Request): Promise<Record<string, unknown>> {
  // Bound stream consumption even if Content-Length is absent or forged.
  if (!request.body) throw new WorkspaceError('JSON body required');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 256 * 1024) { await reader.cancel(); throw new WorkspaceError('Request too large', 413); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  text += decoder.decode();
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new WorkspaceError('Invalid JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WorkspaceError('JSON object required');
  return value as Record<string, unknown>;
}
export function workspaceString(value: unknown, label: string, max = 100): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new WorkspaceError(`Invalid ${label}`);
  }
  return value.trim();
}
export function workspaceUuid(value: unknown): string {
  const string = workspaceString(value, 'identifier', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(string)) throw new WorkspaceError('Invalid identifier');
  return string;
}
export async function workspaceResponse(
  request: Request,
  handler: (auth: UsageDevicesAuth) => Promise<unknown>,
): Promise<Response> {
  let auth: UsageDevicesAuth | null = null;
  try {
    auth = await resolveUsageDevicesAuth(request);
    if (!auth) throw new WorkspaceError('Authentication required', 401);
    const data = await handler(auth);
    if (data instanceof Response) {
      data.headers.set('Cache-Control', 'private, no-store');
      for (const [key, value] of Object.entries(usageDevicesHeaders(auth))) data.headers.set(key, value);
      return data;
    }
    return NextResponse.json(data, { headers: { ...usageDevicesHeaders(auth), 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const known = error instanceof WorkspaceError;
    return NextResponse.json({ error: known ? error.message : 'Workspace unavailable. Please retry.' }, {
      status: known ? error.status : 503,
      headers: { ...(auth ? usageDevicesHeaders(auth) : {}), 'Cache-Control': 'private, no-store' },
    });
  }
}
