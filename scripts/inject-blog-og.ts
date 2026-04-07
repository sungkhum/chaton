#!/usr/bin/env tsx
/**
 * Post-build step: generates dist/blog/{slug}/index.html with correct OG tags.
 *
 * Cloudflare Pages can't run Playwright, so the prerender script only runs
 * locally. This lightweight script runs after `vite build` — it reads the
 * built index.html, swaps in blog-specific meta tags, and writes the result
 * for each blog post.
 *
 * Blog metadata is imported directly from blog-registry.ts — no duplication.
 * Run with: npx tsx scripts/inject-blog-og.ts
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { BLOG_POSTS } from "../src/components/blog/blog-registry";

const DIST = join(process.cwd(), "dist");
const BASE_URL = "https://getchaton.com";

function injectOgTags(
  html: string,
  post: { slug: string; title: string; description: string }
): string {
  const ogTitle = `${post.title} — ChatOn Blog`;
  const ogImage = `${BASE_URL}/og/blog/${post.slug}.png`;
  const ogUrl = `${BASE_URL}/blog/${post.slug}`;

  const replacements: [RegExp, string][] = [
    [/(<title>)[^<]*(<\/title>)/, `$1${ogTitle}$2`],
    [
      /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
      `$1${ogUrl}$2`,
    ],
    [
      /(<meta\s+name="description"\s+content=")[^"]*(")/,
      `$1${post.description}$2`,
    ],
    [
      /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
      `$1${ogTitle}$2`,
    ],
    [
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      `$1${post.description}$2`,
    ],
    [
      /(<meta\s+property="og:image"\s+content=")[^"]*(")/,
      `$1${ogImage}$2`,
    ],
    [
      /(<meta\s+property="og:image:type"\s+content=")[^"]*(")/,
      `$1image/png$2`,
    ],
    [
      /(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/,
      `$1${ogTitle}$2`,
    ],
    [
      /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
      `$1${ogUrl}$2`,
    ],
    [
      /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
      `$1${ogTitle}$2`,
    ],
    [
      /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
      `$1${post.description}$2`,
    ],
    [
      /(<meta\s+name="twitter:image"\s+content=")[^"]*(")/,
      `$1${ogImage}$2`,
    ],
  ];

  for (const [pattern, replacement] of replacements) {
    html = html.replace(pattern, replacement);
  }

  return html;
}

async function main() {
  const indexHtml = await readFile(join(DIST, "index.html"), "utf-8");

  for (const post of BLOG_POSTS) {
    const html = injectOgTags(indexHtml, post);
    const dir = join(DIST, "blog", post.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.html"), html, "utf-8");
    console.log(`  blog og: /blog/${post.slug}`);
  }
}

main().catch((err) => {
  console.error("inject-blog-og failed:", err);
  process.exit(1);
});
