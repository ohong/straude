import { describe, it, expect } from "vitest";
import { COUNTRY_TO_REGION, REGIONS, type Region } from "@/lib/constants/regions";

describe("regions", () => {
  describe("COUNTRY_TO_REGION", () => {
    it.each([
      ["US", "north_america"],
      ["CA", "north_america"],
      ["MX", "north_america"],
      ["GB", "europe"],
      ["DE", "europe"],
      ["FR", "europe"],
      ["JP", "asia"],
      ["CN", "asia"],
      ["IN", "asia"],
      ["AU", "oceania"],
      ["NZ", "oceania"],
      ["BR", "south_america"],
      ["AR", "south_america"],
      ["NG", "africa"],
      ["ZA", "africa"],
    ])("maps %s to %s", (country, region) => {
      expect(COUNTRY_TO_REGION[country]).toBe(region);
    });
  });

  describe("REGIONS", () => {
    it("has all 6 regions", () => {
      expect(REGIONS).toHaveLength(6);
    });

    it("contains the expected region values", () => {
      const values = REGIONS.map((r) => r.value);
      expect(values).toContain("north_america");
      expect(values).toContain("south_america");
      expect(values).toContain("europe");
      expect(values).toContain("asia");
      expect(values).toContain("africa");
      expect(values).toContain("oceania");
    });

    it("each region has a label", () => {
      for (const region of REGIONS) {
        expect(region.label).toBeTruthy();
        expect(typeof region.label).toBe("string");
      }
    });
  });

  describe("mapping consistency", () => {
    it("all countries map to a valid region from REGIONS", () => {
      const validValues = new Set(REGIONS.map((r) => r.value));
      for (const [country, region] of Object.entries(COUNTRY_TO_REGION)) {
        expect(validValues.has(region as Region)).toBe(true);
      }
    });
  });
});
