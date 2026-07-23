import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import {
  resolveUsageDevicesAuth,
  usageDevicesHeaders,
} from "../auth";

type ResolutionDecision = "merge" | "keep_separate";

interface ResolutionRequest {
  candidate_id: string;
  decision: ResolutionDecision;
}

interface ResolvedCandidate {
  id: string;
  status: string;
  decision: ResolutionDecision;
  canonical_device_id?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidRequest(message: string): NextResponse {
  return NextResponse.json(
    { error: { code: "invalid_request", message } },
    { status: 400 },
  );
}

async function parseRequest(request: Request): Promise<
  { ok: true; value: ResolutionRequest }
  | { ok: false; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: invalidRequest("Invalid JSON") };
  }

  if (!isRecord(body) || typeof body.candidate_id !== "string") {
    return {
      ok: false,
      response: invalidRequest("candidate_id must be a UUID"),
    };
  }
  if (!UUID_PATTERN.test(body.candidate_id)) {
    return {
      ok: false,
      response: invalidRequest("candidate_id must be a UUID"),
    };
  }
  if (body.decision !== "merge" && body.decision !== "keep_separate") {
    return {
      ok: false,
      response: invalidRequest("decision must be merge or keep_separate"),
    };
  }

  return {
    ok: true,
    value: {
      candidate_id: body.candidate_id,
      decision: body.decision,
    },
  };
}

function parseResolvedCandidate(value: unknown): ResolvedCandidate | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    !isRecord(candidate)
    || typeof candidate.id !== "string"
    || typeof candidate.status !== "string"
    || (candidate.decision !== "merge"
      && candidate.decision !== "keep_separate")
    || (candidate.canonical_device_id !== undefined
      && candidate.canonical_device_id !== null
      && typeof candidate.canonical_device_id !== "string")
  ) {
    return null;
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

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = await parseRequest(request);
  if (!parsed.ok) return parsed.response;

  const auth = await resolveUsageDevicesAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const { data, error } = await getServiceClient().rpc(
    "resolve_usage_device_candidate",
    {
      p_user_id: auth.userId,
      p_candidate_id: parsed.value.candidate_id,
      p_decision: parsed.value.decision,
    },
  );
  const headers = usageDevicesHeaders(auth);
  if (error) {
    const notFound = error.code === "P0002";
    return NextResponse.json(
      {
        error: {
          code: notFound ? "candidate_not_found" : "candidate_resolution_failed",
          message: notFound
            ? "Usage device candidate not found"
            : "Failed to resolve usage device candidate",
        },
      },
      { status: notFound ? 404 : 500, headers },
    );
  }

  const candidate = parseResolvedCandidate(data);
  if (!candidate) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_candidate_response",
          message: "Invalid usage device candidate response",
        },
      },
      { status: 502, headers },
    );
  }

  return NextResponse.json({ candidate }, { headers });
}
