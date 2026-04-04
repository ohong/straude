export type TokenNormalizationMode =
  | "pass_through_normalized"
  | "inclusive_cache_input"
  | "inferred_separate_cache"
  | "inferred_output_adjustment"
  | "unresolved";

export type TokenNormalizationConfidence = "high" | "medium" | "low";

export interface NormalizedTokenEntry {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  reasoningOutputTokens?: number;
}

export interface NormalizationMeta {
  mode: TokenNormalizationMode;
  confidence: TokenNormalizationConfidence;
  warnings: string[];
  consistencyError: number;
}

export interface RawTokenBuckets {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cachedInputTokens?: number;
  cacheCreationTokens?: number;
  totalTokens?: number;
  reasoningOutputTokens?: number;
}

export interface TokenSourceHints {
  source: "codex" | "ccusage" | "gemini" | "generic";
  cacheSemantics?: "subset_of_input" | "separate" | "auto";
}

export interface NormalizeTokenBucketsResult {
  normalized: NormalizedTokenEntry;
  meta: NormalizationMeta;
}

export interface NormalizationSummary {
  total: number;
  anomalies: number;
  byMode: Partial<Record<TokenNormalizationMode, number>>;
  byConfidence: Partial<Record<TokenNormalizationConfidence, number>>;
}

function toNonNegativeInt(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return Math.floor(value);
}

function nearEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function toleranceFor(total: number): number {
  if (total <= 0) return 2;
  return Math.max(2, Math.floor(total * 0.0001));
}

interface Candidate {
  mode: TokenNormalizationMode;
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  consistencyError: number;
  warnings: string[];
}

function buildCandidate(
  mode: TokenNormalizationMode,
  inputTokens: number,
  cacheReadTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  totalTokens: number,
  hasTotal: boolean,
): Candidate {
  const expectedTotal = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
  const consistencyError = hasTotal ? Math.abs(totalTokens - expectedTotal) : 0;
  return {
    mode,
    inputTokens,
    cacheReadTokens,
    outputTokens,
    consistencyError,
    warnings: [],
  };
}

function chooseCandidate(
  candidates: Candidate[],
  hints: TokenSourceHints,
  hasCachedInputTokens: boolean,
  hasCacheReadTokens: boolean,
  hasTotal: boolean,
  totalTokens: number,
): Candidate {
  if (candidates.length === 1) return candidates[0]!;

  const sorted = [...candidates].sort((a, b) => a.consistencyError - b.consistencyError);
  const best = sorted[0]!;
  const second = sorted[1]!;
  if (best.consistencyError < second.consistencyError) return best;

  // Tie-breaks for ambiguous JSON semantics.
  if (hasCachedInputTokens && !hasCacheReadTokens) {
    const inclusive = candidates.find((c) => c.mode === "inclusive_cache_input");
    if (inclusive) return inclusive;
  }
  if (hasCacheReadTokens && !hasCachedInputTokens) {
    const passThrough = candidates.find((c) => c.mode === "pass_through_normalized");
    const inferredSeparate = candidates.find((c) => c.mode === "inferred_separate_cache");
    return passThrough ?? inferredSeparate ?? best;
  }

  if (hints.cacheSemantics === "subset_of_input") {
    const inclusive = candidates.find((c) => c.mode === "inclusive_cache_input");
    if (inclusive) return inclusive;
  }
  if (hints.cacheSemantics === "separate") {
    const passThrough = candidates.find((c) => c.mode === "pass_through_normalized");
    const inferredSeparate = candidates.find((c) => c.mode === "inferred_separate_cache");
    return passThrough ?? inferredSeparate ?? best;
  }

  // If totals are present and both are equally bad, mark as unresolved later.
  if (hasTotal && best.consistencyError > toleranceFor(totalTokens) * 4) {
    return {
      ...best,
      mode: "unresolved",
      warnings: [...best.warnings, "Unable to infer a reliable token split from source totals."],
    };
  }

  return best;
}

function computeConfidence(mode: TokenNormalizationMode, consistencyError: number, totalTokens: number): TokenNormalizationConfidence {
  const tol = toleranceFor(totalTokens);
  if (mode === "unresolved") return "low";
  if (consistencyError <= tol) return "high";
  if (consistencyError <= tol * 6) return "medium";
  return "low";
}

export function normalizeTokenBuckets(raw: RawTokenBuckets, hints: TokenSourceHints): NormalizeTokenBucketsResult {
  const warnings: string[] = [];

  const rawInput = toNonNegativeInt(raw.inputTokens);
  let rawOutput = toNonNegativeInt(raw.outputTokens);
  const rawTotal = toNonNegativeInt(raw.totalTokens);
  const rawCacheCreate = toNonNegativeInt(raw.cacheCreationTokens);
  const rawReasoning = toNonNegativeInt(raw.reasoningOutputTokens);

  const hasTotal = typeof raw.totalTokens === "number" && Number.isFinite(raw.totalTokens);
  const hasCachedInputTokens = typeof raw.cachedInputTokens === "number" && Number.isFinite(raw.cachedInputTokens);
  const hasCacheReadTokens = typeof raw.cacheReadTokens === "number" && Number.isFinite(raw.cacheReadTokens);

  const cachedInputTokens = toNonNegativeInt(raw.cachedInputTokens);
  const cacheReadTokens = toNonNegativeInt(raw.cacheReadTokens);
  const cacheTokenRaw = hasCachedInputTokens ? cachedInputTokens : cacheReadTokens;

  const candidates: Candidate[] = [];

  // Candidate 1: already normalized / separate cache semantics.
  const separateCacheRead = hasCachedInputTokens && !hasCacheReadTokens
    ? cachedInputTokens
    : cacheReadTokens;
  const separateMode: TokenNormalizationMode = hasCacheReadTokens && !hasCachedInputTokens
    ? "pass_through_normalized"
    : hints.source === "ccusage"
      ? "pass_through_normalized"
      : "inferred_separate_cache";
  candidates.push(
    buildCandidate(
      separateMode,
      rawInput,
      separateCacheRead,
      rawOutput,
      rawCacheCreate,
      rawTotal,
      hasTotal,
    ),
  );

  // Candidate 2: Codex-style inclusive cache in input.
  if (hasCachedInputTokens || hasCacheReadTokens) {
    const inclusiveCache = Math.min(cacheTokenRaw, rawInput);
    const nonCachedInput = Math.max(rawInput - inclusiveCache, 0);
    candidates.push(
      buildCandidate(
        "inclusive_cache_input",
        nonCachedInput,
        inclusiveCache,
        rawOutput,
        rawCacheCreate,
        rawTotal,
        hasTotal,
      ),
    );
  }

  const chosen = chooseCandidate(
    candidates,
    hints,
    hasCachedInputTokens,
    hasCacheReadTokens,
    hasTotal,
    rawTotal,
  );

  let mode = chosen.mode;
  let normalizedInput = chosen.inputTokens;
  const normalizedCacheRead = chosen.cacheReadTokens;
  const normalizedCacheCreate = rawCacheCreate;

  // Output defaults to source output bucket; only adjust on deterministic overlap signal.
  let normalizedOutput = chosen.outputTokens;
  if (hasTotal) {
    const expectedTotal = normalizedInput + normalizedOutput + normalizedCacheRead + normalizedCacheCreate;
    const residual = rawTotal - expectedTotal;
    const tol = toleranceFor(rawTotal);

    if (rawReasoning > 0 && residual > 0 && nearEqual(residual, rawReasoning, tol)) {
      normalizedOutput += rawReasoning;
      mode = "inferred_output_adjustment";
      warnings.push("Adjusted outputTokens by reasoningOutputTokens to satisfy source total.");
    } else if (rawReasoning > 0 && residual < 0 && nearEqual(Math.abs(residual), rawReasoning, tol)) {
      normalizedOutput = Math.max(normalizedOutput - rawReasoning, 0);
      mode = "inferred_output_adjustment";
      warnings.push("Reduced outputTokens by reasoningOutputTokens to satisfy source total.");
    }
  }

  if (rawReasoning > normalizedOutput) {
    warnings.push("reasoningOutputTokens exceeded outputTokens; clamped informational reasoning value.");
  }

  // Safety clamp for pathological source data.
  normalizedInput = Math.max(normalizedInput, 0);
  const reasoningOutputTokens = Math.max(0, Math.min(rawReasoning, normalizedOutput));

  const finalExpectedTotal = normalizedInput + normalizedOutput + normalizedCacheRead + normalizedCacheCreate;
  const consistencyError = hasTotal ? Math.abs(rawTotal - finalExpectedTotal) : 0;
  const confidence = computeConfidence(mode, consistencyError, rawTotal);

  if (hasTotal && confidence !== "high") {
    warnings.push(`Token consistency residual detected (${consistencyError}).`);
  }

  if (mode === "inferred_separate_cache" && hints.source === "codex") {
    warnings.push("Detected separate cache field semantics for codex source.");
  }

  return {
    normalized: {
      inputTokens: normalizedInput,
      outputTokens: normalizedOutput,
      cacheReadTokens: normalizedCacheRead,
      cacheCreationTokens: normalizedCacheCreate,
      totalTokens: hasTotal ? rawTotal : finalExpectedTotal,
      reasoningOutputTokens,
    },
    meta: {
      mode,
      confidence,
      warnings: [...warnings, ...chosen.warnings],
      consistencyError,
    },
  };
}

export function summarizeNormalization(metas: NormalizationMeta[]): NormalizationSummary {
  const byMode: Partial<Record<TokenNormalizationMode, number>> = {};
  const byConfidence: Partial<Record<TokenNormalizationConfidence, number>> = {};
  let anomalies = 0;

  for (const meta of metas) {
    byMode[meta.mode] = (byMode[meta.mode] ?? 0) + 1;
    byConfidence[meta.confidence] = (byConfidence[meta.confidence] ?? 0) + 1;
    if (meta.mode === "unresolved" || meta.confidence !== "high" || meta.warnings.length > 0) {
      anomalies += 1;
    }
  }

  return {
    total: metas.length,
    anomalies,
    byMode,
    byConfidence,
  };
}
