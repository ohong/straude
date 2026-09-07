import { MAX_BACKFILL_DAYS } from "../config.js";
import { assertCalendarDate } from "./calendar.js";

const MAX_TIMEOUT_SECONDS = 3_600;
const COMMANDS = new Set(["push", "login", "status", "auto", "devices", "help"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALUE_FLAGS = new Set(["--date", "--days", "--timeout", "--time", "--api-url"]);

export interface ParsedCliOptions {
  dryRun?: true;
  auto?: true;
  noAuto?: true;
  autoMechanism?: "hooks";
  time?: string;
  date?: string;
  days?: number;
  timeoutMs?: number;
  apiUrl?: string;
  help?: true;
  version?: true;
  debug?: true;
  nonInteractive?: true;
}

export interface ParsedCliArgs {
  command: string | null;
  subcommand: string | null;
  operand: string | null;
  options: ParsedCliOptions;
}

export class CliArgumentError extends Error {
  readonly code = "ARG_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "CliArgumentError";
  }
}

function positiveInteger(value: string, flag: string): number {
  if (!/^\d+$/.test(value)) {
    throw new CliArgumentError(`${flag} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new CliArgumentError(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("-")) {
    throw new CliArgumentError(`${flag} requires a value.`);
  }
  return value;
}

function markSeen(seen: Set<string>, flag: string): void {
  if (seen.has(flag)) throw new CliArgumentError(`${flag} may only be specified once.`);
  seen.add(flag);
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
  const options: ParsedCliOptions = {};
  const seen = new Set<string>();
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--") {
      positional.push(...args.slice(index + 1));
      break;
    }
    if (!argument.startsWith("-")) {
      positional.push(argument);
      continue;
    }
    if (argument.startsWith("--") && argument.includes("=")) {
      throw new CliArgumentError(`Use a space after ${argument.slice(0, argument.indexOf("="))}; --flag=value is unsupported.`);
    }
    markSeen(seen, argument);

    if (VALUE_FLAGS.has(argument)) {
      const value = requireValue(args, index, argument);
      index += 1;
      switch (argument) {
        case "--date":
          try {
            options.date = assertCalendarDate(value);
          } catch {
            throw new CliArgumentError("--date must be a real calendar date in YYYY-MM-DD format.");
          }
          break;
        case "--days": {
          const days = positiveInteger(value, "--days");
          if (days > MAX_BACKFILL_DAYS) {
            throw new CliArgumentError(`--days must be between 1 and ${MAX_BACKFILL_DAYS}.`);
          }
          options.days = days;
          break;
        }
        case "--timeout": {
          const seconds = positiveInteger(value, "--timeout");
          if (seconds > MAX_TIMEOUT_SECONDS) {
            throw new CliArgumentError(`--timeout must be between 1 and ${MAX_TIMEOUT_SECONDS} seconds.`);
          }
          options.timeoutMs = seconds * 1_000;
          break;
        }
        case "--time":
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
            throw new CliArgumentError("--time must use 24-hour HH:MM format.");
          }
          options.time = value;
          break;
        case "--api-url":
          try {
            const url = new URL(value);
            if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
            options.apiUrl = url.toString().replace(/\/$/, "");
          } catch {
            throw new CliArgumentError("--api-url must be an HTTP or HTTPS URL.");
          }
          break;
      }
      continue;
    }

    switch (argument) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--auto":
        options.auto = true;
        break;
      case "--no-auto":
        options.noAuto = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--version":
      case "-v":
        options.version = true;
        break;
      case "--debug":
        options.debug = true;
        break;
      case "--non-interactive":
        options.nonInteractive = true;
        break;
      default:
        throw new CliArgumentError(`Unknown option: ${argument}`);
    }
  }

  let command: string | null = positional[0] ?? null;
  let subcommand: string | null = positional[1] ?? null;
  let operand: string | null = positional[2] ?? null;
  if (positional.length > 3) {
    throw new CliArgumentError(`Unexpected argument: ${positional[3]}`);
  }
  if (command === "hooks" && options.auto) {
    options.autoMechanism = "hooks";
    command = null;
    subcommand = null;
    operand = null;
  }
  if (command && !COMMANDS.has(command)) {
    throw new CliArgumentError(`Unknown command: ${command}`);
  }
  if (command === "auto" && subcommand !== null && subcommand !== "logs") {
    throw new CliArgumentError(`Unsupported auto subcommand: ${subcommand}`);
  }
  if (command === "devices") {
    if (subcommand === null && operand !== null) {
      throw new CliArgumentError(`Unexpected devices argument: ${operand}`);
    }
    if (subcommand !== null && subcommand !== "merge" && subcommand !== "keep-separate") {
      throw new CliArgumentError(`Unsupported devices subcommand: ${subcommand}`);
    }
    if (subcommand !== null && (operand === null || !UUID_PATTERN.test(operand))) {
      throw new CliArgumentError(`devices ${subcommand} requires a candidate UUID.`);
    }
  } else {
    if (operand !== null) {
      throw new CliArgumentError(`Unexpected argument for ${command ?? "push"}: ${operand}`);
    }
    if (command !== "auto" && subcommand !== null) {
      throw new CliArgumentError(`Unexpected argument for ${command ?? "push"}: ${subcommand}`);
    }
  }
  if (options.date && options.days !== undefined) {
    throw new CliArgumentError("--date and --days cannot be used together.");
  }
  if (options.auto && options.noAuto) {
    throw new CliArgumentError("--auto and --no-auto cannot be used together.");
  }

  const resolvedCommand = command ?? "push";
  const pushOnly = options.date !== undefined
    || options.days !== undefined
    || options.timeoutMs !== undefined
    || options.dryRun === true
    || options.auto === true
    || options.noAuto === true
    || options.time !== undefined;
  if (pushOnly && resolvedCommand !== "push") {
    throw new CliArgumentError("Push options can only be used with the push command.");
  }
  return { command, subcommand, operand, options };
}

export function assertSupportedNodeRuntime(version = process.versions.node): void {
  const match = /^(\d+)\./.exec(version);
  const major = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(major) || major < 20) {
    throw new CliArgumentError(
      `Straude requires Node.js 20 or newer (detected ${version}). Update Node.js and retry.`,
    );
  }
}
