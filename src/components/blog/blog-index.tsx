import { useLayoutEffect, useRef } from "react";
import { usePageMeta } from "../../hooks/usePageMeta";
import { PublicNav, PublicFooter } from "../public-layout";
import { BookOpen, Calendar, Clock, ArrowRight } from "lucide-react";
import { BLOG_POSTS } from "./blog-registry";
import gsap from "gsap";

export const BlogIndex = () => {
  usePageMeta({
    title: "Blog — ChatOn",
    description:
      "Thoughts on decentralized messaging, encryption, and building on the DeSo blockchain. From the team behind ChatOn.",
    path: "/blog",
  });

  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ defaults: { ease: "power3.out", duration: 0.8 } })
          .from(".blog-badge", { y: -20, autoAlpha: 0, duration: 0.6 })
          .from(".blog-title", { y: 40, autoAlpha: 0, duration: 1 }, "<0.1")
          .from(".blog-subtitle", { y: 20, autoAlpha: 0 }, "<0.15")
          .from(
            ".blog-card",
            {
              y: 25,
              autoAlpha: 0,
              stagger: 0.08,
              duration: 0.6,
            },
            "<0.2"
          );
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".blog-badge, .blog-title, .blog-subtitle, .blog-card", {
          autoAlpha: 1,
          y: 0,
        });
      });
    }, root);

    return () => ctx.revert();
  }, []);

  const sortedPosts = [...BLOG_POSTS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div
      ref={root}
      className="min-h-screen bg-[#0F1520] text-white selection:bg-[#34F080]/30 selection:text-white relative overflow-hidden"
    >
      {/* Atmospheric orbs */}
      <div className="landing-orb w-[800px] h-[800px] bg-[#34F080] -top-[200px] -left-[300px] opacity-[0.06]" />
      <div className="landing-orb w-[600px] h-[600px] bg-[#20E0AA] top-[40%] right-[-200px] opacity-[0.05]" />

      <PublicNav />

      <main className="relative pt-28 md:pt-36 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 md:mb-16">
            <div className="blog-badge inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#34F080]/8 border border-[#34F080]/20 text-[#34F080] text-[10px] font-black tracking-[0.3em] uppercase mb-6">
              <BookOpen className="w-3.5 h-3.5" />
              Blog
            </div>

            <h1 className="blog-title text-4xl md:text-7xl font-black leading-[0.95] tracking-tight mb-6 md:mb-8">
              From the{" "}
              <span className="landing-text-logo-gradient">builders.</span>
            </h1>

            <p className="blog-subtitle text-base md:text-xl text-gray-400 font-medium leading-relaxed max-w-2xl mx-auto">
              Thoughts on decentralized messaging, encryption, and building on
              the DeSo blockchain.
            </p>
          </div>

          {/* Post list */}
          <div className="space-y-4">
            {sortedPosts.map((post) => {
              const formattedDate = new Date(
                post.date + "T00:00:00"
              ).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });

              return (
                <a
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="blog-card block landing-glass-card rounded-2xl p-6 md:p-8 border-white/5 hover:border-[#34F080]/20 transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg md:text-xl font-bold text-white group-hover:text-[#34F080] transition-colors mb-2">
                        {post.title}
                      </h2>
                      <p className="text-sm text-gray-500 leading-relaxed mb-4 line-clamp-2">
                        {post.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {formattedDate}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {post.readTime}
                        </span>
                        <div className="flex gap-1.5">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full bg-white/5 text-gray-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-[#34F080] group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default BlogIndex;
