import { describe, it, expect } from "vitest";
import { resolvePushDateRange } from "../src/commands/push.js";

/**
 * Build a Date at midnight local time. Matches the behavior of the production
 * `parseDate` helper inside push.ts so day-boundary math doesn't drift by 12h.
 */
function dateAt(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("resolvePushDateRange", () => {
  describe("--date branch", () => {
    it("returns the exact date for both since and until", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: { date: "2026-05-01" },
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(isoDay(r.since)).toBe("2026-05-01");
      expect(isoDay(r.until)).toBe("2026-05-01");
    });

    it("rejects dates outside the 30-day backfill window", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: { date: "2025-12-01" },
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toContain("within the last 30 days");
    });

    it("rejects near-future dates with the future-date error", () => {
      // Use a date that's in the future but inside the 30-day window so we
      // hit the future-date check, not the backfill-window check (which
      // fires first for far-future dates).
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: { date: "2026-05-05" },
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toContain("future date");
    });

    it("rejects far-future dates with the backfill-window error", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: { date: "2099-01-01" },
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toContain("within the last 30 days");
    });

    it("accepts a date exactly 30 days back (boundary)", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: { date: "2026-04-04" },
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(true);
    });

    it("--date wins over codex repair when both would apply", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: { date: "2026-05-03" },
        shouldRunCodexRepair: true,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(isoDay(r.since)).toBe("2026-05-03");
    });
  });

  describe("codex repair branch", () => {
    it("backfills the full 30-day window when codex repair runs", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: {},
        shouldRunCodexRepair: true,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(isoDay(r.since)).toBe("2026-04-05"); // today - 29 days
      expect(isoDay(r.until)).toBe("2026-05-04");
    });

    it("ignores --days when codex repair runs", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: { days: 5 },
        shouldRunCodexRepair: true,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(isoDay(r.since)).toBe("2026-04-05"); // 30-day backfill, not 5
    });
  });

  describe("--days branch", () => {
    it("backfills exactly N days when given --days N", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: { days: 7 },
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(isoDay(r.since)).toBe("2026-04-28");
      expect(isoDay(r.until)).toBe("2026-05-04");
    });

    it("caps --days at MAX_BACKFILL_DAYS even if user requests more", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: { days: 90 },
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(isoDay(r.since)).toBe("2026-04-05"); // today - 29
    });
  });

  describe("smart-sync from last_push_date", () => {
    it("includes the last_push_date when it's within DEFAULT_SYNC_DAYS", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: {},
        lastPushDate: "2026-05-01",
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(isoDay(r.since)).toBe("2026-05-01");
      expect(isoDay(r.until)).toBe("2026-05-04");
    });

    it("caps at DEFAULT_SYNC_DAYS when last_push_date is too far back", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: {},
        lastPushDate: "2026-04-15",
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(isoDay(r.since)).toBe("2026-04-28"); // today - 6 (DEFAULT_SYNC_DAYS=7, +1)
    });

    it("re-syncs only today when last_push_date >= today", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: {},
        lastPushDate: "2026-05-04",
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(isoDay(r.since)).toBe("2026-05-04");
      expect(isoDay(r.until)).toBe("2026-05-04");
    });
  });

  describe("fresh install (no last_push_date)", () => {
    it("backfills last 3 days by default", () => {
      const r = resolvePushDateRange({
        today: dateAt("2026-05-04"),
        options: {},
        shouldRunCodexRepair: false,
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(isoDay(r.since)).toBe("2026-05-02"); // today - 2
      expect(isoDay(r.until)).toBe("2026-05-04");
    });
  });
});
