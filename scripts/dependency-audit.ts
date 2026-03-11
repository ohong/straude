#!/usr/bin/env bun
/**
 * Dependency risk scanner.
 *
 * Checks for:
 * 1. Known vulnerabilities (via `bun audit`)
 * 2. Pre-release dependencies (rc, alpha, beta, canary)
 * 3. Wide version ranges (^major with no minor pin)
 *
 * Exit codes:
 *   0 — no high/critical issues
 *   1 — high or critical vulnerabilities found
 */

import { readFileSync } from "fs";
import { join } from "path";

interface AuditResult {
  vulnerabilities: VulnEntry[];
  preReleaseDeps: PreReleaseDep[];
  wideRanges: WideRange[];
  exitCode: number;
}

interface VulnEntry {
  package: string;
  severity: string;
  title: string;
  url: string;
  paths: string[];
}

interface PreReleaseDep {
  package: string;
  version: string;
  location: string;
}

interface WideRange {
  package: string;
  range: string;
  location: string;
}

const ROOT = join(import.meta.dir, "..");

// ── 1. Vulnerabilities via `bun audit` ─────────────────────────────────────

async function getVulnerabilities(): Promise<VulnEntry[]> {
  const proc = Bun.spawn(["bun", "audit"], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  // Parse the text output since bun audit doesn't have a JSON mode
  const vulns: VulnEntry[] = [];
  const blocks = stdout.split(/\n(?=\S+\s+[<>=])/).filter(Boolean);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    const headerMatch = lines[0].match(/^(\S+)\s+/);
    if (!headerMatch) continue;

    const pkg = headerMatch[1];
    const paths: string[] = [];
    const advisories: { severity: string; title: string; url: string }[] = [];

    for (const line of lines.slice(1)) {
      const pathMatch = line.match(/^\s+(workspace:\S+.*)/);
      if (pathMatch) {
        paths.push(pathMatch[1].trim());
        continue;
      }
      const advMatch = line.match(
        /^\s+(high|critical|moderate|low):\s+(.+?)\s+-\s+(https:\/\/.+)/i
      );
      if (advMatch) {
        advisories.push({
          severity: advMatch[1].toLowerCase(),
          title: advMatch[2],
          url: advMatch[3],
        });
      }
    }

    // Deduplicate advisories by URL
    const seen = new Set<string>();
    for (const adv of advisories) {
      if (seen.has(adv.url)) continue;
      seen.add(adv.url);
      vulns.push({
        package: pkg,
        severity: adv.severity,
        title: adv.title,
        url: adv.url,
        paths: [...new Set(paths)],
      });
    }
  }

  return vulns;
}

// ── 2. Pre-release dependencies ────────────────────────────────────────────

function getPreReleaseDeps(): PreReleaseDep[] {
  const preRelease: PreReleaseDep[] = [];
  const preReleasePattern = /-(alpha|beta|rc|canary|next|dev|preview)\b/i;

  const pkgFiles = [
    { path: "package.json", label: "root" },
    { path: "apps/web/package.json", label: "apps/web" },
    { path: "packages/cli/package.json", label: "packages/cli" },
  ];

  for (const { path, label } of pkgFiles) {
    try {
      const pkg = JSON.parse(readFileSync(join(ROOT, path), "utf-8"));
      for (const depType of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
      ]) {
        const deps = pkg[depType];
        if (!deps) continue;
        for (const [name, version] of Object.entries(deps)) {
          if (typeof version === "string" && preReleasePattern.test(version)) {
            preRelease.push({
              package: name,
              version,
              location: `${label} ${depType}`,
            });
          }
        }
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  return preRelease;
}

// ── 3. Wide version ranges ─────────────────────────────────────────────────

function getWideRanges(): WideRange[] {
  const wide: WideRange[] = [];
  // Matches ^N where N >= 1 with no minor/patch pin (e.g. "^2", "^5")
  const widePattern = /^\^[1-9]\d*$/;

  const pkgFiles = [
    { path: "package.json", label: "root" },
    { path: "apps/web/package.json", label: "apps/web" },
    { path: "packages/cli/package.json", label: "packages/cli" },
  ];

  for (const { path, label } of pkgFiles) {
    try {
      const pkg = JSON.parse(readFileSync(join(ROOT, path), "utf-8"));
      for (const depType of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
      ]) {
        const deps = pkg[depType];
        if (!deps) continue;
        for (const [name, version] of Object.entries(deps)) {
          if (typeof version === "string" && widePattern.test(version)) {
            wide.push({
              package: name,
              range: version,
              location: `${label} ${depType}`,
            });
          }
        }
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  return wide;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<AuditResult> {
  const vulnerabilities = await getVulnerabilities();
  const preReleaseDeps = getPreReleaseDeps();
  const wideRanges = getWideRanges();

  const hasHighOrCritical = vulnerabilities.some(
    (v) => v.severity === "high" || v.severity === "critical"
  );

  const result: AuditResult = {
    vulnerabilities,
    preReleaseDeps,
    wideRanges,
    exitCode: hasHighOrCritical ? 1 : 0,
  };

  // ── Report ─────────────────────────────────────────────────────────────

  console.log("\n=== Dependency Risk Report ===\n");

  // Vulnerabilities
  if (vulnerabilities.length === 0) {
    console.log("Vulnerabilities: none found\n");
  } else {
    console.log(`Vulnerabilities: ${vulnerabilities.length} found\n`);
    for (const v of vulnerabilities) {
      console.log(`  [${v.severity.toUpperCase()}] ${v.package}`);
      console.log(`    ${v.title}`);
      console.log(`    ${v.url}`);
      if (v.paths.length > 0) {
        console.log(`    via: ${v.paths.join(", ")}`);
      }
      console.log();
    }
  }

  // Pre-release
  if (preReleaseDeps.length === 0) {
    console.log("Pre-release dependencies: none\n");
  } else {
    console.log(
      `Pre-release dependencies: ${preReleaseDeps.length} found\n`
    );
    for (const d of preReleaseDeps) {
      console.log(`  ${d.package}@${d.version} (${d.location})`);
    }
    console.log();
  }

  // Wide ranges
  if (wideRanges.length === 0) {
    console.log("Wide version ranges: none\n");
  } else {
    console.log(`Wide version ranges: ${wideRanges.length} found\n`);
    for (const w of wideRanges) {
      console.log(`  ${w.package}: "${w.range}" (${w.location})`);
    }
    console.log();
  }

  // Summary
  console.log("--- Summary ---");
  console.log(`Vulnerabilities: ${vulnerabilities.length}`);
  console.log(`  High/Critical: ${vulnerabilities.filter((v) => v.severity === "high" || v.severity === "critical").length}`);
  console.log(`  Moderate/Low:  ${vulnerabilities.filter((v) => v.severity === "moderate" || v.severity === "low").length}`);
  console.log(`Pre-release deps: ${preReleaseDeps.length}`);
  console.log(`Wide ranges: ${wideRanges.length}`);
  console.log(`Exit code: ${result.exitCode}`);
  console.log();

  return result;
}

const result = await main();
process.exit(result.exitCode);
