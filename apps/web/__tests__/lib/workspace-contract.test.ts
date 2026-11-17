import { describe, expect, it } from 'vitest';
import { parseWorkspaceSync } from '@straude/shared';

const usage = { input_tokens: 4, output_tokens: 6, reasoning_output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 10, cost_usd: 0.01 };
const agent = { ...usage, agent: 'claude', models: ['fictional-model'], model_breakdown: [{ ...usage, model: 'fictional-model' }] };
const body = () => ({
  source_id: '11111111-1111-4111-8111-111111111111',
  installation_id: '22222222-2222-4222-8222-222222222222', timezone: 'UTC',
  entries: [{ date: '2026-11-01', agents: [agent] }],
});

describe('private work usage accounting contract', () => {
  it('preserves a recorded zero day separately from a measured usage day and drops nonusage fields', () => {
    const input = body();
    input.entries.push({ date: '2026-11-02', agents: [] });
    const clean = parseWorkspaceSync({ ...input, prompt: 'never store', entries: input.entries.map(day => ({ ...day, code: 'never store' })) });
    expect(clean.entries.map(day => [day.date, day.agents.reduce((sum, item) => sum + item.total_tokens, 0)])).toEqual([['2026-11-01', 10], ['2026-11-02', 0]]);
    expect(JSON.stringify(clean)).not.toContain('never store');
  });
  it('rejects incompatible timezone, duplicate day, and an impossible calendar date', () => {
    expect(() => parseWorkspaceSync({ ...body(), timezone: 'America/Vancouver' })).toThrow();
    const duplicate = body(); duplicate.entries.push(duplicate.entries[0]!);
    expect(() => parseWorkspaceSync(duplicate)).toThrow();
    const impossible = body(); impossible.entries[0]!.date = '2026-02-30';
    expect(() => parseWorkspaceSync(impossible)).toThrow();
  });
  it('rejects totals that disagree with model accounting and duplicate agents', () => {
    const invalid = body(); invalid.entries[0]!.agents = [{ ...agent, total_tokens: 11 }];
    expect(() => parseWorkspaceSync(invalid)).toThrow();
    const duplicate = body(); duplicate.entries[0]!.agents.push(agent);
    expect(() => parseWorkspaceSync(duplicate)).toThrow();
  });
});
