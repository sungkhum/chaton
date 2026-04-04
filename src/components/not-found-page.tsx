import { useLayoutEffect, useRef } from "react";
import { Home, BookOpen, Lock } from "lucide-react";
import gsap from "gsap";
import { PublicNav, PublicFooter } from "./public-layout";
import { usePageMeta } from "../hooks/usePageMeta";

export default function NotFoundPage() {
  const root = useRef<HTMLDivElement>(null);

  usePageMeta({
    title: "Page not found — ChatOn",
    description: "This page doesn't exist. It may have been moved or deleted.",
    path: window.location.pathname,
  });

  useLayoutEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "power3.out", duration: 0.8 },
        });

        tl.from(".nf-badge", { y: -20, autoAlpha: 0, duration: 0.6 })
          .from(
            ".nf-code",
            { y: 40, autoAlpha: 0, scale: 0.9, duration: 1 },
            "<0.1"
          )
          .from(".nf-title", { y: 30, autoAlpha: 0, duration: 0.9 }, "<0.15")
          .from(".nf-body", { y: 20, autoAlpha: 0 }, "<0.1")
          .from(".nf-cipher", { y: 20, autoAlpha: 0, duration: 0.7 }, "<0.1")
          .from(
            ".nf-cta",
            { y: 20, autoAlpha: 0, stagger: 0.08, duration: 0.6 },
            "<0.15"
          );
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          ".nf-badge, .nf-code, .nf-title, .nf-body, .nf-cipher, .nf-cta",
          { autoAlpha: 1, y: 0, scale: 1 }
        );
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={root}
      className="min-h-screen bg-[#0F1520] text-white selection:bg-[#34F080]/30 selection:text-white relative overflow-hidden"
    >
      {/* Atmospheric orbs */}
      <div className="landing-orb w-[700px] h-[700px] bg-[#34F080] -top-[250px] -left-[200px] opacity-[0.06]" />
      <div className="landing-orb w-[500px] h-[500px] bg-[#40B8E0] top-[30%] right-[-150px] opacity-[0.05]" />
      <div className="landing-orb w-[600px] h-[600px] bg-[#20E0AA] bottom-[-150px] left-[30%] opacity-[0.04]" />

      <PublicNav />

      <main className="relative pt-28 md:pt-36 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-2xl mx-auto text-center">
          {/* Badge */}
          <div className="nf-badge inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#34F080]/8 border border-[#34F080]/20 text-[#34F080] text-[10px] font-black tracking-[0.3em] uppercase mb-8">
            <Lock className="w-3.5 h-3.5" />
            PAGE NOT FOUND
          </div>

          {/* 404 display */}
          <h1 className="nf-code text-[8rem] md:text-[12rem] font-black leading-none tracking-tighter landing-text-logo-gradient mb-2">
            404
          </h1>

          {/* Messaging-themed copy */}
          <h2 className="nf-title text-2xl md:text-4xl font-black tracking-tight landing-heading-glow mb-4">
            Message not delivered
          </h2>

          <p className="nf-body text-base md:text-lg text-gray-400 font-medium leading-relaxed mb-8 max-w-md mx-auto">
            This page doesn't exist, was encrypted beyond recovery, or never
            made it to the blockchain.
          </p>

          {/* Cipher block — simulated encrypted message */}
          <div className="nf-cipher landing-glass-card rounded-2xl px-6 py-4 mb-10 max-w-sm mx-auto pointer-events-none">
            <p
              className="text-xs md:text-sm font-mono text-gray-600 leading-relaxed break-all select-none"
              aria-hidden="true"
            >
              aG9tZSBub3QgZm91b <span className="text-[#34F080]/40">mQ=</span>{" "}
              4oCcUGFnZSBub3QgZm <span className="text-[#40B8E0]/40">91</span>
              bmTigJ0gYXQgdGhpcyA
              <span className="text-[#20E0AA]/40">==</span>
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/"
              className="nf-cta landing-btn-vivid inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-bold text-[#0F1520] no-underline"
            >
              <Home className="w-4 h-4" />
              Go Home
            </a>
            <a
              href="/blog"
              className="nf-cta inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-sm font-bold text-white bg-white/8 border border-white/10 hover:bg-white/12 hover:border-white/15 transition-all duration-300 no-underline"
            >
              <BookOpen className="w-4 h-4" />
              Browse Blog
            </a>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
