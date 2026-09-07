export function toLegacyUsageImportEntries(data: Record<string, unknown>[]) {
  return data.map((day) => ({
    date: day.date as string,
    data: {
      date: day.date as string,
      models: (day.models as string[]) ?? [],
      inputTokens: (day.inputTokens as number) ?? 0,
      outputTokens: (day.outputTokens as number) ?? 0,
      ...(day.reasoningOutputTokens === undefined
        ? {}
        : { reasoningOutputTokens: day.reasoningOutputTokens as number }),
      cacheCreationTokens: (day.cacheCreationTokens as number) ?? 0,
      cacheReadTokens: (day.cacheReadTokens as number) ?? 0,
      totalTokens: (day.totalTokens as number) ?? 0,
      costUSD: (day.costUSD as number) ?? 0,
    },
  }));
}
