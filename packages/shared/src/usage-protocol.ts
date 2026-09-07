export const USAGE_PROTOCOL_VERSION = 2 as const;
export const MAX_USAGE_ENTRIES_V2 = 32;
export const MAX_USAGE_AGENTS_PER_DAY_V2 = 64;
export const USAGE_CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COST_EPSILON_USD = 0.005;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ModelUsageComponent {
  model: string;
  input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface AgentUsageComponent {
  agent: string;
  models: string[];
  input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  cost_usd: number;
  model_breakdown: ModelUsageComponent[];
}

export interface UsageCollectorV2 {
  name: string;
  version: string;
  pricing_mode: "online" | "offline";
  metadata?: { [key: string]: JsonValue };
}

export interface UsageInstallationV2 {
  id: string;
  previous_device_id?: string;
  name?: string;
}

export interface UsageEntryV2 {
  date: string;
  content_hash: string;
  agents: AgentUsageComponent[];
  authoritative_correction?: boolean;
  migration_id?: string;
}

export interface UsageSubmitRequestV2 {
  protocol_version: typeof USAGE_PROTOCOL_VERSION;
  request_id: string;
  source: "cli" | "web";
  timezone: string;
  installation: UsageInstallationV2;
  collector: UsageCollectorV2;
  entries: UsageEntryV2[];
}

export interface UsageSubmitResultV2 {
  usage_id: string;
  post_id: string;
  post_url: string;
  action: "created" | "updated";
  previous_cost?: number;
  daily_total?: number;
  device_count?: number;
}

export type UsageOutcomeStatusV2 =
  | "committed"
  | "unchanged"
  | "retryable_error"
  | "permanent_error"
  | "identity_conflict";

export interface UsageOutcomeErrorV2 {
  code: string;
  message: string;
  retry_after_ms?: number;
}

export interface UsageOutcomeV2 {
  date: string;
  status: UsageOutcomeStatusV2;
  result?: UsageSubmitResultV2;
  error?: UsageOutcomeErrorV2;
}

export interface UsageSubmitResponseV2 {
  request_id: string;
  outcomes: UsageOutcomeV2[];
}

export interface UsageProtocolError {
  code: string;
  message: string;
  path?: string;
}

export type UsageProtocolParseResult =
  | { ok: true; value: UsageSubmitRequestV2 }
  | { ok: false; error: UsageProtocolError };

export type AgentUsageParseResult =
  | { ok: true; value: AgentUsageComponent }
  | { ok: false; error: UsageProtocolError };

export type UsageResponseParseResult =
  | { ok: true; value: UsageSubmitResponseV2 }
  | { ok: false; error: UsageProtocolError };

interface NumericUsageFields {
  input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(code: string, message: string, path?: string): UsageProtocolParseResult {
  return { ok: false, error: { code, message, path } };
}

function isValidDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isValidTimezone(value: string): boolean {
  if (value.length === 0 || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function readString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  maxLength = 255,
): string | UsageProtocolError {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    return {
      code: "invalid_request",
      message: `${path} must be a non-empty string no longer than ${maxLength} characters`,
      path,
    };
  }
  return value;
}

function readUsageNumbers(
  record: Record<string, unknown>,
  path: string,
): NumericUsageFields | UsageProtocolError {
  const integerFields = [
    "input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "cache_creation_tokens",
    "cache_read_tokens",
    "total_tokens",
  ] as const;
  const values: Partial<NumericUsageFields> = {};
  for (const field of integerFields) {
    const value = record[field];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      return {
        code: "invalid_usage_number",
        message: `${path}.${field} must be a non-negative safe integer`,
        path: `${path}.${field}`,
      };
    }
    values[field] = value;
  }
  const cost = record.cost_usd;
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) {
    return {
      code: "invalid_usage_number",
      message: `${path}.cost_usd must be a finite non-negative number`,
      path: `${path}.cost_usd`,
    };
  }

  const componentTotal = values.input_tokens!
    + values.output_tokens!
    + values.reasoning_output_tokens!
    + values.cache_creation_tokens!
    + values.cache_read_tokens!;
  if (values.total_tokens !== componentTotal) {
    return {
      code: "invalid_token_total",
      message: `${path}.total_tokens must equal all token categories`,
      path: `${path}.total_tokens`,
    };
  }

  return {
    input_tokens: values.input_tokens!,
    output_tokens: values.output_tokens!,
    reasoning_output_tokens: values.reasoning_output_tokens!,
    cache_creation_tokens: values.cache_creation_tokens!,
    cache_read_tokens: values.cache_read_tokens!,
    total_tokens: values.total_tokens!,
    cost_usd: cost,
  };
}

function isProtocolError(
  value: string | NumericUsageFields | UsageProtocolError,
): value is UsageProtocolError {
  return typeof value === "object" && "code" in value;
}

function parseStringArray(
  value: unknown,
  path: string,
): string[] | UsageProtocolError {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      code: "invalid_request",
      message: `${path} must be a non-empty array`,
      path,
    };
  }
  const strings: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== "string" || item.length === 0 || item.length > 255) {
      return {
        code: "invalid_request",
        message: `${path}[${index}] must be a non-empty string`,
        path: `${path}[${index}]`,
      };
    }
    if (strings.includes(item)) {
      return {
        code: "duplicate_model",
        message: `${path} must not contain duplicate model ids`,
        path,
      };
    }
    strings.push(item);
  }
  return strings;
}

function parseModelComponent(
  value: unknown,
  path: string,
): ModelUsageComponent | UsageProtocolError {
  if (!isRecord(value)) {
    return { code: "invalid_request", message: `${path} must be an object`, path };
  }
  const model = readString(value, "model", `${path}.model`);
  if (typeof model !== "string") return model;
  const numbers = readUsageNumbers(value, path);
  if (isProtocolError(numbers)) return numbers;
  return { model, ...numbers };
}

function parseAgentComponent(
  value: unknown,
  path: string,
): AgentUsageComponent | UsageProtocolError {
  if (!isRecord(value)) {
    return { code: "invalid_request", message: `${path} must be an object`, path };
  }
  const agent = readString(value, "agent", `${path}.agent`, 100);
  if (typeof agent !== "string") return agent;
  const models = parseStringArray(value.models, `${path}.models`);
  if (!Array.isArray(models)) return models;
  const numbers = readUsageNumbers(value, path);
  if (isProtocolError(numbers)) return numbers;
  if (!Array.isArray(value.model_breakdown) || value.model_breakdown.length === 0) {
    return {
      code: "invalid_request",
      message: `${path}.model_breakdown must be a non-empty array`,
      path: `${path}.model_breakdown`,
    };
  }

  const breakdown: ModelUsageComponent[] = [];
  for (let index = 0; index < value.model_breakdown.length; index += 1) {
    const parsed = parseModelComponent(
      value.model_breakdown[index],
      `${path}.model_breakdown[${index}]`,
    );
    if ("code" in parsed) return parsed;
    if (breakdown.some((item) => item.model === parsed.model)) {
      return {
        code: "duplicate_model",
        message: `${path}.model_breakdown must not contain duplicate model ids`,
        path: `${path}.model_breakdown`,
      };
    }
    breakdown.push(parsed);
  }

  const breakdownModels = [...breakdown.map((item) => item.model)].sort();
  const declaredModels = [...models].sort();
  if (JSON.stringify(breakdownModels) !== JSON.stringify(declaredModels)) {
    return {
      code: "invalid_agent_aggregate",
      message: `${path}.models must match model_breakdown model ids`,
      path: `${path}.models`,
    };
  }

  const aggregate = breakdown.reduce<NumericUsageFields>((sum, item) => ({
    input_tokens: sum.input_tokens + item.input_tokens,
    output_tokens: sum.output_tokens + item.output_tokens,
    reasoning_output_tokens: sum.reasoning_output_tokens + item.reasoning_output_tokens,
    cache_creation_tokens: sum.cache_creation_tokens + item.cache_creation_tokens,
    cache_read_tokens: sum.cache_read_tokens + item.cache_read_tokens,
    total_tokens: sum.total_tokens + item.total_tokens,
    cost_usd: sum.cost_usd + item.cost_usd,
  }), {
    input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    cache_creation_tokens: 0,
    cache_read_tokens: 0,
    total_tokens: 0,
    cost_usd: 0,
  });
  const integerFields: Array<keyof Omit<NumericUsageFields, "cost_usd">> = [
    "input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "cache_creation_tokens",
    "cache_read_tokens",
    "total_tokens",
  ];
  if (
    integerFields.some((field) => aggregate[field] !== numbers[field])
    || Math.abs(aggregate.cost_usd - numbers.cost_usd) > COST_EPSILON_USD
  ) {
    return {
      code: "invalid_agent_aggregate",
      message: `${path} totals must equal the sum of model_breakdown`,
      path,
    };
  }

  return {
    agent,
    models,
    ...numbers,
    model_breakdown: breakdown,
  };
}

export function parseAgentUsageComponent(value: unknown): AgentUsageParseResult {
  const parsed = parseAgentComponent(value, "agent");
  return "code" in parsed
    ? { ok: false, error: parsed }
    : { ok: true, value: parsed };
}

function parseJsonObject(value: unknown, path: string): { [key: string]: JsonValue } | UsageProtocolError {
  if (!isRecord(value)) {
    return { code: "invalid_request", message: `${path} must be an object`, path };
  }
  try {
    const roundTripped: unknown = JSON.parse(JSON.stringify(value));
    if (!isRecord(roundTripped)) throw new Error("not an object");
    return roundTripped as { [key: string]: JsonValue };
  } catch {
    return {
      code: "invalid_request",
      message: `${path} must contain JSON-compatible values`,
      path,
    };
  }
}

function isUsageProtocolError(
  value: { [key: string]: JsonValue } | UsageProtocolError,
): value is UsageProtocolError {
  return "code" in value
    && typeof value.code === "string"
    && "message" in value
    && typeof value.message === "string";
}

export function parseUsageSubmitV2(value: unknown): UsageProtocolParseResult {
  if (!isRecord(value) || value.protocol_version !== USAGE_PROTOCOL_VERSION) {
    return error("unsupported_protocol", "protocol_version must be 2", "protocol_version");
  }

  const requestId = readString(value, "request_id", "request_id", 128);
  if (typeof requestId !== "string") return { ok: false, error: requestId };
  if (value.source !== "cli" && value.source !== "web") {
    return error("invalid_source", "source must be cli or web", "source");
  }
  const timezone = readString(value, "timezone", "timezone", 100);
  if (typeof timezone !== "string") return { ok: false, error: timezone };
  if (!isValidTimezone(timezone)) {
    return error("invalid_timezone", "timezone must be a valid IANA timezone", "timezone");
  }

  if (!isRecord(value.installation)) {
    return error("invalid_installation", "installation must be an object", "installation");
  }
  const installationId = readString(value.installation, "id", "installation.id", 36);
  if (typeof installationId !== "string" || !UUID_PATTERN.test(installationId)) {
    return error("invalid_installation", "installation.id must be a UUID", "installation.id");
  }
  const previousDeviceId = value.installation.previous_device_id;
  if (
    previousDeviceId !== undefined
    && (typeof previousDeviceId !== "string"
      || !UUID_PATTERN.test(previousDeviceId)
      || previousDeviceId === installationId)
  ) {
    return error(
      "invalid_installation",
      "installation.previous_device_id must be a distinct UUID",
      "installation.previous_device_id",
    );
  }
  const installationName = value.installation.name;
  if (
    installationName !== undefined
    && (typeof installationName !== "string" || installationName.length > 255)
  ) {
    return error(
      "invalid_installation",
      "installation.name must be no longer than 255 characters",
      "installation.name",
    );
  }

  if (!isRecord(value.collector)) {
    return error("invalid_collector", "collector must be an object", "collector");
  }
  const collectorName = readString(value.collector, "name", "collector.name", 100);
  if (typeof collectorName !== "string") return { ok: false, error: collectorName };
  const collectorVersion = readString(value.collector, "version", "collector.version", 100);
  if (typeof collectorVersion !== "string") return { ok: false, error: collectorVersion };
  if (value.collector.pricing_mode !== "online" && value.collector.pricing_mode !== "offline") {
    return error(
      "invalid_collector",
      "collector.pricing_mode must be online or offline",
      "collector.pricing_mode",
    );
  }
  let collectorMetadata: { [key: string]: JsonValue } | undefined;
  if (value.collector.metadata !== undefined) {
    const parsedMetadata = parseJsonObject(value.collector.metadata, "collector.metadata");
    if (isUsageProtocolError(parsedMetadata)) return { ok: false, error: parsedMetadata };
    collectorMetadata = parsedMetadata;
  }

  if (
    !Array.isArray(value.entries)
    || value.entries.length === 0
    || value.entries.length > MAX_USAGE_ENTRIES_V2
  ) {
    return error(
      "invalid_entries",
      `entries must contain between 1 and ${MAX_USAGE_ENTRIES_V2} days`,
      "entries",
    );
  }

  const entries: UsageEntryV2[] = [];
  const seenDates = new Set<string>();
  for (let entryIndex = 0; entryIndex < value.entries.length; entryIndex += 1) {
    const rawEntry = value.entries[entryIndex];
    const path = `entries[${entryIndex}]`;
    if (!isRecord(rawEntry)) {
      return error("invalid_entry", `${path} must be an object`, path);
    }
    const date = rawEntry.date;
    if (typeof date !== "string" || !isValidDate(date)) {
      return error("invalid_date", `${path}.date must be a real YYYY-MM-DD date`, `${path}.date`);
    }
    if (seenDates.has(date)) {
      return error("duplicate_date", `entries contains duplicate date ${date}`, `${path}.date`);
    }
    seenDates.add(date);
    if (typeof rawEntry.content_hash !== "string" || !USAGE_CONTENT_HASH_PATTERN.test(rawEntry.content_hash)) {
      return error(
        "invalid_content_hash",
        `${path}.content_hash must be a lowercase SHA-256 hex digest`,
        `${path}.content_hash`,
      );
    }
    if (
      !Array.isArray(rawEntry.agents)
      || rawEntry.agents.length === 0
      || rawEntry.agents.length > MAX_USAGE_AGENTS_PER_DAY_V2
    ) {
      return error(
        "invalid_agents",
        `${path}.agents must contain between 1 and ${MAX_USAGE_AGENTS_PER_DAY_V2} agents`,
        `${path}.agents`,
      );
    }
    const agents: AgentUsageComponent[] = [];
    for (let agentIndex = 0; agentIndex < rawEntry.agents.length; agentIndex += 1) {
      const parsedAgent = parseAgentComponent(
        rawEntry.agents[agentIndex],
        `${path}.agents[${agentIndex}]`,
      );
      if ("code" in parsedAgent) return { ok: false, error: parsedAgent };
      if (agents.some((agent) => agent.agent === parsedAgent.agent)) {
        return error(
          "duplicate_agent",
          `${path}.agents must not contain duplicate agent ids`,
          `${path}.agents[${agentIndex}].agent`,
        );
      }
      agents.push(parsedAgent);
    }
    if (
      rawEntry.authoritative_correction !== undefined
      && typeof rawEntry.authoritative_correction !== "boolean"
    ) {
      return error(
        "invalid_entry",
        `${path}.authoritative_correction must be boolean`,
        `${path}.authoritative_correction`,
      );
    }
    if (
      rawEntry.migration_id !== undefined
      && (typeof rawEntry.migration_id !== "string"
        || rawEntry.migration_id.length === 0
        || rawEntry.migration_id.length > 100)
    ) {
      return error(
        "invalid_entry",
        `${path}.migration_id must be a non-empty string no longer than 100 characters`,
        `${path}.migration_id`,
      );
    }
    entries.push({
      date,
      content_hash: rawEntry.content_hash,
      agents,
      ...(rawEntry.authoritative_correction === undefined
        ? {}
        : { authoritative_correction: rawEntry.authoritative_correction }),
      ...(rawEntry.migration_id === undefined ? {} : { migration_id: rawEntry.migration_id }),
    });
  }

  return {
    ok: true,
    value: {
      protocol_version: USAGE_PROTOCOL_VERSION,
      request_id: requestId,
      source: value.source,
      timezone,
      installation: {
        id: installationId,
        ...(previousDeviceId === undefined ? {} : { previous_device_id: previousDeviceId }),
        ...(installationName === undefined ? {} : { name: installationName }),
      },
      collector: {
        name: collectorName,
        version: collectorVersion,
        pricing_mode: value.collector.pricing_mode,
        ...(collectorMetadata === undefined ? {} : { metadata: collectorMetadata }),
      },
      entries,
    },
  };
}

function sortObject(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortObject(value[key]!)]),
  );
}

export function canonicalizeUsageEntryV2(entry: UsageEntryV2): string {
  const canonicalAgents = [...entry.agents]
    .sort((left, right) => left.agent.localeCompare(right.agent))
    .map((agent) => ({
      ...agent,
      models: [...agent.models].sort(),
      model_breakdown: [...agent.model_breakdown]
        .sort((left, right) => left.model.localeCompare(right.model))
        .map((model) => ({ ...model })),
    }));
  const canonical = {
    date: entry.date,
    agents: canonicalAgents,
    authoritative_correction: entry.authoritative_correction ?? false,
    migration_id: entry.migration_id ?? null,
  };
  const jsonCompatible: JsonValue = JSON.parse(JSON.stringify(canonical));
  return JSON.stringify(sortObject(jsonCompatible));
}

function parseOutcomeResult(value: unknown, path: string): UsageSubmitResultV2 | UsageProtocolError {
  if (!isRecord(value)) {
    return { code: "invalid_response", message: `${path} must be an object`, path };
  }
  const usageId = readString(value, "usage_id", `${path}.usage_id`, 100);
  if (typeof usageId !== "string") return usageId;
  const postId = readString(value, "post_id", `${path}.post_id`, 100);
  if (typeof postId !== "string") return postId;
  const postUrl = readString(value, "post_url", `${path}.post_url`, 2_048);
  if (typeof postUrl !== "string") return postUrl;
  if (value.action !== "created" && value.action !== "updated") {
    return {
      code: "invalid_response",
      message: `${path}.action must be created or updated`,
      path: `${path}.action`,
    };
  }
  const optionalNumbers = ["previous_cost", "daily_total", "device_count"] as const;
  for (const field of optionalNumbers) {
    const number = value[field];
    if (
      number !== undefined
      && (typeof number !== "number" || !Number.isFinite(number) || number < 0)
    ) {
      return {
        code: "invalid_response",
        message: `${path}.${field} must be a finite non-negative number`,
        path: `${path}.${field}`,
      };
    }
  }
  return {
    usage_id: usageId,
    post_id: postId,
    post_url: postUrl,
    action: value.action,
    ...(typeof value.previous_cost === "number" ? { previous_cost: value.previous_cost } : {}),
    ...(typeof value.daily_total === "number" ? { daily_total: value.daily_total } : {}),
    ...(typeof value.device_count === "number" ? { device_count: value.device_count } : {}),
  };
}

function parseOutcomeError(value: unknown, path: string): UsageOutcomeErrorV2 | UsageProtocolError {
  if (!isRecord(value)) {
    return { code: "invalid_response", message: `${path} must be an object`, path };
  }
  const code = readString(value, "code", `${path}.code`, 100);
  if (typeof code !== "string") return code;
  const message = readString(value, "message", `${path}.message`, 2_048);
  if (typeof message !== "string") return message;
  if (
    value.retry_after_ms !== undefined
    && (
      typeof value.retry_after_ms !== "number"
      || !Number.isSafeInteger(value.retry_after_ms)
      || value.retry_after_ms < 0
    )
  ) {
    return {
      code: "invalid_response",
      message: `${path}.retry_after_ms must be a non-negative safe integer`,
      path: `${path}.retry_after_ms`,
    };
  }
  return {
    code,
    message,
    ...(typeof value.retry_after_ms === "number"
      ? { retry_after_ms: value.retry_after_ms }
      : {}),
  };
}

function responseError(code: string, message: string, path?: string): UsageResponseParseResult {
  return { ok: false, error: { code, message, path } };
}

function isUsageOutcomeStatus(value: unknown): value is UsageOutcomeStatusV2 {
  return value === "committed"
    || value === "unchanged"
    || value === "retryable_error"
    || value === "permanent_error"
    || value === "identity_conflict";
}

export function parseUsageSubmitResponseV2(value: unknown): UsageResponseParseResult {
  if (!isRecord(value)) {
    return responseError("invalid_response", "response must be an object");
  }
  const requestId = readString(value, "request_id", "request_id", 128);
  if (typeof requestId !== "string") return { ok: false, error: requestId };
  if (
    !Array.isArray(value.outcomes)
    || value.outcomes.length === 0
    || value.outcomes.length > MAX_USAGE_ENTRIES_V2
  ) {
    return responseError(
      "invalid_response",
      `outcomes must contain between 1 and ${MAX_USAGE_ENTRIES_V2} entries`,
      "outcomes",
    );
  }

  const outcomes: UsageOutcomeV2[] = [];
  const seenDates = new Set<string>();
  for (let index = 0; index < value.outcomes.length; index += 1) {
    const candidate = value.outcomes[index];
    const path = `outcomes[${index}]`;
    if (!isRecord(candidate)) {
      return responseError("invalid_response", `${path} must be an object`, path);
    }
    if (typeof candidate.date !== "string" || !isValidDate(candidate.date)) {
      return responseError("invalid_response", `${path}.date must be a real YYYY-MM-DD date`, `${path}.date`);
    }
    if (seenDates.has(candidate.date)) {
      return responseError("duplicate_date", `outcomes contains duplicate date ${candidate.date}`, `${path}.date`);
    }
    seenDates.add(candidate.date);
    if (!isUsageOutcomeStatus(candidate.status)) {
      return responseError("invalid_response", `${path}.status is invalid`, `${path}.status`);
    }
    const status = candidate.status;
    if (status === "committed" || status === "unchanged") {
      if (candidate.result === undefined) {
        outcomes.push({ date: candidate.date, status });
        continue;
      }
      const result = parseOutcomeResult(candidate.result, `${path}.result`);
      if ("code" in result) return { ok: false, error: result };
      outcomes.push({ date: candidate.date, status, result });
      continue;
    }
    const outcomeError = parseOutcomeError(candidate.error, `${path}.error`);
    if ("path" in outcomeError || !("code" in outcomeError) || !("message" in outcomeError)) {
      return { ok: false, error: outcomeError };
    }
    outcomes.push({ date: candidate.date, status, error: outcomeError });
  }
  return {
    ok: true,
    value: {
      request_id: requestId,
      outcomes,
    },
  };
}
