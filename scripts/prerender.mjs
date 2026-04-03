#!/usr/bin/env node
/**
 * Pre-renders public (non-authenticated) pages at build time so search
 * engines and AI crawlers see real content instead of an empty <div id="root">.
 *
 * Run after `vite build`:  npm run prerender
 *
 * How it works:
 *  1. Starts a tiny static server for dist/
 *  2. Opens each public route in headless Chromium (via Playwright)
 *     with prefers-reduced-motion so GSAP skips animations and shows all content
 *  3. Waits for React to render + usePageMeta to set meta tags
 *  4. Captures the full HTML and writes it to the correct dist/ path
 *
 * The messaging app (logged-in routes) stays client-only.
 * Cloudflare Pages serves static files before _redirects rules,
 * so dist/privacy/index.html is served automatically for /privacy.
 */

import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const DIST = join(process.cwd(), "dist");
const PORT = 4199;

/** Public routes to pre-render. */
const ROUTES = ["/", "/privacy", "/terms", "/support", "/community"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Minimal static file server for dist/. */
function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let file = join(DIST, url.pathname);

    if (await isDir(file)) file = join(file, "index.html");
    if (!(await exists(file))) file = join(DIST, "index.html"); // SPA fallback

    try {
      const data = await readFile(file);
      res.writeHead(200, {
        "Content-Type": MIME[extname(file)] || "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });

  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function prerender() {
  if (!(await exists(DIST))) {
    console.error("dist/ not found. Run `vite build` first.");
    process.exit(1);
  }

  console.log("\nPre-rendering public pages...\n");

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    for (const route of ROUTES) {
      process.stdout.write(`  ${route} ... `);

      const page = await browser.newPage({
        // GSAP's matchMedia handler detects reduced-motion and immediately
        // sets all elements to autoAlpha:1 — no animation delay.
        reducedMotion: "reduce",
      });

      try {
        await page.goto(`http://localhost:${PORT}${route}`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });

        // Wait for React to render content inside #root
        await page.waitForSelector("#root > *", { timeout: 15000 });

        // Give usePageMeta and SeoStructuredData effects time to settle
        await page.waitForTimeout(2000);

        const html = await page.content();

        if (route === "/") {
          await writeFile(join(DIST, "index.html"), html, "utf-8");
        } else {
          const dir = join(DIST, route);
          await mkdir(dir, { recursive: true });
          await writeFile(join(dir, "index.html"), html, "utf-8");
        }

        console.log("done");
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log("\nPre-rendering complete!\n");
}

prerender().catch((err) => {
  console.error("Pre-render failed:", err);
  process.exit(1);
});
