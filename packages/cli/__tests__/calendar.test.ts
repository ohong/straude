import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  assertCalendarDate,
  calendarDaysBetween,
  isCalendarDate,
  listCalendarDates,
  localCalendarDate,
} from "../src/lib/calendar.js";

describe("calendar helpers", () => {
  it("rejects malformed and impossible dates", () => {
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2026-2-01")).toBe(false);
    expect(() => assertCalendarDate("2026-13-01")).toThrow(/real calendar date/);
  });

  it("does calendar arithmetic without DST-length assumptions", () => {
    expect(addCalendarDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(calendarDaysBetween("2026-03-07", "2026-03-10")).toBe(3);
    expect(listCalendarDates("2026-03-07", "2026-03-10")).toEqual([
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
      "2026-03-10",
    ]);
  });

  it("resolves the calendar date in the supplied IANA timezone", () => {
    const instant = new Date("2026-01-01T01:00:00.000Z");
    expect(localCalendarDate(instant, "America/Vancouver")).toBe("2025-12-31");
    expect(localCalendarDate(instant, "Asia/Tokyo")).toBe("2026-01-01");
  });
});
