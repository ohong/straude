import { parseAgentUsageComponent, MAX_USAGE_AGENTS_PER_DAY_V2, type AgentUsageComponent } from './usage-protocol';

export interface Workspace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}
export interface WorkspaceSource {
  id: string;
  workspace_id: string;
  user_id: string;
  installation_id: string;
  name: string;
  start_date: string;
  first_sync_at: string | null;
  last_received_at: string | null;
  revoked_at: string | null;
}
export interface WorkspaceSync {
  source_id: string;
  installation_id: string;
  timezone: 'UTC';
  entries: Array<{ date: string; agents: AgentUsageComponent[] }>;
}
export const WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Reuse the public protocol's numeric/model accounting validation, never its storage. */
export function parseWorkspaceSync(value: unknown): WorkspaceSync {
  if (!value || typeof value !== 'object') throw new Error('Invalid private sync');
  const raw = value as Record<string, unknown>;
  if (typeof raw.source_id !== 'string' || !WORKSPACE_UUID.test(raw.source_id)
    || typeof raw.installation_id !== 'string' || !WORKSPACE_UUID.test(raw.installation_id)
    || raw.timezone !== 'UTC' || !Array.isArray(raw.entries)
    || raw.entries.length < 1 || raw.entries.length > 31) throw new Error('Invalid private sync');
  const seen = new Set<string>();
  const entries = raw.entries.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid usage day');
    const entry = item as Record<string, unknown>;
    const date = entry.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
      || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
      || seen.has(date) || !Array.isArray(entry.agents)) throw new Error('Invalid or duplicate usage date');
    seen.add(date);
    if (entry.agents.length === 0) return { date, agents: [] };
    if (entry.agents.length > MAX_USAGE_AGENTS_PER_DAY_V2) throw new Error('Too many agents');
    const names = new Set<string>();
    const agents = entry.agents.map((rawAgent: unknown) => {
      const parsed = parseAgentUsageComponent(rawAgent);
      if (!parsed.ok) throw new Error(parsed.error.message);
      if (names.has(parsed.value.agent)) throw new Error('Duplicate agent');
      names.add(parsed.value.agent);
      return parsed.value;
    });
    return { date, agents };
  });
  return { source_id: raw.source_id, installation_id: raw.installation_id, timezone: 'UTC', entries };
}
