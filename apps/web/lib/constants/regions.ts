/** Country-to-region mapping for leaderboard filtering */
export const COUNTRY_TO_REGION: Record<string, string> = {
  // North America
  US: "north_america", CA: "north_america", MX: "north_america",
  GT: "north_america", BZ: "north_america", SV: "north_america",
  HN: "north_america", NI: "north_america", CR: "north_america",
  PA: "north_america", CU: "north_america", JM: "north_america",
  HT: "north_america", DO: "north_america", TT: "north_america",
  BB: "north_america", BS: "north_america", PR: "north_america",

  // South America
  BR: "south_america", AR: "south_america", CL: "south_america",
  CO: "south_america", PE: "south_america", VE: "south_america",
  EC: "south_america", BO: "south_america", PY: "south_america",
  UY: "south_america", GY: "south_america", SR: "south_america",

  // Europe
  GB: "europe", DE: "europe", FR: "europe", ES: "europe",
  IT: "europe", NL: "europe", PL: "europe", SE: "europe",
  NO: "europe", DK: "europe", FI: "europe", CH: "europe",
  AT: "europe", BE: "europe", IE: "europe", PT: "europe",
  CZ: "europe", RO: "europe", HU: "europe", UA: "europe",
  GR: "europe", HR: "europe", SK: "europe", BG: "europe",
  RS: "europe", LT: "europe", LV: "europe", EE: "europe",
  SI: "europe", IS: "europe", LU: "europe", MT: "europe",

  // Asia
  CN: "asia", JP: "asia", KR: "asia", IN: "asia",
  SG: "asia", ID: "asia", TH: "asia", VN: "asia",
  MY: "asia", PH: "asia", TW: "asia", HK: "asia",
  IL: "asia", AE: "asia", SA: "asia", PK: "asia",
  BD: "asia", LK: "asia", NP: "asia", KZ: "asia",
  UZ: "asia", MM: "asia", KH: "asia", LA: "asia",

  // Africa
  NG: "africa", ZA: "africa", EG: "africa", KE: "africa",
  GH: "africa", TZ: "africa", ET: "africa", MA: "africa",
  TN: "africa", DZ: "africa", UG: "africa", RW: "africa",
  SN: "africa", CI: "africa", CM: "africa", MZ: "africa",

  // Oceania
  AU: "oceania", NZ: "oceania", FJ: "oceania", PG: "oceania",
  WS: "oceania", TO: "oceania",
};

export const REGIONS = [
  { value: "north_america", label: "North America" },
  { value: "south_america", label: "South America" },
  { value: "europe", label: "Europe" },
  { value: "asia", label: "Asia" },
  { value: "africa", label: "Africa" },
  { value: "oceania", label: "Oceania" },
] as const;

export type Region = (typeof REGIONS)[number]["value"];
