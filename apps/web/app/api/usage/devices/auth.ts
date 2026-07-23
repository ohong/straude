import { verifyCliTokenWithRefresh } from "@/lib/api/cli-auth";
import { createClient } from "@/lib/supabase/server";

export interface UsageDevicesAuth {
  userId: string;
  source: "cli" | "web";
  refreshedToken: string | null;
}

export async function resolveUsageDevicesAuth(
  request: Request,
): Promise<UsageDevicesAuth | null> {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const cli = verifyCliTokenWithRefresh(authorization);
    return cli
      ? {
        userId: cli.userId,
        source: "cli",
        refreshedToken: cli.refreshedToken,
      }
      : null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id
      ? { userId: user.id, source: "web", refreshedToken: null }
      : null;
  } catch {
    return null;
  }
}

export function usageDevicesHeaders(
  auth: UsageDevicesAuth,
): Record<string, string> {
  return auth.source === "cli" && auth.refreshedToken
    ? { "X-Straude-Refreshed-Token": auth.refreshedToken }
    : {};
}
