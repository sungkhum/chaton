#!/usr/bin/env node
/**
 * generate-repo-map.mjs — Builds a compact .ai/repo-map.md for AI agent consumption.
 *
 * Inspired by aider's repo-map (tree-sitter + PageRank) but zero-dependency.
 * Uses regex-based extraction for TypeScript/TSX projects.
 *
 * What it produces:
 *   1. Route → Component → File mapping
 *   2. Error code → throw/catch site mapping
 *   3. Compact symbol index (exported fns, classes, components, hooks)
 *
 * Setup for any TS/React repo:
 *   1. Copy this script to scripts/generate-repo-map.mjs
 *   2. Edit the CONFIG section below
 *   3. Add to your pre-commit hook:
 *        node scripts/generate-repo-map.mjs && git add .ai/
 *   4. (Optional) Add to package.json scripts:
 *        "repo-map": "node scripts/generate-repo-map.mjs"
 *
 * Zero dependencies — uses only Node built-ins.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { resolve, relative, extname, basename, dirname } from "path";

// ─── CONFIG (edit for your project) ────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, "..");
const SRC = resolve(ROOT, "src");
const OUTPUT = resolve(ROOT, ".ai/repo-map.md");

/** Directories to scan, relative to src/. Order = output order. */
const SCAN_DIRS = [
  { dir: "components", label: "Components" },
  { dir: "services",   label: "Services" },
  { dir: "hooks",      label: "Hooks" },
  { dir: "store",      label: "Store" },
  { dir: "utils",      label: "Utils" },
];

/** File that defines the app's route→component mapping (for route extraction). */
const ROUTE_FILE = "src/App.tsx";

/** File that defines error code constants (for error code mapping). */
const ERROR_CODES_FILE = "src/utils/error-codes.ts";

/** Function name used to capture/report errors (for finding throw sites). */
const ERROR_CAPTURE_FN = "captureError";

/** File extensions to scan. */
const EXTENSIONS = new Set([".ts", ".tsx"]);

/** Directories to skip entirely. */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".ai", ".ai-codex"]);

/** Files to skip. */
const SKIP_FILES = new Set(["vite-env.d.ts", "react-canary.d.ts"]);

// ─── HELPERS ───────────────────────────────────────────────────────────────

function walkDir(dir) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return results; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = resolve(dir, name);
    const st = statSync(full, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) {
      results.push(...walkDir(full));
    } else if (EXTENSIONS.has(extname(name)) && !SKIP_FILES.has(name)) {
      results.push(full);
    }
  }
  return results.sort();
}

function rel(absPath) {
  return relative(ROOT, absPath);
}

// ─── 1. ROUTE MAP ──────────────────────────────────────────────────────────

function extractRoutes() {
  const file = resolve(ROOT, ROUTE_FILE);
  let content;
  try { content = readFileSync(file, "utf8"); } catch { return []; }

  const routes = [];

  // Extract lazy imports: const Name = lazy(() => import("./path"))
  const lazyImports = new Map();
  const lazyRe = /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*\n?\s*import\(["']([^"']+)["']\)/g;
  let m;
  while ((m = lazyRe.exec(content))) {
    // Resolve the import path relative to the file
    const importPath = m[2];
    const resolved = importPath.startsWith(".")
      ? relative(ROOT, resolve(dirname(file), importPath)).replace(/^/, "")
      : importPath;
    // Normalize: add .tsx if no extension
    const normalized = /\.\w+$/.test(resolved) ? resolved : resolved + ".tsx";
    lazyImports.set(m[1], normalized);
  }

  // Extract direct imports for components used in routes
  const importRe = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  while ((m = importRe.exec(content))) {
    const names = m[1].split(",").map(n => n.trim());
    const importPath = m[2];
    const resolved = importPath.startsWith(".")
      ? relative(ROOT, resolve(dirname(file), importPath))
      : importPath;
    const normalized = /\.\w+$/.test(resolved) ? resolved : resolved + ".tsx";
    for (const name of names) {
      if (!lazyImports.has(name)) {
        lazyImports.set(name, normalized);
      }
    }
  }

  // Extract route patterns: if (path === "/foo") ... <Component />
  // The first <Component inside the block is usually a wrapper (RouteErrorBoundary),
  // so we collect ALL component tags and pick the first one that's in lazyImports.
  const routeBlockRe = /if\s*\(path\s*===\s*["']([^"']+)["']\)\s*\{?\s*return\s*\(([\s\S]*?)\);\s*\}?/g;
  while ((m = routeBlockRe.exec(content))) {
    const route = m[1];
    const block = m[2];
    // Find all <Component tags in this block, skip wrappers/html elements
    const WRAPPER_TAGS = new Set(["RouteErrorBoundary", "Suspense", "div", "Toaster"]);
    const tags = [...block.matchAll(/<(\w+)/g)].map(t => t[1]);
    const component = tags.find(t => !WRAPPER_TAGS.has(t) && /^[A-Z]/.test(t)) || tags[tags.length - 1] || "?";
    const file = lazyImports.get(component) || "?";
    routes.push({ route, component, file });
  }

  const startsWithRe = /if\s*\(path\.startsWith\(["']([^"']+)["']\)\)\s*\{?\s*[\s\S]*?return\s*\(([\s\S]*?)\);\s*\}?/g;
  while ((m = startsWithRe.exec(content))) {
    const WRAPPER_TAGS = new Set(["RouteErrorBoundary", "Suspense", "div", "Toaster"]);
    const block = m[2];
    const tags = [...block.matchAll(/<(\w+)/g)].map(t => t[1]);
    const component = tags.find(t => !WRAPPER_TAGS.has(t) && /^[A-Z]/.test(t)) || tags[tags.length - 1] || "?";
    routes.push({
      route: m[1] + "*",
      component,
      file: lazyImports.get(component) || "?",
    });
  }

  // Special cases that use variables (isJoinRoute, showLanding) — extract from lazy imports
  if (lazyImports.has("JoinGroupPage")) {
    routes.push({ route: "/join/:code", component: "JoinGroupPage", file: lazyImports.get("JoinGroupPage") });
  }
  if (lazyImports.has("LandingPage")) {
    routes.push({ route: "/ (logged-out)", component: "LandingPage", file: lazyImports.get("LandingPage") });
  }
  if (lazyImports.has("NotFoundPage")) {
    routes.push({ route: "* (404)", component: "NotFoundPage", file: lazyImports.get("NotFoundPage") });
  }

  // Logged-in main app
  const msgAppImport = lazyImports.get("MessagingApp");
  if (msgAppImport) {
    routes.push({ route: "(authenticated)", component: "MessagingApp", file: msgAppImport });
  }

  // Fix up unresolved components — try matching by kebab-case convention
  for (const r of routes) {
    if (r.file === "?" || r.component === "?") {
      // Try kebab-case: JoinGroupPage → join-group-page
      const kebab = r.component !== "?" ? r.component.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase() : "";
      const candidates = kebab ? [
        `src/components/${kebab}.tsx`,
        `src/components/${kebab}/index.tsx`,
      ] : [];
      for (const c of candidates) {
        try { readFileSync(resolve(ROOT, c)); r.file = c; break; } catch {}
      }
    }
  }

  // Filter out routes that have both component and file as "?" — not useful
  return routes.filter(r => r.component !== "?" || r.file !== "?");

  return routes;
}

// ─── 2. ERROR CODE MAP ─────────────────────────────────────────────────────

function extractErrorCodes() {
  const file = resolve(ROOT, ERROR_CODES_FILE);
  let content;
  try { content = readFileSync(file, "utf8"); } catch { return []; }

  const codes = [];
  let currentCategory = "";

  for (const line of content.split("\n")) {
    // Category comments: // Messaging, // Auth / Identity, etc.
    const catMatch = line.match(/^\s*\/\/\s*(.+)/);
    if (catMatch && !catMatch[1].includes("@") && !catMatch[1].includes("*")) {
      currentCategory = catMatch[1].trim();
      continue;
    }
    // Code entries: KEY: "value",
    const codeMatch = line.match(/(\w+):\s*["']([^"']+)["']/);
    if (codeMatch) {
      codes.push({ key: codeMatch[1], value: codeMatch[2], category: currentCategory });
    }
  }

  // Map categories to relevant source files by scanning for actual usage
  const allFiles = walkDir(SRC);
  const codeUsage = new Map(); // value → Set of files that reference it

  for (const filePath of allFiles) {
    if (filePath === resolve(ROOT, ERROR_CODES_FILE)) continue;
    let fileContent;
    try { fileContent = readFileSync(filePath, "utf8"); } catch { continue; }

    for (const code of codes) {
      if (fileContent.includes(`ERROR_CODES.${code.key}`) ||
          fileContent.includes(`"${code.value}"`) ||
          fileContent.includes(`'${code.value}'`)) {
        if (!codeUsage.has(code.value)) codeUsage.set(code.value, new Set());
        codeUsage.get(code.value).add(rel(filePath));
      }
    }
  }

  return codes.map(c => ({
    ...c,
    usedIn: [...(codeUsage.get(c.value) || [])],
  }));
}

// ─── 3. SYMBOL INDEX ───────────────────────────────────────────────────────

function extractExports(filePath) {
  let content;
  try { content = readFileSync(filePath, "utf8"); } catch { return []; }

  const symbols = [];

  // export function name(
  const fnRe = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
  let m;
  while ((m = fnRe.exec(content))) {
    symbols.push({ type: "fn", name: m[1] });
  }

  // export const name = (...) =>   OR   export const name = function
  const constFnRe = /^export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(?/gm;
  while ((m = constFnRe.exec(content))) {
    // Skip if already captured, and determine if it's a component (PascalCase)
    const name = m[1];
    if (symbols.some(s => s.name === name)) continue;
    const type = /^[A-Z]/.test(name) ? "component" : "fn";
    symbols.push({ type, name });
  }

  // export class Name
  const classRe = /^export\s+class\s+(\w+)/gm;
  while ((m = classRe.exec(content))) {
    symbols.push({ type: "class", name: m[1] });
  }

  // export default function Name
  const defFnRe = /^export\s+default\s+function\s+(\w+)/gm;
  while ((m = defFnRe.exec(content))) {
    if (!symbols.some(s => s.name === m[1])) {
      symbols.push({ type: "fn", name: m[1], default: true });
    }
  }

  // For React components: export function Name or export const Name where PascalCase
  // Already handled above via PascalCase detection

  return symbols;
}

// ─── 4. ENTRY-POINT FILES ──────────────────────────────────────────────────

function extractEntryPoints() {
  const entries = [];

  // App.tsx
  entries.push({ file: "src/App.tsx", desc: "Root app component, route switching, auth flow" });

  // main.tsx
  entries.push({ file: "src/main.tsx", desc: "React entry point, renders App" });

  // sw.ts
  entries.push({ file: "src/sw.ts", desc: "Service worker (push notifications, caching)" });

  // store/index.ts
  const storePath = resolve(SRC, "store/index.ts");
  try {
    const content = readFileSync(storePath, "utf8");
    const exports = [];
    const re = /export\s+(?:const|function|interface|type)\s+(\w+)/g;
    let m;
    while ((m = re.exec(content))) exports.push(m[1]);
    if (exports.length > 0) {
      entries.push({ file: "src/store/index.ts", desc: `Zustand store: ${exports.slice(0, 8).join(", ")}${exports.length > 8 ? ", ..." : ""}` });
    }
  } catch {}

  return entries;
}

// ─── BUILD OUTPUT ──────────────────────────────────────────────────────────

function build() {
  const lines = [];
  const now = new Date().toISOString().split("T")[0];

  lines.push(`# Repo Map (generated ${now})`);
  lines.push(`# Compact codebase index for AI agents. Read this FIRST, then do targeted file reads.`);
  lines.push("");

  // ── Routes
  const routes = extractRoutes();
  if (routes.length > 0) {
    lines.push("## Routes");
    lines.push("<!-- route → Component → file -->");
    for (const r of routes) {
      lines.push(`${r.route} → ${r.component} → ${r.file}`);
    }
    lines.push("");
  }

  // ── Error Codes
  const codes = extractErrorCodes();
  if (codes.length > 0) {
    lines.push("## Error Codes");
    lines.push("<!-- When a ticket has an error_code, find it here to know where to look -->");
    let lastCat = "";
    for (const c of codes) {
      if (c.category && c.category !== lastCat) {
        lines.push(`# ${c.category}`);
        lastCat = c.category;
      }
      const usage = c.usedIn.length > 0 ? ` → ${c.usedIn.join(", ")}` : "";
      lines.push(`${c.value} (${c.key})${usage}`);
    }
    lines.push("");
  }

  // ── Entry Points
  const entries = extractEntryPoints();
  if (entries.length > 0) {
    lines.push("## Entry Points");
    for (const e of entries) {
      lines.push(`${e.file} — ${e.desc}`);
    }
    lines.push("");
  }

  // ── Symbol Index by directory
  for (const { dir, label } of SCAN_DIRS) {
    const dirPath = resolve(SRC, dir);
    const files = walkDir(dirPath);
    if (files.length === 0) continue;

    lines.push(`## ${label}`);

    for (const filePath of files) {
      const symbols = extractExports(filePath);
      const relPath = rel(filePath);

      if (symbols.length === 0) {
        // Still list the file but note it has no public exports
        lines.push(`${relPath}`);
        continue;
      }

      // Group by type for compact display
      const fns = symbols.filter(s => s.type === "fn").map(s => s.name);
      const components = symbols.filter(s => s.type === "component").map(s => s.name);
      const classes = symbols.filter(s => s.type === "class").map(s => s.name);

      const parts = [];
      if (components.length > 0) parts.push(components.join(", "));
      if (fns.length > 0) parts.push(`fn ${fns.join(", ")}`);
      if (classes.length > 0) parts.push(`class ${classes.join(", ")}`);

      let symbolLine = `${relPath}  ${parts.join(" | ")}`;
      // Cap long lines — agent can always Read the file for full details
      if (symbolLine.length > 200) {
        const total = fns.length + components.length + classes.length;
        const preview = symbols.slice(0, 6).map(s =>
          s.type === "fn" ? `fn ${s.name}` : s.name
        ).join(", ");
        symbolLine = `${relPath}  ${preview}, ... (${total} exports)`;
      }
      lines.push(symbolLine);
    }
    lines.push("");
  }

  // ── Worker (if exists)
  const workerDir = resolve(ROOT, "worker/src");
  const workerFiles = walkDir(workerDir);
  if (workerFiles.length > 0) {
    lines.push("## Worker (Cloudflare)");
    for (const filePath of workerFiles) {
      const symbols = extractExports(filePath);
      const relPath = rel(filePath);
      if (symbols.length === 0) {
        lines.push(relPath);
      } else {
        const names = symbols.map(s => (s.type === "fn" ? `fn ${s.name}` : s.name));
        let line = `${relPath}  ${names.join(", ")}`;
        if (line.length > 200) {
          const preview = names.slice(0, 6).join(", ");
          line = `${relPath}  ${preview}, ... (${names.length} exports)`;
        }
        lines.push(line);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

mkdirSync(dirname(OUTPUT), { recursive: true });
const output = build();
writeFileSync(OUTPUT, output, "utf8");

const lineCount = output.split("\n").length;
const sizeKB = (Buffer.byteLength(output) / 1024).toFixed(1);
console.log(`repo-map: ${lineCount} lines, ${sizeKB}KB → ${relative(ROOT, OUTPUT)}`);
