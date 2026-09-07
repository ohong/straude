import { describe, expect, it } from "vitest";
import {
  canonicalizeUsageEntryV2,
  parseAgentUsageComponent,
  parseUsageSubmitV2,
  parseUsageSubmitResponseV2,
  type UsageSubmitRequestV2,
} from "@straude/shared/usage-protocol";

const DATE = "2026-07-23";

function validRequest(): UsageSubmitRequestV2 {
  return {
    protocol_version: 2,
    request_id: "request-123",
    source: "cli",
    timezone: "America/Vancouver",
    installation: {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      name: "work-laptop",
    },
    collector: {
      name: "ccusage",
      version: "20.0.16",
      pricing_mode: "online",
    },
    entries: [{
      date: DATE,
      content_hash: "a".repeat(64),
      agents: [{
        agent: "codex",
        models: ["gpt-5.6"],
        input_tokens: 100,
        output_tokens: 20,
        reasoning_output_tokens: 10,
        cache_creation_tokens: 0,
        cache_read_tokens: 30,
        total_tokens: 160,
        cost_usd: 0.25,
        model_breakdown: [{
          model: "gpt-5.6",
          input_tokens: 100,
          output_tokens: 20,
          reasoning_output_tokens: 10,
          cache_creation_tokens: 0,
          cache_read_tokens: 30,
          total_tokens: 160,
          cost_usd: 0.25,
        }],
      }],
    }],
  };
}

describe("usage protocol v2", () => {
  it("accepts a complete per-agent request", () => {
    expect(parseUsageSubmitV2(validRequest())).toEqual({
      ok: true,
      value: validRequest(),
    });
  });

  it("parses a source component independently with the same invariants", () => {
    expect(parseAgentUsageComponent(validRequest().entries[0]!.agents[0])).toMatchObject({
      ok: true,
      value: { agent: "codex", total_tokens: 160, cost_usd: 0.25 },
    });
  });

  it("rejects aggregate fields that do not equal the model breakdown", () => {
    const request = validRequest();
    request.entries[0]!.agents[0]!.cost_usd = 0.24;

    const parsed = parseUsageSubmitV2(request);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.code).toBe("invalid_agent_aggregate");
  });

  it("rejects duplicate agents and mismatched installation identities", () => {
    const duplicate = validRequest();
    duplicate.entries[0]!.agents.push(duplicate.entries[0]!.agents[0]!);
    expect(parseUsageSubmitV2(duplicate)).toMatchObject({
      ok: false,
      error: { code: "duplicate_agent" },
    });

    const sameIdentity = validRequest();
    sameIdentity.installation.previous_device_id = sameIdentity.installation.id;
    expect(parseUsageSubmitV2(sameIdentity)).toMatchObject({
      ok: false,
      error: { code: "invalid_installation" },
    });
  });

  it("canonicalizes semantically identical entries deterministically", () => {
    const first = validRequest().entries[0]!;
    const second = structuredClone(first);
    second.agents[0]!.models = [...second.agents[0]!.models].reverse();

    expect(canonicalizeUsageEntryV2(first)).toBe(canonicalizeUsageEntryV2(second));
  });

  it("validates response outcomes and rejects duplicate dates", () => {
    expect(parseUsageSubmitResponseV2({
      request_id: "request-123",
      outcomes: [{
        date: DATE,
        status: "committed",
        result: {
          usage_id: "usage-1",
          post_id: "post-1",
          post_url: "https://straude.com/post/post-1",
          action: "created",
        },
      }],
    })).toMatchObject({ ok: true });

    expect(parseUsageSubmitResponseV2({
      request_id: "request-123",
      outcomes: [{
        date: DATE,
        status: "unchanged",
      }],
    })).toEqual({
      ok: true,
      value: {
        request_id: "request-123",
        outcomes: [{
          date: DATE,
          status: "unchanged",
        }],
      },
    });

    expect(parseUsageSubmitResponseV2({
      request_id: "request-123",
      outcomes: [
        {
          date: DATE,
          status: "permanent_error",
          error: { code: "bad_data", message: "bad data" },
        },
        {
          date: DATE,
          status: "retryable_error",
          error: { code: "timeout", message: "try again" },
        },
      ],
    })).toMatchObject({
      ok: false,
      error: { code: "duplicate_date" },
    });
  });
});
