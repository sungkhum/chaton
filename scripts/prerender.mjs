#!/usr/bin/env node
/**
 * Pre-renders public (non-authenticated) pages at build time so search
 * engines and AI crawlers see real content instead of an empty <div id="root">.
 *
 * Also generates OG images for blog posts using the same Playwright browser.
 *
 * Run after `vite build`:  npm run prerender
 */

import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(process.cwd(), "dist");
const PORT = 4199;

/** Public routes to pre-render. Add new blog posts here too. */
const ROUTES = [
  "/", "/privacy", "/terms", "/support", "/community",
  "/faq", "/about", "/compare",
  "/blog", "/blog/near-zero-infrastructure",
];

/** Blog posts that need OG images. */
const OG_POSTS = [
  {
    slug: "near-zero-infrastructure",
    title: "How We Run a Messaging App for Near-Zero Cost",
    date: "April 3, 2026",
  },
];

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

/** Generate OG images for blog posts by screenshotting an HTML template. */
async function generateOgImages(browser) {
  if (OG_POSTS.length === 0) return;

  console.log("Generating OG images...\n");

  const templatePath = join(__dirname, "og-template.html");
  const templateHtml = await readFile(templatePath, "utf-8");
  const logoPath = join(DIST, "ChatOn-Logo-Small.png");
  const logoBase64 = `data:image/png;base64,${(await readFile(logoPath)).toString("base64")}`;

  for (const post of OG_POSTS) {
    process.stdout.write(`  og: ${post.slug} ... `);

    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
    });

    try {
      // Inject post data into the template
      const html = templateHtml
        .replace("TITLE", post.title)
        .replace("DATE", post.date);

      await page.setContent(html, { waitUntil: "networkidle" });

      // Set the logo src to base64 (avoids network request)
      await page.evaluate((src) => {
        document.getElementById("logo").setAttribute("src", src);
      }, logoBase64);

      await page.waitForTimeout(200);

      const outDir = join(DIST, "og", "blog");
      await mkdir(outDir, { recursive: true });
      await page.screenshot({
        path: join(outDir, `${post.slug}.png`),
        type: "png",
      });

      console.log("done");
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  console.log("");
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
    // 1. Pre-render HTML pages
    for (const route of ROUTES) {
      process.stdout.write(`  ${route} ... `);

      const page = await browser.newPage({
        reducedMotion: "reduce",
      });

      try {
        await page.goto(`http://localhost:${PORT}${route}`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });

        await page.waitForSelector("#root > *", { timeout: 15000 });
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

    console.log("");

    // 2. Generate OG images for blog posts
    await generateOgImages(browser);
  } finally {
    await browser.close();
    server.close();
  }

  console.log("Pre-rendering complete!\n");
}

prerender().catch((err) => {
  console.error("Pre-render failed:", err);
  process.exit(1);
});
