"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { TokenRichCompany } from "@/data/token-rich";

type StageFilter = "all" | "Big Tech" | "Startup";
type PolicyFilter = "all" | "Unlimited" | "Very High";
type CountryFilter = string; // "all" or a country name
type SortKey = null | "name" | "hqCity" | "stage" | "policy";
type SortDir = "asc" | "desc";

const US_STATES = new Set(["CA", "FL", "NY", "WA"]);

function getCountry(hqCity: string): string {
  const region = hqCity.split(", ").pop() ?? "";
  return US_STATES.has(region) ? "United States" : region || "United States";
}

const STAGE_FILTERS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Big Tech", label: "Big Tech" },
  { value: "Startup", label: "Startup" },
];

const POLICY_FILTERS: { value: PolicyFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Unlimited", label: "Unlimited" },
  { value: "Very High", label: "Very High" },
];

const COUNTRY_FLAGS: Record<string, string> = {
  CA: "\uD83C\uDDFA\uD83C\uDDF8",
  FL: "\uD83C\uDDFA\uD83C\uDDF8",
  NY: "\uD83C\uDDFA\uD83C\uDDF8",
  WA: "\uD83C\uDDFA\uD83C\uDDF8",
  Spain: "\uD83C\uDDEA\uD83C\uDDF8",
  China: "\uD83C\uDDE8\uD83C\uDDF3",
  Germany: "\uD83C\uDDE9\uD83C\uDDEA",
  UAE: "\uD83C\uDDE6\uD83C\uDDEA",
  UK: "\uD83C\uDDEC\uD83C\uDDE7",
  Canada: "\uD83C\uDDE8\uD83C\uDDE6",
  India: "\uD83C\uDDEE\uD83C\uDDF3",
  Singapore: "\uD83C\uDDF8\uD83C\uDDEC",
  Australia: "\uD83C\uDDE6\uD83C\uDDFA",
  Ireland: "\uD83C\uDDEE\uD83C\uDDEA",
  Finland: "\uD83C\uDDEB\uD83C\uDDEE",
  Quebec: "\uD83C\uDDE8\uD83C\uDDE6",
};

function formatLocation(hqCity: string): { city: string; flag: string } {
  const parts = hqCity.split(", ");
  const city = parts[0];
  const region = parts[parts.length - 1] ?? "";
  const flag = COUNTRY_FLAGS[region] ?? "\uD83C\uDDFA\uD83C\uDDF8";
  return { city, flag };
}

function compare(a: string, b: string, dir: SortDir): number {
  const result = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? result : -result;
}

function SortIndicator({ column, sortKey, sortDir }: { column: string; sortKey: string | null; sortDir: SortDir }) {
  if (sortKey !== column) {
    return <ChevronsUpDown size={12} className="ml-1 inline opacity-30" aria-hidden />;
  }
  return sortDir === "asc"
    ? <ChevronUp size={12} className="ml-1 inline text-foreground" aria-hidden />
    : <ChevronDown size={12} className="ml-1 inline text-foreground" aria-hidden />;
}

const FREE_LIMIT = 20;

export function PrometheusTable({
  companies,
  onSuggest,
  isLoggedIn = false,
}: {
  companies: TokenRichCompany[];
  onSuggest?: () => void;
  isLoggedIn?: boolean;
}) {
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [policyFilter, setPolicyFilter] = useState<PolicyFilter>("all");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const countryOptions = useMemo(() => {
    const countries = [...new Set(companies.map((c) => getCountry(c.hqCity)))].sort();
    return countries;
  }, [companies]);

  function toggleSort(key: NonNullable<SortKey>) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    let result = companies;
    if (stageFilter !== "all") {
      result = result.filter((c) => c.stage === stageFilter);
    }
    if (policyFilter !== "all") {
      result = result.filter((c) => c.policy === policyFilter);
    }
    if (countryFilter !== "all") {
      result = result.filter((c) => getCountry(c.hqCity) === countryFilter);
    }
    if (sortKey) {
      return [...result].sort((a, b) => compare(a[sortKey], b[sortKey], sortDir));
    }
    return result;
  }, [companies, stageFilter, policyFilter, countryFilter, sortKey, sortDir]);

  const isGated = !isLoggedIn && filtered.length > FREE_LIMIT;
  const visible = isGated ? filtered.slice(0, FREE_LIMIT) : filtered;
  const hiddenCount = isGated ? filtered.length - FREE_LIMIT : 0;

  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border bg-[#0a0a0a]">
        <Image
          src="/images/prometheus-hero.png"
          alt="Prometheus holding the flame of AI — classical oil painting"
          width={1536}
          height={640}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/80 via-[#0a0a0a]/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/60 via-transparent to-transparent" />
        <div className="relative px-6 pb-10 pt-12 sm:px-10 sm:pb-14 sm:pt-16 animate-[fade-in-up_0.7s_cubic-bezier(0.16,1,0.3,1)_both]">
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
            The Prometheus List
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#ccc]">
            Intelligence is the new fire. Work at companies with unlimited or very high AI usage budgets, verified from public sources.
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[#888]">
            Last updated Mar 20, 2026
          </p>

          <blockquote className="mt-10 max-w-lg border-l-2 border-[#df561f] pl-4 text-sm italic leading-relaxed text-[#bbb]">
            &ldquo;For any worker who is able to wield AI agents effectively in an organization, their compute budgets are just going to monotonically go up over time.&rdquo;
            <cite className="mt-2 block text-xs font-semibold not-italic text-[#df561f]">&mdash; Aaron Levie, CEO of Box</cite>
          </blockquote>

          {/* Actions */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {onSuggest && (
              <button
                type="button"
                onClick={onSuggest}
                className="inline-flex items-center gap-2 rounded-[4px] bg-[#df561f] px-5 py-2.5 text-sm font-semibold text-white transition-[filter] duration-150 hover:brightness-110 active:brightness-90"
              >
                + Add a company
              </button>
            )}
            <span className="text-sm text-[#aaa]">
              Did we make a mistake? Send corrections to{" "}
              <a
                href="https://x.com/oscrhong"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#df561f] hover:underline"
              >
                @oscrhong
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 border-b border-border px-4 py-3 sm:flex-nowrap sm:items-center sm:justify-end sm:gap-4 sm:px-10 sm:py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted">Location</span>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="appearance-none rounded-[4px] border border-border bg-subtle py-2 pl-3 pr-7 text-xs font-semibold text-foreground outline-none transition-colors focus:border-accent sm:py-1.5"
            aria-label="Filter by country"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            <option value="all">All</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted">Stage</span>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as StageFilter)}
            className="appearance-none rounded-[4px] border border-border bg-subtle py-2 pl-3 pr-7 text-xs font-semibold text-foreground outline-none transition-colors focus:border-accent sm:py-1.5"
            aria-label="Filter by stage"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            {STAGE_FILTERS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-muted">Policy</span>
          <select
            value={policyFilter}
            onChange={(e) => setPolicyFilter(e.target.value as PolicyFilter)}
            className="appearance-none rounded-[4px] border border-border bg-subtle py-2 pl-3 pr-7 text-xs font-semibold text-foreground outline-none transition-colors focus:border-accent sm:py-1.5"
            aria-label="Filter by policy"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
          >
            {POLICY_FILTERS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[42%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-widest text-muted">
              <th
                className="cursor-pointer px-6 py-3 font-semibold hover:text-foreground sm:px-10"
                onClick={() => toggleSort("name")}
                tabIndex={0}
                role="columnheader"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort("name"); } }}
              >
                Company<SortIndicator column="name" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-semibold hover:text-foreground"
                onClick={() => toggleSort("hqCity")}
                tabIndex={0}
                role="columnheader"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort("hqCity"); } }}
              >
                Location<SortIndicator column="hqCity" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-semibold hover:text-foreground"
                onClick={() => toggleSort("stage")}
                tabIndex={0}
                role="columnheader"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort("stage"); } }}
              >
                Stage<SortIndicator column="stage" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-semibold hover:text-foreground"
                onClick={() => toggleSort("policy")}
                tabIndex={0}
                role="columnheader"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort("policy"); } }}
              >
                Policy<SortIndicator column="policy" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="px-4 py-3 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((company) => {
              const loc = formatLocation(company.hqCity);
              return (
                <tr
                  key={company.name}
                  className="group border-b border-border transition-colors hover:bg-subtle"
                >
                  <td className="px-6 py-4 sm:px-10">
                    {company.companyUrl ? (
                      <a href={company.companyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-accent hover:underline">{company.name}</a>
                    ) : (
                      <span className="font-semibold">{company.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-muted">
                    {loc.city} {loc.flag}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="default">{company.stage}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={company.policy === "Unlimited" ? "accent" : "default"}>
                      {company.policy}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-sm leading-relaxed text-muted">
                    {company.source.text}
                    {company.source.link && (
                      <>
                        {" "}
                        <a
                          href={company.source.link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 whitespace-nowrap text-accent hover:underline"
                        >
                          {company.source.link.label}
                          <ExternalLink size={10} aria-hidden />
                          <span className="sr-only">(opens in new tab)</span>
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted">
                  No companies match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden">
        {visible.map((company) => {
          const loc = formatLocation(company.hqCity);
          return (
          <div
            key={company.name}
            className="border-b border-border px-4 py-4"
          >
            <div className="flex items-start justify-between gap-2">
              {company.companyUrl ? (
                <a href={company.companyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-accent hover:underline">{company.name}</a>
              ) : (
                <span className="font-semibold">{company.name}</span>
              )}
              <Badge variant={company.policy === "Unlimited" ? "accent" : "default"}>
                {company.policy}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted">
              <span>{loc.city} {loc.flag}</span>
              <span>{company.stage}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {company.source.text}
              {company.source.link && (
                <>
                  {" "}
                  <a
                    href={company.source.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-accent hover:underline"
                  >
                    {company.source.link.label}
                    <ExternalLink size={10} aria-hidden />
                    <span className="sr-only">(opens in new tab)</span>
                  </a>
                </>
              )}
            </p>
          </div>
          );
        })}
        {visible.length === 0 && (
          <p className="px-6 py-12 text-center text-muted">
            No companies match the selected filters.
          </p>
        )}
      </div>

      {/* Sign-in gate */}
      {isGated && (
        <div className="relative -mt-[1px]">
          <div className="pointer-events-none absolute bottom-full left-0 right-0 h-[25vh] min-h-32 bg-gradient-to-t from-background from-10% via-background/50 via-50% to-transparent" />
          <div className="flex flex-col items-center gap-4 border-t border-border px-6 py-12 text-center">
            <p className="max-w-md text-sm text-muted">
              Sign in to Straude to see the full list for free.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-[4px] bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground transition-[filter] duration-150 hover:brightness-110 active:brightness-90"
            >
              Unlock Full List
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
