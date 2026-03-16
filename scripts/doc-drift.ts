#!/usr/bin/env bun
/**
 * Doc Drift Detector
 *
 * Cross-references documentation claims against the actual codebase to detect
 * drift across 5 dimensions: route coverage, HTTP method accuracy, route count
 * claims, file path validity, and env var consistency.
 *
 * Exit codes: 0 = no drift, 1 = drift found
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = join(import.meta.dir, "..");
const API_DIR = join(ROOT, "apps/web/app/api");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DriftIssue {
  dimension: string;
  severity: "error" | "warning";
  message: string;
  file?: string;
  line?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(relPath: string): string {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return "";
  return readFileSync(abs, "utf-8");
}

/** Recursively find all route.ts files under a directory */
function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(full));
    } else if (entry.name === "route.ts") {
      results.push(full);
    }
  }
  return results;
}

/** Convert a route file path to its API path, e.g. /api/feed */
function routeFileToApiPath(filePath: string): string {
  const rel = relative(API_DIR, filePath).replace(/\/route\.ts$/, "");
  if (rel === "route.ts") return "/api";
  return "/api/" + rel;
}

/** Extract exported HTTP methods from a route file */
function getExportedMethods(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const methods: string[] = [];
  const re = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    methods.push(m[1]);
  }
  return methods;
}

/** Parse API.md for documented routes: returns array of { method, path, line } */
function parseDocumentedRoutes(content: string): { method: string; path: string; line: number }[] {
  const routes: { method: string; path: string; line: number }[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    // Match patterns like: ### `GET /api/feed` or ### `POST /api/auth/cli/init`
    const match = lines[i].match(/^###\s+`(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/[^`]+)`/);
    if (match) {
      routes.push({ method: match[1], path: match[2], line: i + 1 });
    }
  }
  return routes;
}

/** Parse the route count claim from API.md header */
function parseRouteCountClaim(content: string): { routeFiles: number; handlers: number; line: number } | null {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/(\d+)\s+API route files?\s+with\s+(\d+)\s+HTTP method handlers?/);
    if (match) {
      return { routeFiles: parseInt(match[1]), handlers: parseInt(match[2]), line: i + 1 };
    }
  }
  return null;
}

/** Extract file/directory paths from markdown content */
function extractFilePaths(content: string, fileName: string): { path: string; line: number }[] {
  const paths: { path: string; line: number }[] = [];
  const lines = content.split("\n");
  let inCodeBlock = false;

  // Only match backtick-quoted paths that look like real project file/dir references
  const pattern =
    /`((?:apps|packages|supabase|docs|scripts|\.github|\.claude|\.githooks)\/[^`\s*]+)`/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code blocks to skip tree diagrams
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(line)) !== null) {
      let p = m[1].replace(/\/$/, ""); // trim trailing slash
      // Filter out obviously non-path strings
      if (p.includes(" ") || p.length < 3) continue;
      // Skip URLs
      if (p.startsWith("http")) continue;
      // Skip glob patterns (apps/*, packages/*)
      if (p.includes("*")) continue;
      paths.push({ path: p, line: i + 1 });
    }
  }

  return paths;
}

/** Extract env var names from content */
function extractEnvVars(content: string): { name: string; line: number }[] {
  const vars: { name: string; line: number }[] = [];
  const lines = content.split("\n");
  const seen = new Set<string>();

  // Patterns to exclude: format specifiers, abbreviations, not real env vars
  const excludePatterns = [
    "YYYY", "YYYYMMDD", "UUID", "SHA",
    "NEXT_PUBLIC_", // bare prefix (not a variable)
  ];

  for (let i = 0; i < lines.length; i++) {
    // Match env var patterns: UPPER_CASE_NAME in backticks or table rows
    const matches = lines[i].matchAll(/`([A-Z][A-Z0-9_]{2,})`/g);
    for (const m of matches) {
      const name = m[1];
      // Must contain underscore (env var convention)
      if (!name.includes("_")) continue;
      if (seen.has(name)) continue;
      // Exclude non-env-var patterns
      if (excludePatterns.some((x) => name === x || name.startsWith(x + "-"))) continue;
      // Must be at least somewhat specific (not just "FOO_BAR")
      if (name.length < 5) continue;

      seen.add(name);
      vars.push({ name, line: i + 1 });
    }
  }

  return vars;
}

/** Convert a documented API path to expected route file path */
function apiPathToRouteFile(apiPath: string): string {
  const stripped = apiPath.replace(/^\/api\/?/, "");
  if (!stripped) return join(API_DIR, "route.ts");
  return join(API_DIR, stripped, "route.ts");
}

/** Normalize an API path for comparison (replace [param] with dynamic segments) */
function normalizeApiPath(path: string): string {
  // Normalize bracket params: [id], [username] etc are equivalent
  return path.replace(/\[([^\]]+)\]/g, "[*]").toLowerCase();
}

// ---------------------------------------------------------------------------
// Drift Checks
// ---------------------------------------------------------------------------

function checkRouteCoverage(apiMdContent: string, routeFiles: string[]): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const documented = parseDocumentedRoutes(apiMdContent);

  // Build map of actual route paths
  const actualPaths = new Map<string, string>(); // normalized path -> original file
  for (const f of routeFiles) {
    const apiPath = routeFileToApiPath(f);
    actualPaths.set(normalizeApiPath(apiPath), apiPath);
  }

  // Build map of documented paths
  const documentedPaths = new Set<string>();
  for (const d of documented) {
    documentedPaths.add(normalizeApiPath(d.path));
  }

  // Check for undocumented routes
  for (const [normalized, original] of actualPaths) {
    if (!documentedPaths.has(normalized)) {
      issues.push({
        dimension: "route-coverage",
        severity: "error",
        message: `Route file exists but is not documented in API.md: ${original}`,
        file: "docs/API.md",
      });
    }
  }

  // Check for documented routes with no route file
  const seenDocPaths = new Set<string>();
  for (const d of documented) {
    const normalized = normalizeApiPath(d.path);
    if (seenDocPaths.has(normalized)) continue; // skip duplicate methods on same path
    seenDocPaths.add(normalized);

    if (!actualPaths.has(normalized)) {
      issues.push({
        dimension: "route-coverage",
        severity: "error",
        message: `Documented route has no route file: ${d.path}`,
        file: "docs/API.md",
        line: d.line,
      });
    }
  }

  return issues;
}

function checkHttpMethods(apiMdContent: string, routeFiles: string[]): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const documented = parseDocumentedRoutes(apiMdContent);

  // Build map of actual methods per route
  const actualMethods = new Map<string, Set<string>>(); // normalized path -> methods
  const routeFileMap = new Map<string, string>(); // normalized path -> file path
  for (const f of routeFiles) {
    const apiPath = routeFileToApiPath(f);
    const normalized = normalizeApiPath(apiPath);
    const methods = getExportedMethods(f);
    actualMethods.set(normalized, new Set(methods));
    routeFileMap.set(normalized, relative(ROOT, f));
  }

  // Group documented methods by path
  const docMethodsByPath = new Map<string, { methods: string[]; lines: number[] }>();
  for (const d of documented) {
    const normalized = normalizeApiPath(d.path);
    if (!docMethodsByPath.has(normalized)) {
      docMethodsByPath.set(normalized, { methods: [], lines: [] });
    }
    const entry = docMethodsByPath.get(normalized)!;
    entry.methods.push(d.method);
    entry.lines.push(d.line);
  }

  for (const [normalized, doc] of docMethodsByPath) {
    const actual = actualMethods.get(normalized);
    if (!actual) continue; // covered by route-coverage check

    // Check for documented methods not in the actual file
    for (let i = 0; i < doc.methods.length; i++) {
      if (!actual.has(doc.methods[i])) {
        issues.push({
          dimension: "http-methods",
          severity: "error",
          message: `Documented ${doc.methods[i]} handler not exported in ${routeFileMap.get(normalized) || normalized}`,
          file: "docs/API.md",
          line: doc.lines[i],
        });
      }
    }

    // Check for exported methods not documented
    for (const method of actual) {
      if (!doc.methods.includes(method)) {
        issues.push({
          dimension: "http-methods",
          severity: "warning",
          message: `${method} handler exported in ${routeFileMap.get(normalized) || normalized} but not documented in API.md`,
          file: routeFileMap.get(normalized),
        });
      }
    }
  }

  return issues;
}

function checkRouteCountClaim(apiMdContent: string, routeFiles: string[]): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const claim = parseRouteCountClaim(apiMdContent);
  if (!claim) return issues;

  const actualRouteCount = routeFiles.length;
  let actualHandlerCount = 0;
  for (const f of routeFiles) {
    actualHandlerCount += getExportedMethods(f).length;
  }

  if (claim.routeFiles !== actualRouteCount) {
    issues.push({
      dimension: "route-count",
      severity: "error",
      message: `API.md claims ${claim.routeFiles} route files but ${actualRouteCount} exist`,
      file: "docs/API.md",
      line: claim.line,
    });
  }

  if (claim.handlers !== actualHandlerCount) {
    issues.push({
      dimension: "route-count",
      severity: "error",
      message: `API.md claims ${claim.handlers} HTTP method handlers but ${actualHandlerCount} exist`,
      file: "docs/API.md",
      line: claim.line,
    });
  }

  return issues;
}

function checkFilePaths(): DriftIssue[] {
  const issues: DriftIssue[] = [];

  const docsToCheck = [
    "docs/API.md",
    "docs/CLI.md",
    "docs/SETUP.md",
    "CLAUDE.md",
  ];

  for (const docFile of docsToCheck) {
    const content = readFile(docFile);
    if (!content) continue;

    const paths = extractFilePaths(content, docFile);
    for (const { path: p, line } of paths) {
      const abs = join(ROOT, p);
      if (!existsSync(abs)) {
        issues.push({
          dimension: "file-paths",
          severity: "warning",
          message: `Referenced path does not exist: ${p}`,
          file: docFile,
          line,
        });
      }
    }
  }

  return issues;
}

function checkEnvVars(): DriftIssue[] {
  const issues: DriftIssue[] = [];

  const envExampleContent = readFile(".env.example");
  if (!envExampleContent) {
    issues.push({
      dimension: "env-vars",
      severity: "warning",
      message: ".env.example not found — cannot cross-reference env vars",
    });
    return issues;
  }

  // Parse .env.example for defined vars
  const envExampleVars = new Set<string>();
  for (const line of envExampleContent.split("\n")) {
    const match = line.match(/^([A-Z][A-Z0-9_]+)\s*=/);
    if (match) envExampleVars.add(match[1]);
  }

  const docsToCheck = [
    "docs/SETUP.md",
    "CLAUDE.md",
  ];

  for (const docFile of docsToCheck) {
    const content = readFile(docFile);
    if (!content) continue;

    const vars = extractEnvVars(content);
    for (const { name, line } of vars) {
      // Only flag vars that look like they should be in .env.example
      // Skip NEXT_PUBLIC_ prefix check — those are valid env vars
      if (!envExampleVars.has(name)) {
        // Check if it's a plausible env var that should be in .env.example
        // Filter out section headers, constants, or format specifiers
        const isLikelyEnvVar =
          name.endsWith("_KEY") ||
          name.endsWith("_SECRET") ||
          name.endsWith("_URL") ||
          name.endsWith("_IDS") ||
          name.endsWith("_EMAIL") ||
          name.startsWith("NEXT_PUBLIC_") ||
          name.startsWith("SUPABASE_") ||
          name.startsWith("RESEND_") ||
          name.startsWith("ANTHROPIC_") ||
          name.startsWith("FAL_") ||
          name.startsWith("CRON_") ||
          name.startsWith("CLI_") ||
          name.startsWith("ADMIN_");

        if (isLikelyEnvVar) {
          issues.push({
            dimension: "env-vars",
            severity: "warning",
            message: `Env var ${name} referenced in ${docFile} but not in .env.example`,
            file: docFile,
            line,
          });
        }
      }
    }
  }

  // Check for vars in .env.example not documented in SETUP.md
  const setupContent = readFile("docs/SETUP.md");
  if (setupContent) {
    for (const varName of envExampleVars) {
      if (!setupContent.includes(varName)) {
        issues.push({
          dimension: "env-vars",
          severity: "warning",
          message: `Env var ${varName} is in .env.example but not documented in docs/SETUP.md`,
          file: "docs/SETUP.md",
        });
      }
    }
  }

  return issues;
}

function checkCliEndpoints(cliMdContent: string, routeFiles: string[]): DriftIssue[] {
  const issues: DriftIssue[] = [];

  // Build set of actual route paths
  const actualPaths = new Set<string>();
  for (const f of routeFiles) {
    actualPaths.add(normalizeApiPath(routeFileToApiPath(f)));
  }

  // Extract API endpoint references from CLI.md
  const lines = cliMdContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].matchAll(/(GET|POST|PUT|PATCH|DELETE)\s+(`?)(\/api\/[^\s`]+)\2/g);
    for (const m of matches) {
      const method = m[1];
      const path = m[3];
      const normalized = normalizeApiPath(path);

      if (!actualPaths.has(normalized)) {
        issues.push({
          dimension: "cli-endpoints",
          severity: "error",
          message: `CLI.md references ${method} ${path} but no matching route file exists`,
          file: "docs/CLI.md",
          line: i + 1,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log("Doc Drift Detector\n");

  const apiMdContent = readFile("docs/API.md");
  const cliMdContent = readFile("docs/CLI.md");
  const routeFiles = findRouteFiles(API_DIR);

  const allIssues: DriftIssue[] = [];

  // 1. Route coverage
  if (apiMdContent) {
    allIssues.push(...checkRouteCoverage(apiMdContent, routeFiles));
  }

  // 2. HTTP method accuracy
  if (apiMdContent) {
    allIssues.push(...checkHttpMethods(apiMdContent, routeFiles));
  }

  // 3. Route count claim
  if (apiMdContent) {
    allIssues.push(...checkRouteCountClaim(apiMdContent, routeFiles));
  }

  // 4. File path validity
  allIssues.push(...checkFilePaths());

  // 5. Env var consistency
  allIssues.push(...checkEnvVars());

  // 6. CLI endpoint references
  if (cliMdContent) {
    allIssues.push(...checkCliEndpoints(cliMdContent, routeFiles));
  }

  // Report
  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  const dimensions = new Set(allIssues.map((i) => i.dimension));

  for (const dim of [
    "route-coverage",
    "http-methods",
    "route-count",
    "file-paths",
    "env-vars",
    "cli-endpoints",
  ]) {
    const dimIssues = allIssues.filter((i) => i.dimension === dim);
    if (dimIssues.length === 0) {
      console.log(`✓ ${dim}: no drift`);
      continue;
    }
    console.log(`✗ ${dim}: ${dimIssues.length} issue(s)`);
    for (const issue of dimIssues) {
      const loc = issue.file ? ` (${issue.file}${issue.line ? `:${issue.line}` : ""})` : "";
      const icon = issue.severity === "error" ? "  ERROR" : "  WARN ";
      console.log(`${icon} ${issue.message}${loc}`);
    }
    console.log();
  }

  console.log("---");
  console.log(
    `Summary: ${errors.length} error(s), ${warnings.length} warning(s) across ${dimensions.size} dimension(s)`
  );
  console.log(`Route files: ${routeFiles.length}`);

  // JSON output for CI
  const report = {
    timestamp: new Date().toISOString(),
    route_files: routeFiles.length,
    errors: errors.length,
    warnings: warnings.length,
    issues: allIssues,
  };

  if (process.env.DOC_DRIFT_JSON) {
    console.log("\n" + JSON.stringify(report, null, 2));
  }

  process.exit(allIssues.some((i) => i.severity === "error") ? 1 : 0);
}

main();
