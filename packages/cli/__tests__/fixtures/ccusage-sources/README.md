# Synthetic ccusage source fixtures

These records were written for Straude tests. They contain invented session IDs and token counts, with no prompts or real user usage.

Shapes follow the [ccusage v20.0.20 adapters](https://github.com/ccusage/ccusage/tree/v20.0.20/rust/adapters):

- Gemini: cached input is included in the input count and identified through the total; thoughts are separate output tokens.
- Qwen: prompt, cached, candidate, and thought token counts are separate buckets in the upstream adapter.
- Grok: cache reads and writes are subsets of input; reasoning is a subset of output. Recorded `costUsdTicks` use units of 1e-10 USD, so 123,000,000 ticks equals $0.0123.

The test supplies one source root at a time, then all three roots. Its child environment excludes inherited source paths, configuration, and pricing caches. Offline embedded prices keep source parsing tests independent of the network; the separate GPT-5.6 test checks online pricing.

`../ccusage-sources.json` lists the 16 source IDs exposed by the released native binary. It is shared with CLI parser and API tests. The native help comparison must change when a dependency update adds another built-in source.
