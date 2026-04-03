import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  readTime: string;
  tags: string[];
  component: () => Promise<{ default: ComponentType }>;
}

/**
 * Blog post registry. Add new posts here — they automatically appear
 * on /blog, get routes in App.tsx, and are pre-rendered at build time.
 *
 * Posts are sorted newest-first on the index page.
 */
export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "near-zero-infrastructure",
    title: "How We Run a Messaging App for Near-Zero Cost",
    description:
      "Most messaging apps spend millions on servers. ChatOn uses the DeSo blockchain as its entire backend — no database, no custom API, no server bill.",
    date: "2026-04-03",
    readTime: "6 min read",
    tags: ["engineering", "architecture", "deso"],
    component: () => import("./posts/near-zero-infrastructure"),
  },
];

/** Get all blog slugs (for prerender script). */
export const getBlogSlugs = () => BLOG_POSTS.map((p) => p.slug);

/** Find a post by slug. */
export const getPostBySlug = (slug: string) =>
  BLOG_POSTS.find((p) => p.slug === slug);

/**
 * Cache of lazy-loaded post components. lazy() must be called at module
 * scope (not during render) to maintain stable component identity.
 */
const lazyCache = new Map<string, LazyExoticComponent<ComponentType>>();

/** Get a lazy-loaded post component (cached). */
export const lazyPost = (slug: string) => {
  const cached = lazyCache.get(slug);
  if (cached) return cached;

  const post = getPostBySlug(slug);
  if (!post) return null;

  const component = lazy(post.component);
  lazyCache.set(slug, component);
  return component;
};
