import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePageMeta } from "../../hooks/usePageMeta";
import { PublicNav, PublicFooter } from "../public-layout";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import gsap from "gsap";

interface BlogPostLayoutProps {
  title: string;
  description: string;
  date: string;
  readTime: string;
  tags: string[];
  slug: string;
  children: ReactNode;
}

export const BlogPostLayout = ({
  title,
  description,
  date,
  readTime,
  tags,
  slug,
  children,
}: BlogPostLayoutProps) => {
  usePageMeta({
    title: `${title} — ChatOn Blog`,
    description,
    path: `/blog/${slug}`,
    ogImage: `/og/blog/${slug}.png`,
  });

  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power3.out", duration: 0.8 } })
          .fromTo(
            ".bp-back",
            { x: -20, autoAlpha: 0 },
            { x: 0, autoAlpha: 1, duration: 0.5 }
          )
          .fromTo(
            ".bp-title",
            { y: 30, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 1 },
            "<0.1"
          )
          .fromTo(
            ".bp-meta",
            { y: 15, autoAlpha: 0 },
            { y: 0, autoAlpha: 1 },
            "<0.15"
          )
          .fromTo(
            ".bp-body",
            { y: 20, autoAlpha: 0 },
            { y: 0, autoAlpha: 1 },
            "<0.2"
          );
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".bp-back, .bp-title, .bp-meta, .bp-body", {
          autoAlpha: 1,
          y: 0,
          x: 0,
        });
      });
    }, root);

    return () => ctx.revert();
  }, []);

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <div
      ref={root}
      className="min-h-screen bg-[#0F1520] text-white selection:bg-[#34F080]/30 selection:text-white relative overflow-hidden"
    >
      {/* Article structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: title,
            description,
            datePublished: date,
            author: {
              "@type": "Organization",
              name: "ChatOn",
              url: "https://getchaton.com",
            },
            publisher: {
              "@type": "Organization",
              name: "ChatOn",
              logo: {
                "@type": "ImageObject",
                url: "https://getchaton.com/ChatOn-Logo-Small.png",
              },
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `https://getchaton.com/blog/${slug}`,
            },
          }),
        }}
      />

      {/* Atmospheric orbs */}
      <div className="landing-orb w-[800px] h-[800px] bg-[#34F080] -top-[200px] -left-[300px] opacity-[0.06]" />
      <div className="landing-orb w-[600px] h-[600px] bg-[#20E0AA] top-[30%] right-[-200px] opacity-[0.05]" />

      <PublicNav />

      <main className="relative pt-28 md:pt-36 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <a
            href="/blog"
            className="bp-back inline-flex items-center gap-2 text-xs text-gray-500 hover:text-[#34F080] transition-colors mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All posts
          </a>

          {/* Header */}
          <h1 className="bp-title text-3xl md:text-5xl font-black leading-[1.05] tracking-tight mb-5">
            {title}
          </h1>

          <div className="bp-meta flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-10 pb-8 border-b border-white/5">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {readTime}
            </span>
            <div className="flex gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full bg-white/5 text-gray-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Article body */}
          <article className="bp-body prose-chaton">{children}</article>

          {/* Post footer */}
          <div className="mt-16 pt-8 border-t border-white/5 text-center">
            <p className="text-sm text-gray-500 mb-4">
              Ready to try decentralized messaging?
            </p>
            <a
              href="/"
              className="inline-block px-8 py-3.5 rounded-xl landing-btn-vivid text-white text-sm font-bold"
            >
              Start Messaging
            </a>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};
