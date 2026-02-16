export interface CcusageDailyEntry {
    date: string;
    models: string[];
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
    costUSD: number;
}
export interface CcusageOutput {
    type: "daily";
    data: CcusageDailyEntry[];
    summary: {
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCacheCreationTokens: number;
        totalCacheReadTokens: number;
        totalTokens: number;
        totalCostUSD: number;
    };
}
/**
 * Runs `ccusage daily --json` for the given date range and returns parsed output.
 * Dates should be in YYYYMMDD format (no dashes) as ccusage expects.
 */
export declare function runCcusage(sinceDate: string, untilDate: string): CcusageOutput;
export declare function parseCcusageOutput(raw: string): CcusageOutput;
/**
 * Returns the raw JSON string from ccusage (for hashing).
 */
export declare function runCcusageRaw(sinceDate: string, untilDate: string): string;
