import type { StraudeConfig } from "./auth.js";
import { saveConfig } from "./auth.js";
import { isInteractive } from "./prompt.js";

export interface ApiError {
  error: string;
  status: number;
}

export const REFRESHED_TOKEN_HEADER = "x-straude-refreshed-token";

/**
 * Pluggable strategy for re-authenticating when the server returns 401.
 * Registered at startup from index.ts so api.ts doesn't take a hard dependency
 * on the login command (which would be circular).
 */
type AuthRefreshStrategy = (apiUrl: string) => Promise<StraudeConfig | null>;

let authRefreshStrategy: AuthRefreshStrategy | null = null;

export function setAuthRefreshStrategy(fn: AuthRefreshStrategy | null): void {
  authRefreshStrategy = fn;
}

class SessionExpiredError extends Error {
  constructor() {
    super("Session expired or invalid. Run `npx straude@latest login` to re-authenticate.");
    this.name = "SessionExpiredError";
  }
}

async function doRequest<T>(
  config: StraudeConfig,
  path: string,
  options: RequestInit,
): Promise<T> {
  const url = `${config.api_url}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.token}`,
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    if (res.status === 401) {
      throw new SessionExpiredError();
    }
    if (res.status === 404) {
      throw new Error(`Endpoint not found (${path}). Try updating the CLI: bunx straude@latest`);
    }
    throw new Error(message);
  }

  // Sliding-window token refresh: when the server decides our JWT is getting
  // stale it returns a fresh one in a header. Persist it so the next CLI run
  // (and the next request in this same run) uses the new token. Mutating the
  // caller's config in place avoids threading the new token through every
  // call site.
  const refreshed = res.headers?.get?.(REFRESHED_TOKEN_HEADER) ?? null;
  if (refreshed) {
    config.token = refreshed;
    try {
      saveConfig(config);
    } catch {
      // Read-only home directory: keep the new token in memory but don't
      // crash the request — the user just won't get rotation persisted.
    }
  }

  return res.json() as Promise<T>;
}

export async function apiRequest<T>(
  config: StraudeConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    return await doRequest<T>(config, path, options);
  } catch (err) {
    if (
      err instanceof SessionExpiredError &&
      authRefreshStrategy &&
      isInteractive()
    ) {
      const fresh = await authRefreshStrategy(config.api_url);
      if (!fresh) throw err;
      // Update the caller's config in place so any subsequent calls in the
      // same flow (e.g. the dashboard fetch after submit) see the new token.
      config.token = fresh.token;
      config.username = fresh.username;
      return await doRequest<T>(config, path, options);
    }
    throw err;
  }
}

export async function apiRequestNoAuth<T>(
  apiUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${apiUrl}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}
