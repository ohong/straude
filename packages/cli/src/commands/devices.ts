import { apiRequest, ApiHttpError, ApiTimeoutError } from "../lib/api.js";
import { loadConfig } from "../lib/auth.js";

interface UsageDeviceCandidate {
  id: string;
  device_id_a: string;
  device_id_b: string;
  normalized_hostname: string;
  overlap_dates: string[];
  status: string;
  created_at: string;
}

interface ResolvedCandidate {
  id: string;
  status: string;
  decision: "merge" | "keep_separate";
  canonical_device_id?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCandidates(value: unknown): UsageDeviceCandidate[] {
  if (!isRecord(value) || !Array.isArray(value.candidates)) {
    throw new Error("Invalid device-candidate response.");
  }
  return value.candidates.map((candidate) => {
    if (
      !isRecord(candidate)
      || typeof candidate.id !== "string"
      || typeof candidate.device_id_a !== "string"
      || typeof candidate.device_id_b !== "string"
      || typeof candidate.normalized_hostname !== "string"
      || !Array.isArray(candidate.overlap_dates)
      || candidate.overlap_dates.some((date) => typeof date !== "string")
      || typeof candidate.status !== "string"
      || typeof candidate.created_at !== "string"
    ) {
      throw new Error("Invalid device candidate.");
    }
    return {
      id: candidate.id,
      device_id_a: candidate.device_id_a,
      device_id_b: candidate.device_id_b,
      normalized_hostname: candidate.normalized_hostname,
      overlap_dates: candidate.overlap_dates as string[],
      status: candidate.status,
      created_at: candidate.created_at,
    };
  });
}

function parseResolved(value: unknown): ResolvedCandidate {
  if (!isRecord(value) || !isRecord(value.candidate)) {
    throw new Error("Invalid device-resolution response.");
  }
  const candidate = value.candidate;
  if (
    typeof candidate.id !== "string"
    || typeof candidate.status !== "string"
    || (candidate.decision !== "merge" && candidate.decision !== "keep_separate")
    || (
      candidate.canonical_device_id !== undefined
      && typeof candidate.canonical_device_id !== "string"
    )
  ) {
    throw new Error("Invalid resolved device candidate.");
  }
  return {
    id: candidate.id,
    status: candidate.status,
    decision: candidate.decision,
    ...(typeof candidate.canonical_device_id === "string"
      ? { canonical_device_id: candidate.canonical_device_id }
      : {}),
  };
}

function classifyError(error: unknown): number {
  if (error instanceof ApiHttpError) {
    if (error.status === 401) return 2;
    return error.retryable ? 75 : 1;
  }
  if (error instanceof ApiTimeoutError || error instanceof TypeError) return 75;
  return 1;
}

export async function devicesCommand(
  subcommand: string | null,
  candidateId: string | null,
): Promise<number> {
  const config = loadConfig();
  if (!config) {
    console.error("AUTH_REQUIRED: Run `straude login` before managing devices.");
    return 2;
  }

  try {
    if (subcommand === null) {
      const response = await apiRequest<unknown>(
        config,
        "/api/usage/devices",
        { timeoutMs: 15_000, maxRetries: 2 },
      );
      const candidates = parseCandidates(response);
      if (candidates.length === 0) {
        console.log("No unresolved device identity candidates.");
        return 0;
      }
      console.log("Unresolved device identity candidates:");
      for (const candidate of candidates) {
        console.log(
          `${candidate.id}  ${candidate.normalized_hostname}  ${candidate.overlap_dates.length} matching days`,
        );
        console.log(`  merge:         straude devices merge ${candidate.id}`);
        console.log(`  keep separate: straude devices keep-separate ${candidate.id}`);
      }
      return 0;
    }

    if (!candidateId) {
      console.error(`devices ${subcommand} requires a candidate UUID.`);
      return 1;
    }
    const decision = subcommand === "merge" ? "merge" : "keep_separate";
    const response = await apiRequest<unknown>(
      config,
      "/api/usage/devices/resolve",
      {
        method: "POST",
        body: JSON.stringify({ candidate_id: candidateId, decision }),
        timeoutMs: 15_000,
        maxRetries: 2,
      },
    );
    const resolved = parseResolved(response);
    if (resolved.decision === "merge") {
      console.log(
        `Merged device candidate ${resolved.id}${resolved.canonical_device_id ? ` into ${resolved.canonical_device_id}` : ""}.`,
      );
    } else {
      console.log(`Kept device candidate ${resolved.id} separate.`);
    }
    return 0;
  } catch (error) {
    const code = classifyError(error);
    console.error(
      code === 2
        ? "AUTH_REQUIRED: Run `straude login` before managing devices."
        : `Failed to manage devices: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return code;
  }
}
