#!/usr/bin/env node
/**
 * Post-build step: generates dist/blog/{slug}/index.html with correct OG tags.
 *
 * The prerender script (Playwright) can't run on Cloudflare Pages, so social
 * crawlers were getting the default homepage OG tags for blog URLs. This script
 * runs after `vite build` with zero dependencies — it reads the built index.html,
 * swaps in blog-specific meta tags, and writes the result for each blog post.
 *
 * Blog metadata is duplicated here (not imported from blog-registry.ts) to avoid
 * needing a TypeScript build step. Keep in sync when adding new posts.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const DIST = join(process.cwd(), "dist");
const BASE_URL = "https://getchaton.com";

/**
 * Blog post metadata. Keep in sync with:
 * - src/components/blog/blog-registry.ts
 * - scripts/prerender.mjs (OG_POSTS)
 */
const BLOG_POSTS = [
  {
    slug: "near-zero-infrastructure",
    title: "How We Run a Messaging App for Near-Zero Cost",
    description:
      "Most messaging apps spend millions on servers. ChatOn uses the DeSo blockchain as its entire backend — no database, no custom API, no server bill.",
  },
];

function injectOgTags(html, post) {
  const ogTitle = `${post.title} — ChatOn Blog`;
  const ogImage = `${BASE_URL}/og/blog/${post.slug}.png`;
  const ogUrl = `${BASE_URL}/blog/${post.slug}`;

  const replacements = [
    [/(<title>)[^<]*(<\/title>)/, `$1${ogTitle}$2`],
    [/(<link\s+rel="canonical"\s+href=")[^"]*(")/,              `$1${ogUrl}$2`],
    [/(<meta\s+name="description"\s+content=")[^"]*(")/,        `$1${post.description}$2`],
    [/(<meta\s+property="og:title"\s+content=")[^"]*(")/,       `$1${ogTitle}$2`],
    [/(<meta\s+property="og:description"\s+content=")[^"]*(")/,  `$1${post.description}$2`],
    [/(<meta\s+property="og:image"\s+content=")[^"]*(")/,       `$1${ogImage}$2`],
    [/(<meta\s+property="og:image:type"\s+content=")[^"]*(")/,  `$1image/png$2`],
    [/(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/,   `$1${ogTitle}$2`],
    [/(<meta\s+property="og:url"\s+content=")[^"]*(")/,         `$1${ogUrl}$2`],
    [/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,      `$1${ogTitle}$2`],
    [/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,`$1${post.description}$2`],
    [/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/,      `$1${ogImage}$2`],
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
