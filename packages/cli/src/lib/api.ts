import type { StraudeConfig } from "./auth.js";
import { updateConfig } from "./auth.js";
import { isInteractive } from "./prompt.js";

export const REFRESHED_TOKEN_HEADER = "x-straude-refreshed-token";
export const DEFAULT_API_TIMEOUT_MS = 15_000;
export const DEFAULT_API_RETRIES = 2;

const MAX_RETRY_DELAY_MS = 5_000;

export interface ApiRequestOptions extends RequestInit {
  /** Total wall-clock budget for the request, including retries and backoff. */
  timeoutMs?: number;
  /** Absolute epoch deadline. The earlier of this and timeoutMs wins. */
  deadlineAt?: number;
  /** Defaults to two for GET/HEAD and zero for mutation requests. */
  maxRetries?: number;
  /** Non-2xx statuses whose JSON body is part of the caller's typed protocol. */
  acceptedStatuses?: readonly number[];
}

type AuthRefreshStrategy = (apiUrl: string) => Promise<StraudeConfig | null>;

let authRefreshStrategy: AuthRefreshStrategy | null = null;

export function setAuthRefreshStrategy(fn: AuthRefreshStrategy | null): void {
  authRefreshStrategy = fn;
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(message: string, status: number, retryAfterMs: number | null = null) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }

  get retryable(): boolean {
    return this.status === 408 ||
      this.status === 425 ||
      this.status === 429 ||
      (this.status >= 500 && this.status <= 599);
  }
}

export class ApiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms.`);
    this.name = "ApiTimeoutError";
  }
}

class SessionExpiredError extends ApiHttpError {
  constructor() {
    super(
      "Session expired or invalid. Run `npx straude@latest login` to re-authenticate.",
      401,
    );
    this.name = "SessionExpiredError";
  }
}

interface PreparedRequest {
  fetchOptions: RequestInit;
  deadlineAt: number;
  timeoutMs: number;
  maxRetries: number;
  acceptedStatuses: ReadonlySet<number>;
}

function prepareRequest(options: ApiRequestOptions): PreparedRequest {
  const {
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
    deadlineAt: requestedDeadline,
    maxRetries,
    acceptedStatuses = [],
    ...fetchOptions
  } = options;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("API timeout must be a positive finite number.");
  }
  const timeoutDeadline = Date.now() + timeoutMs;
  const deadlineAt = requestedDeadline == null
    ? timeoutDeadline
    : Math.min(timeoutDeadline, requestedDeadline);
  const method = (fetchOptions.method ?? "GET").toUpperCase();
  const resolvedRetries = maxRetries ?? (method === "GET" || method === "HEAD"
    ? DEFAULT_API_RETRIES
    : 0);
  if (!Number.isInteger(resolvedRetries) || resolvedRetries < 0) {
    throw new Error("API maxRetries must be a non-negative integer.");
  }
  if (acceptedStatuses.some((status) => (
    !Number.isInteger(status) || status < 100 || status > 599
  ))) {
    throw new Error("Accepted API statuses must be HTTP status integers.");
  }
  return {
    fetchOptions,
    deadlineAt,
    timeoutMs,
    maxRetries: resolvedRetries,
    acceptedStatuses: new Set(acceptedStatuses),
  };
}

function retryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(raw);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function backoffMs(attempt: number, requested: number | null): number {
  if (requested != null) return requested;
  const ceiling = Math.min(250 * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return Math.floor(Math.random() * (ceiling + 1));
}

function sleep(ms: number, deadlineAt: number): Promise<void> {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0 || ms >= remaining) {
    return Promise.reject(new ApiTimeoutError(Math.max(0, remaining)));
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown): boolean {
  return error instanceof TypeError ||
    (error instanceof Error &&
      ["ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      ));
}

async function fetchAttempt(
  url: string,
  options: RequestInit,
  deadlineAt: number,
  timeoutMs: number,
): Promise<Response> {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) throw new ApiTimeoutError(timeoutMs);

  const controller = new AbortController();
  const callerSignal = options.signal;
  const abortFromCaller = (): void => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new ApiTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function readJson(
  response: Response,
  deadlineAt: number,
  timeoutMs: number,
): Promise<unknown> {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) {
    await response.body?.cancel().catch(() => {});
    throw new ApiTimeoutError(timeoutMs);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      response.json(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void response.body?.cancel().catch(() => {});
          reject(new ApiTimeoutError(timeoutMs));
        }, remaining);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function errorForResponse(
  response: Response,
  path: string,
  prepared: PreparedRequest,
): Promise<Error> {
  let message = `HTTP ${response.status}`;
  try {
    const body = await readJson(
      response,
      prepared.deadlineAt,
      prepared.timeoutMs,
    ) as { error?: string };
    if (body.error) message = body.error;
  } catch (error) {
    if (error instanceof ApiTimeoutError) throw error;
    // Preserve the status fallback when the error body is not JSON.
  }
  if (response.status === 401) return new SessionExpiredError();
  if (response.status === 404) {
    return new ApiHttpError(
      `Endpoint not found (${path}). Try updating the CLI: bunx straude@latest`,
      response.status,
    );
  }
  return new ApiHttpError(message, response.status, retryAfterMs(response));
}

async function requestWithRetries(
  url: string,
  path: string,
  prepared: PreparedRequest,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetchAttempt(
        url,
        prepared.fetchOptions,
        prepared.deadlineAt,
        prepared.timeoutMs,
      );
      if (response.ok || prepared.acceptedStatuses.has(response.status)) {
        return response;
      }
      const error = await errorForResponse(response, path, prepared);
      if (
        !(error instanceof ApiHttpError) ||
        !error.retryable ||
        attempt >= prepared.maxRetries
      ) {
        throw error;
      }
      await sleep(backoffMs(attempt, error.retryAfterMs), prepared.deadlineAt);
    } catch (error) {
      if (
        error instanceof ApiHttpError ||
        error instanceof ApiTimeoutError ||
        !isRetryableNetworkError(error) ||
        attempt >= prepared.maxRetries
      ) {
        throw error;
      }
      await sleep(backoffMs(attempt, null), prepared.deadlineAt);
    }
    attempt += 1;
  }
}

async function doRequest<T>(
  config: StraudeConfig,
  path: string,
  options: ApiRequestOptions,
): Promise<T> {
  const prepared = prepareRequest(options);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.token}`,
    ...(prepared.fetchOptions.headers as Record<string, string> | undefined),
  };
  prepared.fetchOptions = { ...prepared.fetchOptions, headers };

  const response = await requestWithRetries(
    `${config.api_url}${path}`,
    path,
    prepared,
  );

  const refreshed = response.headers.get(REFRESHED_TOKEN_HEADER);
  if (refreshed) {
    config.token = refreshed;
    try {
      updateConfig((current) => current
        ? { ...current, token: refreshed }
        : { ...config, token: refreshed });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EACCES" && code !== "EPERM" && code !== "EROFS") throw error;
    }
  }

  return readJson(response, prepared.deadlineAt, prepared.timeoutMs) as Promise<T>;
}

export async function apiRequest<T>(
  config: StraudeConfig,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  try {
    return await doRequest<T>(config, path, options);
  } catch (error) {
    if (
      error instanceof SessionExpiredError &&
      authRefreshStrategy &&
      isInteractive()
    ) {
      const fresh = await authRefreshStrategy(config.api_url);
      if (!fresh) throw error;
      config.token = fresh.token;
      config.username = fresh.username;
      return doRequest<T>(config, path, { ...options, maxRetries: 0 });
    }
    throw error;
  }
}

export async function apiRequestNoAuth<T>(
  apiUrl: string,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const prepared = prepareRequest(options);
  prepared.fetchOptions = {
    ...prepared.fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(prepared.fetchOptions.headers as Record<string, string> | undefined),
    },
  };
  const response = await requestWithRetries(`${apiUrl}${path}`, path, prepared);
  return readJson(response, prepared.deadlineAt, prepared.timeoutMs) as Promise<T>;
}
