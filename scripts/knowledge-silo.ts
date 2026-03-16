#!/usr/bin/env bun
/**
 * Knowledge Silo Detector
 *
 * Analyzes git history to identify areas of a codebase where knowledge is
 * concentrated in too few people. Unlike a simple bus-factor check (who owns
 * the most lines right now), this tool focuses on *collaboration dynamics*:
 *
 *   - Recency-weighted contributions (recent work counts more)
 *   - Ownership concentration per directory (Herfindahl index)
 *   - Exclusive-ownership clusters (files only one person touches)
 *   - Cross-pollination gaps (directory pairs with no shared contributors)
 *   - Actionable pairing suggestions to break silos
 *
 * Usage:
 *   bun scripts/knowledge-silo.ts [--repo PATH] [--days N] [--markdown]
 */

import { spawnSync } from "child_process";
import { writeFileSync } from "fs";
import { resolve, dirname, basename } from "path";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function flag(name: string, fallback: string): string {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return fallback;
  return args[i + 1];
}

const REPO_PATH = resolve(flag("--repo", "."));
const LOOKBACK_DAYS = parseInt(flag("--days", "365"), 10);
const MARKDOWN = args.includes("--markdown");
const DECAY_HALF_LIFE_DAYS = 90; // contributions halve in weight every 90 days

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function git(...gitArgs: string[]): string {
  const result = spawnSync("git", gitArgs, {
    cwd: REPO_PATH,
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) {
    console.error(`git error: ${result.stderr?.trim()}`);
    return "";
  }
  return result.stdout;
}

const SKIP_PATTERNS = [
  /node_modules\//,
  /\.next\//,
  /dist\//,
  /\.lock$/,
  /\.map$/,
  /\.(png|jpg|jpeg|gif|webp|ico|svg|woff2?|ttf|eot)$/i,
  /^\.(agents|claude|github|githooks|turbo)\//,
  /^(gtm|reviews|references)\//,
  /\{.*=>.*\}/, // git rename notation
];

function shouldSkip(path: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(path));
}

/** Map a file path to its top-level directory bucket. */
function bucket(filepath: string): string {
  const parts = filepath.split("/");
  if (parts.length === 1) return "(root)";
  // Use two levels for apps/ and packages/ to get meaningful granularity
  if (
    (parts[0] === "apps" || parts[0] === "packages") &&
    parts.length >= 2
  ) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

/** Exponential time-decay weight. */
function decayWeight(daysAgo: number): number {
  return Math.pow(0.5, daysAgo / DECAY_HALF_LIFE_DAYS);
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------
interface Contribution {
  author: string;
  file: string;
  linesChanged: number;
  daysAgo: number;
  weight: number;
}

function collectContributions(): Contribution[] {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - LOOKBACK_DAYS);
  const sinceStr = sinceDate.toISOString().slice(0, 10);

  // git log with numstat: gives author, date, and file-level line changes
  const raw = git(
    "log",
    `--since=${sinceStr}`,
    "--no-merges",
    "--format=COMMIT|%aN|%aI",
    "--numstat"
  );

  const contributions: Contribution[] = [];
  let currentAuthor = "";
  let currentDaysAgo = 0;
  const now = Date.now();

  for (const line of raw.split("\n")) {
    if (line.startsWith("COMMIT|")) {
      const parts = line.split("|");
      currentAuthor = parts[1];
      const commitDate = new Date(parts[2]).getTime();
      currentDaysAgo = Math.max(0, (now - commitDate) / (1000 * 60 * 60 * 24));
      continue;
    }

    if (!line.trim() || !currentAuthor) continue;

    const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!match) continue;

    const added = match[1] === "-" ? 0 : parseInt(match[1], 10);
    const deleted = match[2] === "-" ? 0 : parseInt(match[2], 10);
    const file = match[3];

    if (shouldSkip(file)) continue;

    contributions.push({
      author: currentAuthor,
      file,
      linesChanged: added + deleted,
      daysAgo: currentDaysAgo,
      weight: (added + deleted) * decayWeight(currentDaysAgo),
    });
  }

  return contributions;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------
interface DirectoryStats {
  directory: string;
  authors: Map<string, number>; // author -> weighted contribution
  totalWeight: number;
  fileCount: number;
  hhi: number; // Herfindahl-Hirschman Index (0-1, higher = more concentrated)
  busFactor: number;
  topAuthor: string;
  topAuthorShare: number;
  exclusiveFiles: string[]; // files only one author touched
}

interface SiloCluster {
  owner: string;
  directories: string[];
  files: string[];
  totalWeight: number;
}

interface CrossPollinationGap {
  dirA: string;
  dirB: string;
  authorsA: string[];
  authorsB: string[];
  overlap: number;
}

interface PairingSuggestion {
  person: string;
  shouldReview: string;
  reason: string;
}

function analyzeDirectories(contributions: Contribution[]): DirectoryStats[] {
  // Group by directory
  const dirMap = new Map<
    string,
    { authors: Map<string, number>; files: Set<string>; fileAuthors: Map<string, Set<string>> }
  >();

  for (const c of contributions) {
    const dir = bucket(c.file);
    if (!dirMap.has(dir)) {
      dirMap.set(dir, {
        authors: new Map(),
        files: new Set(),
        fileAuthors: new Map(),
      });
    }
    const d = dirMap.get(dir)!;
    d.authors.set(c.author, (d.authors.get(c.author) || 0) + c.weight);
    d.files.add(c.file);
    if (!d.fileAuthors.has(c.file)) d.fileAuthors.set(c.file, new Set());
    d.fileAuthors.get(c.file)!.add(c.author);
  }

  const stats: DirectoryStats[] = [];

  for (const [dir, data] of dirMap) {
    const totalWeight = Array.from(data.authors.values()).reduce(
      (a, b) => a + b,
      0
    );

    // Herfindahl-Hirschman Index
    let hhi = 0;
    for (const w of data.authors.values()) {
      const share = w / totalWeight;
      hhi += share * share;
    }

    // Bus factor: minimum authors covering >50% of weighted contributions
    const sorted = Array.from(data.authors.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    let cumulative = 0;
    let busFactor = 0;
    for (const [, w] of sorted) {
      cumulative += w / totalWeight;
      busFactor++;
      if (cumulative > 0.5) break;
    }

    const [topAuthor, topWeight] = sorted[0];

    // Exclusive files (only one author)
    const exclusiveFiles: string[] = [];
    for (const [file, authors] of data.fileAuthors) {
      if (authors.size === 1) exclusiveFiles.push(file);
    }

    stats.push({
      directory: dir,
      authors: data.authors,
      totalWeight,
      fileCount: data.files.size,
      hhi,
      busFactor,
      topAuthor,
      topAuthorShare: topWeight / totalWeight,
      exclusiveFiles,
    });
  }

  return stats.sort((a, b) => b.hhi - a.hhi);
}

function findSiloClusters(
  dirStats: DirectoryStats[]
): SiloCluster[] {
  // Group directories where a single author owns >80% of weighted contributions
  const ownerDirs = new Map<string, { dirs: string[]; files: string[]; weight: number }>();

  for (const ds of dirStats) {
    if (ds.topAuthorShare >= 0.8) {
      if (!ownerDirs.has(ds.topAuthor)) {
        ownerDirs.set(ds.topAuthor, { dirs: [], files: [], weight: 0 });
      }
      const entry = ownerDirs.get(ds.topAuthor)!;
      entry.dirs.push(ds.directory);
      entry.files.push(...ds.exclusiveFiles);
      entry.weight += ds.totalWeight;
    }
  }

  return Array.from(ownerDirs.entries())
    .map(([owner, data]) => ({
      owner,
      directories: data.dirs,
      files: [...new Set(data.files)],
      totalWeight: data.weight,
    }))
    .sort((a, b) => b.totalWeight - a.totalWeight);
}

function findCrossPollinationGaps(
  dirStats: DirectoryStats[]
): CrossPollinationGap[] {
  const gaps: CrossPollinationGap[] = [];
  const significantDirs = dirStats.filter((d) => d.fileCount >= 3);

  for (let i = 0; i < significantDirs.length; i++) {
    for (let j = i + 1; j < significantDirs.length; j++) {
      const a = significantDirs[i];
      const b = significantDirs[j];
      const authorsA = new Set(a.authors.keys());
      const authorsB = new Set(b.authors.keys());
      let overlap = 0;
      for (const author of authorsA) {
        if (authorsB.has(author)) overlap++;
      }
      const totalUnique = new Set([...authorsA, ...authorsB]).size;
      if (totalUnique > 1 && overlap === 0) {
        gaps.push({
          dirA: a.directory,
          dirB: b.directory,
          authorsA: [...authorsA],
          authorsB: [...authorsB],
          overlap,
        });
      }
    }
  }

  return gaps;
}

function suggestPairings(
  dirStats: DirectoryStats[],
  clusters: SiloCluster[]
): PairingSuggestion[] {
  const suggestions: PairingSuggestion[] = [];
  const allAuthors = new Set<string>();
  for (const ds of dirStats) {
    for (const a of ds.authors.keys()) allAuthors.add(a);
  }

  // For each silo cluster, suggest other team members review those areas
  for (const cluster of clusters) {
    const others = [...allAuthors].filter((a) => a !== cluster.owner);
    for (const other of others) {
      // Find which cluster directories this person hasn't touched
      const untouched = cluster.directories.filter((dir) => {
        const ds = dirStats.find((d) => d.directory === dir);
        return ds && !ds.authors.has(other);
      });
      if (untouched.length > 0) {
        suggestions.push({
          person: other,
          shouldReview: untouched.join(", "),
          reason: `${cluster.owner} owns >80% of these areas — cross-training reduces risk`,
        });
      }
    }
  }

  return suggestions.slice(0, 10); // cap at 10 suggestions
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function generateReport(
  dirStats: DirectoryStats[],
  clusters: SiloCluster[],
  gaps: CrossPollinationGap[],
  pairings: PairingSuggestion[],
  contributions: Contribution[]
): string {
  const totalAuthors = new Set(contributions.map((c) => c.author)).size;
  const totalFiles = new Set(contributions.map((c) => c.file)).size;
  const siloDirectories = dirStats.filter((d) => d.hhi > 0.8);
  const today = new Date().toISOString().slice(0, 10);

  const lines: string[] = [];
  const w = (s: string) => lines.push(s);

  w("# Knowledge Silo Report");
  w("");
  w(`**Generated:** ${today}`);
  w(`**Repository:** ${basename(REPO_PATH)}`);
  w(`**Lookback:** ${LOOKBACK_DAYS} days | **Decay half-life:** ${DECAY_HALF_LIFE_DAYS} days`);
  w("");
  w("## Summary");
  w("");
  w("| Metric | Value |");
  w("|--------|-------|");
  w(`| Contributors | ${totalAuthors} |`);
  w(`| Files with activity | ${totalFiles} |`);
  w(`| Directories analyzed | ${dirStats.length} |`);
  w(
    `| High-concentration directories (HHI > 0.8) | **${siloDirectories.length}** / ${dirStats.length} |`
  );
  w(`| Silo clusters | ${clusters.length} |`);
  w(`| Cross-pollination gaps | ${gaps.length} |`);

  w("");
  w("## How to Read This Report");
  w("");
  w("- **HHI** (Herfindahl-Hirschman Index): Ownership concentration from 0 to 1.");
  w("  - `1.0` = one person owns everything (maximum silo risk).");
  w("  - `0.5` = two equal contributors.");
  w("  - `< 0.33` = healthy distribution across 3+ people.");
  w("- **Bus Factor**: Minimum people who must leave before >50% of weighted knowledge is lost.");
  w("- **Recency weighting**: Recent changes count more (half-life = 90 days).");

  w("");
  w("## Directory Ownership Concentration");
  w("");
  w(
    "| Directory | HHI | Bus Factor | Files | Top Author | Share | Exclusive Files |"
  );
  w(
    "|-----------|:---:|:----------:|------:|------------|------:|----------------:|"
  );

  for (const ds of dirStats) {
    const risk = ds.hhi > 0.8 ? " :red_circle:" : ds.hhi > 0.5 ? " :yellow_circle:" : "";
    w(
      `| \`${ds.directory}\` | ${ds.hhi.toFixed(2)}${risk} | ${ds.busFactor} | ${ds.fileCount} | ${ds.topAuthor} | ${(ds.topAuthorShare * 100).toFixed(1)}% | ${ds.exclusiveFiles.length} |`
    );
  }

  if (clusters.length > 0) {
    w("");
    w("## Silo Clusters");
    w("");
    w(
      "A **silo cluster** is a group of directories where one person owns >80% of weighted contributions."
    );
    w("");

    for (const cluster of clusters) {
      w(`### ${cluster.owner}`);
      w("");
      w(`- **Directories:** ${cluster.directories.map((d) => `\`${d}\``).join(", ")}`);
      w(`- **Exclusive files:** ${cluster.files.length}`);
      w("");
      if (cluster.files.length > 0) {
        w("<details><summary>Exclusive files list</summary>");
        w("");
        for (const f of cluster.files.slice(0, 50)) {
          w(`- \`${f}\``);
        }
        if (cluster.files.length > 50) {
          w(`- ... and ${cluster.files.length - 50} more`);
        }
        w("");
        w("</details>");
        w("");
      }
    }
  }

  if (gaps.length > 0) {
    w("");
    w("## Cross-Pollination Gaps");
    w("");
    w(
      "These directory pairs have **zero shared contributors** — knowledge doesn't flow between them."
    );
    w("");
    w("| Directory A | Directory B | Authors A | Authors B |");
    w("|-------------|-------------|-----------|-----------|");

    for (const gap of gaps.slice(0, 15)) {
      w(
        `| \`${gap.dirA}\` | \`${gap.dirB}\` | ${gap.authorsA.join(", ")} | ${gap.authorsB.join(", ")} |`
      );
    }
    if (gaps.length > 15) {
      w("");
      w(`*... and ${gaps.length - 15} more gaps*`);
    }
  }

  if (pairings.length > 0) {
    w("");
    w("## Suggested Review Pairings");
    w("");
    w(
      "To reduce silo risk, consider having these people review code in unfamiliar areas."
    );
    w("");
    w("| Person | Should Review | Reason |");
    w("|--------|-------------|--------|");

    for (const p of pairings) {
      w(`| ${p.person} | \`${p.shouldReview}\` | ${p.reason} |`);
    }
  }

  w("");
  w("---");
  w(
    "*Generated by `scripts/knowledge-silo.ts` — recency-weighted git log analysis.*"
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log(
    `Analyzing ${REPO_PATH} (last ${LOOKBACK_DAYS} days, decay half-life ${DECAY_HALF_LIFE_DAYS}d)...`
  );

  const contributions = collectContributions();
  if (contributions.length === 0) {
    console.error("No contributions found. Check --repo and --days flags.");
    process.exit(1);
  }

  console.log(
    `Found ${contributions.length} file-level contributions from ${new Set(contributions.map((c) => c.author)).size} authors.`
  );

  const dirStats = analyzeDirectories(contributions);
  const clusters = findSiloClusters(dirStats);
  const gaps = findCrossPollinationGaps(dirStats);
  const pairings = suggestPairings(dirStats, clusters);

  const report = generateReport(dirStats, clusters, gaps, pairings, contributions);

  if (MARKDOWN) {
    const outPath = resolve(REPO_PATH, "docs", "KNOWLEDGE_SILO_REPORT.md");
    writeFileSync(outPath, report + "\n");
    console.log(`Report written to ${outPath}`);
  } else {
    console.log("\n" + report);
  }
}

main();
