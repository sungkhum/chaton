# Repo Map — Setup Guide

A zero-dependency Node script that generates a compact codebase index for AI agents.
Replaces slow codebase exploration with instant passive context.

## What it generates

`.ai/repo-map.md` — a single file containing:
- **Route map**: URL path → React component → source file
- **Error code map**: error string → source files that use it
- **Symbol index**: every exported function, class, and component with file paths

AI agents read this map first, then do targeted file reads instead of grepping the whole repo.

## Setup for a new repo

### 1. Copy the script

```bash
mkdir -p scripts
cp /path/to/generate-repo-map.mjs scripts/generate-repo-map.mjs
```

### 2. Edit the CONFIG section

Open `scripts/generate-repo-map.mjs` and edit the top CONFIG block:

```js
const SRC = resolve(ROOT, "src");           // Your source directory
const OUTPUT = resolve(ROOT, ".ai/repo-map.md");

const SCAN_DIRS = [
  { dir: "components", label: "Components" },
  { dir: "services",   label: "Services" },
  { dir: "hooks",      label: "Hooks" },
  { dir: "store",      label: "Store" },
  { dir: "utils",      label: "Utils" },
];

const ROUTE_FILE = "src/App.tsx";           // Your route definitions file
const ERROR_CODES_FILE = "src/utils/error-codes.ts";  // Your error codes file (or "" to skip)
const ERROR_CAPTURE_FN = "captureError";    // Function name that reports errors
```

For non-React projects, set `ROUTE_FILE` to `""` to skip route extraction.
Adjust `SCAN_DIRS` to match your project structure (e.g., `lib/`, `modules/`, `api/`).

### 3. Run it

```bash
node scripts/generate-repo-map.mjs
```

Check the output at `.ai/repo-map.md`. Adjust CONFIG until it captures your codebase accurately.

### 4. Add to pre-commit hook

**With husky:**
```bash
# .husky/pre-commit
node scripts/generate-repo-map.mjs >/dev/null 2>&1 && git add .ai/ 2>/dev/null || true
```

**With lint-staged (package.json):**
```json
{
  "scripts": {
    "repo-map": "node scripts/generate-repo-map.mjs"
  }
}
```

**Manual:**
```bash
npm run repo-map  # or just run before committing
```

### 5. Add .ai/ to git

```bash
git add .ai/repo-map.md
echo ".ai/SETUP.md" >> .gitignore  # Optional: don't commit the setup guide
```

### 6. Reference in CLAUDE.md

Add to your `CLAUDE.md`:
```markdown
## Codebase Index

Read `.ai/repo-map.md` FIRST before exploring the codebase. It contains:
- Route → Component → File mapping
- Error code → source file mapping
- Compact symbol index of all exports
```

## Customization

### Adding new sections

The script is modular. To add a new section (e.g., API endpoints), add a function
that returns lines and call it in `build()`:

```js
function extractApiEndpoints() {
  // scan for Express/Fastify routes, return formatted lines
}
```

### Different languages

The export extraction uses regex patterns for TypeScript/JavaScript:
- `export function name(` → fn
- `export const Name = ` → component (PascalCase) or fn
- `export class Name` → class

For Python, Go, Rust, etc., adjust the regex patterns in `extractExports()`.
Or replace with tree-sitter for language-agnostic parsing (see aider's approach).

### Token budget

The output is designed to fit comfortably in a single prompt (~12KB for a 140-file project).
If your repo is larger, consider:
- Reducing SCAN_DIRS to only the most important directories
- Increasing the line truncation threshold (currently 200 chars)
- Splitting into multiple map files by domain

## Migration from .ai-codex

If you were using the `ai-codex` npm package:

1. Remove `ai-codex` from devDependencies: `npm uninstall ai-codex`
2. Update pre-commit hook (see step 4 above)
3. Update CLAUDE.md references from `.ai-codex/` to `.ai/repo-map.md`
4. Optionally delete `.ai-codex/` directory
5. The new map covers everything ai-codex did plus routes, error codes, and worker files
