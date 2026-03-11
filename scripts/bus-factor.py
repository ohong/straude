#!/usr/bin/env python3
"""
Bus-Factor Analyzer for git repositories.

Examines git log and blame data to quantify code ownership concentration
across files and directories. Outputs per-file author counts, directory-level
bus factor, line ownership percentages, and identifies high-risk single-owner areas.

Usage:
    python3 scripts/bus-factor.py [--repo-path PATH] [--markdown]

Options:
    --repo-path PATH   Path to the git repository (default: current directory)
    --markdown         Output in Markdown format suitable for docs/BUS_FACTOR_REPORT.md
"""

import argparse
import os
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date


def run_git(args: list[str], cwd: str) -> str:
    result = subprocess.run(
        ["git"] + args,
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"git error: {result.stderr.strip()}", file=sys.stderr)
        return ""
    return result.stdout


def get_tracked_files(cwd: str) -> list[str]:
    """Get all tracked files in the repo (excludes binary/generated)."""
    output = run_git(["ls-files"], cwd)
    skip_patterns = (
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
        ".woff", ".woff2", ".ttf", ".eot",
        ".lock", ".map",
        "node_modules/", ".next/", "dist/",
    )
    files = []
    for f in output.strip().splitlines():
        if not f:
            continue
        if any(f.endswith(p) or p in f for p in skip_patterns):
            continue
        files.append(f)
    return files


def get_blame_authors(filepath: str, cwd: str) -> Counter:
    """Run git blame on a file and return a Counter of author -> line count."""
    output = run_git(
        ["blame", "--line-porcelain", "--", filepath],
        cwd,
    )
    authors: Counter = Counter()
    for line in output.splitlines():
        if line.startswith("author "):
            author = line[len("author "):]
            authors[author] += 1
    return authors


def get_shortlog_authors(cwd: str) -> list[tuple[int, str]]:
    """Get commit counts per author from git shortlog."""
    output = run_git(["shortlog", "-sn", "--all", "--no-merges"], cwd)
    results = []
    for line in output.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split("\t", 1)
        if len(parts) == 2:
            results.append((int(parts[0].strip()), parts[1].strip()))
    return results


def compute_bus_factor(author_lines: Counter) -> int:
    """
    Bus factor = minimum number of authors whose combined contribution
    exceeds 50% of total lines.
    """
    total = sum(author_lines.values())
    if total == 0:
        return 0
    sorted_authors = author_lines.most_common()
    cumulative = 0
    for i, (_, count) in enumerate(sorted_authors, 1):
        cumulative += count
        if cumulative > total * 0.5:
            return i
    return len(sorted_authors)


def analyze(cwd: str) -> dict:
    """Run full bus-factor analysis and return structured results."""
    files = get_tracked_files(cwd)
    total_files = len(files)

    # Per-file blame analysis
    file_authors: dict[str, Counter] = {}
    global_author_lines: Counter = Counter()
    single_author_files = []
    multi_author_files = []

    for i, filepath in enumerate(files):
        if (i + 1) % 50 == 0 or i == 0:
            print(
                f"  Analyzing file {i + 1}/{total_files}...",
                file=sys.stderr,
            )
        authors = get_blame_authors(filepath, cwd)
        if not authors:
            continue
        file_authors[filepath] = authors
        global_author_lines += authors

        if len(authors) == 1:
            single_author_files.append(filepath)
        else:
            multi_author_files.append(filepath)

    analyzed_files = len(file_authors)

    # Directory-level aggregation
    dir_authors: dict[str, Counter] = defaultdict(Counter)
    for filepath, authors in file_authors.items():
        parts = filepath.split("/")
        # Top-level directory (or root for top-level files)
        top_dir = parts[0] if len(parts) > 1 else "(root)"
        dir_authors[top_dir] += authors

    # Commit-level stats
    shortlog = get_shortlog_authors(cwd)
    total_commits = sum(c for c, _ in shortlog)

    # Global bus factor
    bus_factor = compute_bus_factor(global_author_lines)
    total_lines = sum(global_author_lines.values())

    # Per-directory bus factor
    dir_bus_factors = {}
    for d, authors in sorted(dir_authors.items()):
        dir_bus_factors[d] = {
            "bus_factor": compute_bus_factor(authors),
            "total_lines": sum(authors.values()),
            "authors": authors.most_common(),
        }

    # Author ownership percentages
    author_percentages = []
    for author, lines in global_author_lines.most_common():
        author_percentages.append({
            "author": author,
            "lines": lines,
            "percentage": round(lines / total_lines * 100, 1) if total_lines else 0,
        })

    # High-risk files (single author, >100 lines)
    high_risk = []
    for f in single_author_files:
        total = sum(file_authors[f].values())
        if total >= 100:
            author = file_authors[f].most_common(1)[0][0]
            high_risk.append({"file": f, "lines": total, "author": author})
    high_risk.sort(key=lambda x: x["lines"], reverse=True)

    return {
        "date": str(date.today()),
        "total_files_tracked": total_files,
        "total_files_analyzed": analyzed_files,
        "total_lines": total_lines,
        "total_commits": total_commits,
        "bus_factor": bus_factor,
        "contributors": shortlog,
        "single_author_files": len(single_author_files),
        "single_author_pct": round(
            len(single_author_files) / analyzed_files * 100, 1
        ) if analyzed_files else 0,
        "author_ownership": author_percentages,
        "directory_breakdown": dir_bus_factors,
        "high_risk_files": high_risk[:30],  # Top 30
    }


def format_markdown(data: dict) -> str:
    """Format analysis results as a Markdown report."""
    lines = []
    lines.append(f"# Bus Factor Report")
    lines.append("")
    lines.append(f"**Generated:** {data['date']}")
    lines.append(f"**Repository:** straude")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| Bus Factor | **{data['bus_factor']}** |")
    lines.append(f"| Total Contributors | {len(data['contributors'])} |")
    lines.append(f"| Total Commits | {data['total_commits']} |")
    lines.append(f"| Files Tracked | {data['total_files_tracked']} |")
    lines.append(f"| Files Analyzed (non-binary) | {data['total_files_analyzed']} |")
    lines.append(f"| Total Lines (blamed) | {data['total_lines']:,} |")
    lines.append(f"| Single-Author Files | {data['single_author_files']} ({data['single_author_pct']}%) |")
    lines.append("")

    lines.append("## Line Ownership by Author")
    lines.append("")
    lines.append("| Author | Lines | Percentage |")
    lines.append("|--------|------:|-----------:|")
    for entry in data["author_ownership"]:
        lines.append(
            f"| {entry['author']} | {entry['lines']:,} | {entry['percentage']}% |"
        )
    lines.append("")

    lines.append("## Commits by Author")
    lines.append("")
    lines.append("| Author | Commits |")
    lines.append("|--------|--------:|")
    for commits, author in data["contributors"]:
        lines.append(f"| {author} | {commits} |")
    lines.append("")

    lines.append("## Directory-Level Bus Factor")
    lines.append("")
    lines.append("| Directory | Bus Factor | Lines | Top Author (%) |")
    lines.append("|-----------|:----------:|------:|----------------|")
    for d, info in sorted(
        data["directory_breakdown"].items(),
        key=lambda x: x[1]["total_lines"],
        reverse=True,
    ):
        top_author, top_count = info["authors"][0] if info["authors"] else ("N/A", 0)
        top_pct = round(top_count / info["total_lines"] * 100, 1) if info["total_lines"] else 0
        lines.append(
            f"| `{d}` | {info['bus_factor']} | {info['total_lines']:,} | {top_author} ({top_pct}%) |"
        )
    lines.append("")

    lines.append("## High-Risk Files (Single Author, 100+ Lines)")
    lines.append("")
    if data["high_risk_files"]:
        lines.append("| File | Lines | Author |")
        lines.append("|------|------:|--------|")
        for entry in data["high_risk_files"]:
            lines.append(
                f"| `{entry['file']}` | {entry['lines']:,} | {entry['author']} |"
            )
    else:
        lines.append("No high-risk single-author files found.")
    lines.append("")

    lines.append("## Recommendations")
    lines.append("")
    if data["bus_factor"] <= 1:
        lines.append(
            "- **Critical:** Bus factor is 1. The project depends entirely on a single contributor. "
            "Prioritize code review participation and pair programming to spread knowledge."
        )
    if data["single_author_pct"] > 80:
        lines.append(
            f"- **High concentration:** {data['single_author_pct']}% of files have a single author. "
            "Encourage contributions across the codebase."
        )
    if data["high_risk_files"]:
        lines.append(
            f"- **{len(data['high_risk_files'])} high-risk files** with 100+ lines and a single author. "
            "These are the highest-priority areas for knowledge sharing."
        )
    lines.append("")

    return "\n".join(lines)


def format_text(data: dict) -> str:
    """Format analysis results as plain text."""
    lines = []
    lines.append(f"Bus Factor Analysis — {data['date']}")
    lines.append("=" * 50)
    lines.append(f"Bus Factor:           {data['bus_factor']}")
    lines.append(f"Contributors:         {len(data['contributors'])}")
    lines.append(f"Total Commits:        {data['total_commits']}")
    lines.append(f"Files Analyzed:       {data['total_files_analyzed']}")
    lines.append(f"Total Lines:          {data['total_lines']:,}")
    lines.append(
        f"Single-Author Files:  {data['single_author_files']} ({data['single_author_pct']}%)"
    )
    lines.append("")
    lines.append("Line Ownership:")
    for entry in data["author_ownership"]:
        lines.append(
            f"  {entry['author']:<30} {entry['lines']:>8,} lines ({entry['percentage']}%)"
        )
    lines.append("")
    lines.append("Directory Bus Factors:")
    for d, info in sorted(
        data["directory_breakdown"].items(),
        key=lambda x: x[1]["total_lines"],
        reverse=True,
    ):
        lines.append(f"  {d:<20} BF={info['bus_factor']}  ({info['total_lines']:,} lines)")
    lines.append("")
    lines.append(f"High-Risk Files (single author, 100+ lines): {len(data['high_risk_files'])}")
    for entry in data["high_risk_files"][:10]:
        lines.append(f"  {entry['file']:<60} {entry['lines']:>5} lines  ({entry['author']})")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Analyze git repository bus factor")
    parser.add_argument(
        "--repo-path",
        default=".",
        help="Path to the git repository (default: current directory)",
    )
    parser.add_argument(
        "--markdown",
        action="store_true",
        help="Output in Markdown format",
    )
    args = parser.parse_args()

    cwd = os.path.abspath(args.repo_path)
    if not os.path.isdir(os.path.join(cwd, ".git")):
        print(f"Error: {cwd} is not a git repository", file=sys.stderr)
        sys.exit(1)

    print("Running bus-factor analysis...", file=sys.stderr)
    data = analyze(cwd)

    if args.markdown:
        print(format_markdown(data))
    else:
        print(format_text(data))


if __name__ == "__main__":
    main()
