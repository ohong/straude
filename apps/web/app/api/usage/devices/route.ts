import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import {
  resolveUsageDevicesAuth,
  usageDevicesHeaders,
} from "./auth";

interface UsageDeviceCandidate {
  id: string;
  device_id_a: string;
  device_id_b: string;
  normalized_hostname: string;
  overlap_dates: string[];
  status: string;
  created_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCandidate(value: unknown): UsageDeviceCandidate | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || typeof value.device_id_a !== "string"
    || typeof value.device_id_b !== "string"
    || typeof value.normalized_hostname !== "string"
    || !Array.isArray(value.overlap_dates)
    || !value.overlap_dates.every((date) => typeof date === "string")
    || typeof value.status !== "string"
    || typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    device_id_a: value.device_id_a,
    device_id_b: value.device_id_b,
    normalized_hostname: value.normalized_hostname,
    overlap_dates: value.overlap_dates,
    status: value.status,
    created_at: value.created_at,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await resolveUsageDevicesAuth(request);
  if (!auth) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const { data, error } = await getServiceClient().rpc(
    "list_usage_device_candidates",
    { p_user_id: auth.userId },
  );
  const headers = usageDevicesHeaders(auth);
  if (error) {
    return NextResponse.json(
      {
        error: {
          code: "candidate_list_failed",
          message: "Failed to list usage device candidates",
        },
      },
      { status: 500, headers },
    );
  }

  if (!Array.isArray(data)) {
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

  const candidates = data.map(parseCandidate);
  if (candidates.some((candidate) => candidate === null)) {
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

  return NextResponse.json(
    { candidates },
    { headers },
  );
}
