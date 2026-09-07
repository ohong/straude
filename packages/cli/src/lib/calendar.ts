const CALENDAR_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

function parseParts(value: string): CalendarParts | null {
  const match = CALENDAR_DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year
    || utc.getUTCMonth() !== month - 1
    || utc.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function ordinal(value: string): number {
  const parts = parseParts(value);
  if (!parts) throw new Error(`Invalid calendar date: ${value}`);
  return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS;
}

export function isCalendarDate(value: string): boolean {
  return parseParts(value) !== null;
}

export function assertCalendarDate(value: string, label = "date"): string {
  if (!isCalendarDate(value)) {
    throw new Error(`Invalid ${label}: ${value} (expected a real calendar date in YYYY-MM-DD format).`);
  }
  return value;
}

export function addCalendarDays(value: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error("Calendar day offset must be an integer.");
  const next = new Date((ordinal(value) + days) * DAY_MS);
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function calendarDaysBetween(start: string, end: string): number {
  return ordinal(end) - ordinal(start);
}

export function listCalendarDates(start: string, end: string): string[] {
  const days = calendarDaysBetween(start, end);
  if (days < 0) throw new Error(`Calendar range ends before it starts: ${start} to ${end}.`);
  return Array.from({ length: days + 1 }, (_, index) => addCalendarDays(start, index));
}

export function compactCalendarDate(value: string): string {
  assertCalendarDate(value);
  return value.replaceAll("-", "");
}

export function localCalendarDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const value = `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
  return assertCalendarDate(value, "local date");
}

export function calendarDateToLocalDate(value: string): Date {
  const parts = parseParts(assertCalendarDate(value));
  if (!parts) throw new Error(`Invalid calendar date: ${value}`);
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function localDateToCalendarDate(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}
