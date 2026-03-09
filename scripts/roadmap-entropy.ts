#!/usr/bin/env bun
/**
 * Roadmap Entropy Detector
 *
 * Parses docs/ROADMAP.md, tracks how the roadmap has evolved over git history,
 * and reports entropy metrics: unshipped item count trend, shipped-vs-total ratio,
 * word count growth, stalest unshipped items, and north-star alignment.
 *
 * Usage: bun run roadmap:entropy
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RoadmapItem {
  title: string;
  wordCount: number;
  lineStart: number;
}

interface ParsedRoadmap {
  unshipped: RoadmapItem[];
  shipped: RoadmapItem[];
  totalWordCount: number;
  unshippedWordCount: number;
}

interface HistorySnapshot {
  date: string;
  commitHash: string;
  unshippedCount: number;
  shippedCount: number;
  unshippedWordCount: number;
  totalWordCount: number;
}

interface BlameResult {
  title: string;
  oldestDate: string;
  daysStale: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ROADMAP_PATH = "docs/ROADMAP.md";
const REPO_ROOT = resolve(import.meta.dirname!, "..");

// Keywords that indicate alignment with the north-star metric (cumulative spend)
const NORTH_STAR_KEYWORDS = [
  "cost",
  "spend",
  "usage",
  "tokens",
  "session",
  "daily_usage",
  "revenue",
  "activation",
  "retention",
  "streak",
  "sync",
  "push",
  "cli",
  "digest",
  "nudge",
  "lapsed",
  "habit",
];

// ─── Parsing ────────────────────────────────────────────────────────────────

function parseRoadmap(content: string): ParsedRoadmap {
  const lines = content.split("\n");
  const unshipped: RoadmapItem[] = [];
  const shipped: RoadmapItem[] = [];

  let inShipped = false;
  let currentItem: { title: string; lines: string[]; lineStart: number } | null =
    null;
  let target = unshipped;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect the "## Shipped" boundary
    if (/^## Shipped\b/i.test(line)) {
      // flush current item to unshipped
      if (currentItem) {
        target.push({
          title: currentItem.title,
          wordCount: currentItem.lines.join(" ").split(/\s+/).filter(Boolean)
            .length,
          lineStart: currentItem.lineStart,
        });
        currentItem = null;
      }
      inShipped = true;
      target = shipped;
      continue;
    }

    // H2 or H3 headings start new items
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);
    const headingMatch = inShipped ? h3Match : h2Match;

    if (headingMatch) {
      // flush previous
      if (currentItem) {
        target.push({
          title: currentItem.title,
          wordCount: currentItem.lines.join(" ").split(/\s+/).filter(Boolean)
            .length,
          lineStart: currentItem.lineStart,
        });
      }
      currentItem = {
        title: headingMatch[1].replace(/\s*\([\d-]+\)\s*$/, "").trim(),
        lines: [],
        lineStart: i + 1,
      };
      continue;
    }

    // Horizontal rule separator — skip
    if (/^---\s*$/.test(line)) continue;

    // Accumulate body lines
    if (currentItem) {
      currentItem.lines.push(line);
    }
  }

  // flush last
  if (currentItem) {
    target.push({
      title: currentItem.title,
      wordCount: currentItem.lines.join(" ").split(/\s+/).filter(Boolean)
        .length,
      lineStart: currentItem.lineStart,
    });
  }

  const totalWordCount = content.split(/\s+/).filter(Boolean).length;
  const unshippedWordCount = unshipped.reduce((s, i) => s + i.wordCount, 0);

  return { unshipped, shipped, totalWordCount, unshippedWordCount };
}

// ─── Git History ────────────────────────────────────────────────────────────

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
}

function getHistorySnapshots(): HistorySnapshot[] {
  let logOutput: string;
  try {
    logOutput = git(
      `log --follow --format="%H %aI" --diff-filter=AM -- ${ROADMAP_PATH}`
    );
  } catch {
    return [];
  }

  if (!logOutput) return [];

  const commits = logOutput
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, date] = line.split(" ");
      return { hash, date: date.split("T")[0] };
    });

  // Deduplicate by date, keep earliest commit per date
  const byDate = new Map<string, string>();
  for (const c of commits.reverse()) {
    byDate.set(c.date, c.hash);
  }

  const snapshots: HistorySnapshot[] = [];

  for (const [date, hash] of byDate) {
    try {
      const content = git(`show ${hash}:${ROADMAP_PATH}`);
      const parsed = parseRoadmap(content);
      snapshots.push({
        date,
        commitHash: hash.slice(0, 7),
        unshippedCount: parsed.unshipped.length,
        shippedCount: parsed.shipped.length,
        unshippedWordCount: parsed.unshippedWordCount,
        totalWordCount: parsed.totalWordCount,
      });
    } catch {
      // File might not exist at that commit
    }
  }

  // Sort chronologically
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  return snapshots;
}

// ─── Staleness via git blame ────────────────────────────────────────────────

function getStalestItems(items: RoadmapItem[]): BlameResult[] {
  const fullPath = resolve(REPO_ROOT, ROADMAP_PATH);
  if (!existsSync(fullPath)) return [];

  let blameOutput: string;
  try {
    blameOutput = git(`blame --line-porcelain ${ROADMAP_PATH}`);
  } catch {
    return [];
  }

  // Parse blame into line → date mapping
  const lineDates = new Map<number, string>();
  const blameLines = blameOutput.split("\n");
  let currentLine = 0;

  for (let i = 0; i < blameLines.length; i++) {
    const headerMatch = blameLines[i].match(
      /^[0-9a-f]{40}\s+(\d+)\s+(\d+)(?:\s+\d+)?$/
    );
    if (headerMatch) {
      currentLine = parseInt(headerMatch[2], 10);
    }
    const dateMatch = blameLines[i].match(/^author-time\s+(\d+)/);
    if (dateMatch) {
      const ts = parseInt(dateMatch[1], 10) * 1000;
      lineDates.set(currentLine, new Date(ts).toISOString().split("T")[0]);
    }
  }

  const now = Date.now();
  const results: BlameResult[] = [];

  for (const item of items) {
    const date = lineDates.get(item.lineStart);
    if (date) {
      const daysStale = Math.floor(
        (now - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
      );
      results.push({ title: item.title, oldestDate: date, daysStale });
    }
  }

  results.sort((a, b) => b.daysStale - a.daysStale);
  return results;
}

// ─── North-Star Alignment ───────────────────────────────────────────────────

function checkAlignment(items: RoadmapItem[], content: string): { aligned: string[]; unaligned: string[] } {
  const aligned: string[] = [];
  const unaligned: string[] = [];
  const lines = content.split("\n");

  for (const item of items) {
    // Gather the section text for this item
    const sectionStart = item.lineStart - 1; // 0-indexed
    let sectionEnd = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i])) {
        sectionEnd = i;
        break;
      }
    }
    const sectionText = lines
      .slice(sectionStart, sectionEnd)
      .join(" ")
      .toLowerCase();

    const hasKeyword = NORTH_STAR_KEYWORDS.some((kw) =>
      sectionText.includes(kw)
    );
    if (hasKeyword) {
      aligned.push(item.title);
    } else {
      unaligned.push(item.title);
    }
  }

  return { aligned, unaligned };
}

// ─── Sparkline ──────────────────────────────────────────────────────────────

function sparkline(values: number[]): string {
  if (values.length === 0) return "";
  const chars = "▁▂▃▄▅▆▇█";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((v) => chars[Math.min(Math.floor(((v - min) / range) * 7), 7)])
    .join("");
}

// ─── Report ─────────────────────────────────────────────────────────────────

function main() {
  const fullPath = resolve(REPO_ROOT, ROADMAP_PATH);
  if (!existsSync(fullPath)) {
    console.error(`Error: ${ROADMAP_PATH} not found`);
    process.exit(1);
  }

  const content = readFileSync(fullPath, "utf-8");
  const current = parseRoadmap(content);
  const history = getHistorySnapshots();
  const stalest = getStalestItems(current.unshipped);
  const alignment = checkAlignment(current.unshipped, content);

  const total = current.unshipped.length + current.shipped.length;
  const shippedRatio = total > 0 ? current.shipped.length / total : 0;

  // ── Header ──
  console.log();
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║           ROADMAP ENTROPY REPORT                    ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log();

  // ── Summary ──
  console.log("── Summary ─────────────────────────────────────────────");
  console.log(`  Unshipped items:     ${current.unshipped.length}`);
  console.log(`  Shipped items:       ${current.shipped.length}`);
  console.log(`  Total items:         ${total}`);
  console.log(
    `  Shipped ratio:       ${(shippedRatio * 100).toFixed(1)}% (${current.shipped.length}/${total})`
  );
  console.log(`  Unshipped word count: ${current.unshippedWordCount}`);
  console.log(`  Total word count:    ${current.totalWordCount}`);
  console.log();

  // ── History Trend ──
  if (history.length > 1) {
    console.log("── Unshipped Count Trend ───────────────────────────────");
    const counts = history.map((h) => h.unshippedCount);
    console.log(`  ${sparkline(counts)}  (${history[0].date} → ${history[history.length - 1].date})`);
    console.log();

    const first = history[0];
    const last = history[history.length - 1];
    const countDelta = last.unshippedCount - first.unshippedCount;
    const wordDelta = last.unshippedWordCount - first.unshippedWordCount;
    const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

    console.log("── Growth Since First Tracked ──────────────────────────");
    console.log(`  Unshipped items:  ${first.unshippedCount} → ${last.unshippedCount} (${sign(countDelta)})`);
    console.log(`  Unshipped words:  ${first.unshippedWordCount} → ${last.unshippedWordCount} (${sign(wordDelta)})`);
    console.log(`  Shipped items:    ${first.shippedCount} → ${last.shippedCount} (${sign(last.shippedCount - first.shippedCount)})`);
    console.log();

    console.log("── Snapshot History ────────────────────────────────────");
    console.log("  Date        Commit   Unshipped  Shipped  Words");
    for (const s of history) {
      console.log(
        `  ${s.date}  ${s.commitHash}  ${String(s.unshippedCount).padStart(9)}  ${String(s.shippedCount).padStart(7)}  ${String(s.unshippedWordCount).padStart(5)}`
      );
    }
    console.log();
  } else {
    console.log("── History ─────────────────────────────────────────────");
    console.log("  Only 1 snapshot found — no trend data available.");
    console.log();
  }

  // ── Stalest Items ──
  if (stalest.length > 0) {
    console.log("── Stalest Unshipped Items ─────────────────────────────");
    const top = stalest.slice(0, 5);
    for (const s of top) {
      console.log(`  ${String(s.daysStale).padStart(4)}d  ${s.oldestDate}  ${s.title}`);
    }
    console.log();
  }

  // ── North-Star Alignment ──
  console.log("── North-Star Alignment ────────────────────────────────");
  console.log(`  North star: cumulative spend (cost_usd in daily_usage)`);
  console.log(
    `  Aligned:   ${alignment.aligned.length}/${current.unshipped.length} items mention cost/spend/usage/retention`
  );
  if (alignment.unaligned.length > 0) {
    console.log(`  Unaligned:`);
    for (const title of alignment.unaligned) {
      console.log(`    ⚠  ${title}`);
    }
  }
  console.log();

  // ── Entropy Score ──
  // Higher = more entropy (scope creep)
  // Factors: high unshipped count, low shipped ratio, high word growth, staleness
  const unshippedPenalty = Math.min(current.unshipped.length / 15, 1); // normalize to ~15 items
  const shippedReward = 1 - shippedRatio;
  const stalenessPenalty =
    stalest.length > 0
      ? Math.min(stalest[0].daysStale / 90, 1) // 90 days = max stale
      : 0;
  const alignmentPenalty =
    current.unshipped.length > 0
      ? alignment.unaligned.length / current.unshipped.length
      : 0;

  const entropy =
    unshippedPenalty * 0.3 +
    shippedReward * 0.3 +
    stalenessPenalty * 0.2 +
    alignmentPenalty * 0.2;

  const entropyPct = (entropy * 100).toFixed(0);
  const label =
    entropy < 0.3
      ? "Low"
      : entropy < 0.6
        ? "Moderate"
        : "High";

  console.log("── Entropy Score ───────────────────────────────────────");
  console.log(`  ${entropyPct}% entropy — ${label}`);
  console.log(
    `    30% unshipped count (${(unshippedPenalty * 100).toFixed(0)}%)`
  );
  console.log(
    `    30% shipped ratio   (${(shippedReward * 100).toFixed(0)}%)`
  );
  console.log(
    `    20% staleness       (${(stalenessPenalty * 100).toFixed(0)}%)`
  );
  console.log(
    `    20% alignment       (${(alignmentPenalty * 100).toFixed(0)}%)`
  );
  console.log();
}

main();
