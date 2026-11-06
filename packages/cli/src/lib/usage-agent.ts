import type { AgentUsageComponent } from "@straude/shared/usage-protocol";
import type { CcusageAgentEntry } from "./ccusage.js";

export function toWireAgent(agent: CcusageAgentEntry): AgentUsageComponent {
  return {
    agent: agent.agent,
    models: [...agent.models].sort(),
    input_tokens: agent.inputTokens,
    output_tokens: agent.outputTokens,
    reasoning_output_tokens: agent.reasoningOutputTokens,
    cache_creation_tokens: agent.cacheCreationTokens,
    cache_read_tokens: agent.cacheReadTokens,
    total_tokens: agent.totalTokens,
    cost_usd: agent.costUSD,
    model_breakdown: agent.modelBreakdown.map((model) => ({
      model: model.model,
      input_tokens: model.inputTokens,
      output_tokens: model.outputTokens,
      reasoning_output_tokens: model.reasoningOutputTokens,
      cache_creation_tokens: model.cacheCreationTokens,
      cache_read_tokens: model.cacheReadTokens,
      total_tokens: model.totalTokens,
      cost_usd: model.cost_usd,
    })),
  };
}

