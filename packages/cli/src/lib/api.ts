import type { StraudeConfig } from "./auth.js";

export interface ApiError {
  error: string;
  status: number;
}

export async function apiRequest<T>(
  config: StraudeConfig,
  path: string,
  options: RequestInit = {},
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
      throw new Error("Session expired or invalid. Run `straude login` to re-authenticate.");
    }
    if (res.status === 404) {
      throw new Error(`Endpoint not found (${path}). Try updating the CLI: bunx straude@latest`);
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
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
