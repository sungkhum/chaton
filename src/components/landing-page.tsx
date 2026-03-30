import { useLayoutEffect, useRef } from "react";
import { identity } from "deso-protocol";
import { AnimatedEmoji } from "./messages/animated-emoji";
import {
  ArrowRight,
  ChevronRight,
  Check,
  Eye,
  Lock,
  ShieldCheck,
  Code,
  Ban,
  UserCheck,
  Globe,
  Heart,
  Users,
  Send,
  Smile,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/*
 * ChatOn logo palette (green→teal→blue):
 *   #34F080  Green
 *   #20E0AA  Teal
 *   #40B8E0  Steel blue
 *   #3090D0  Deep blue
 */

export const LandingPage = () => {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // ── Hero entrance timeline ──
        const hero = gsap.timeline({
          defaults: { ease: "power3.out", duration: 0.8 },
        });

        hero
          .from(".hero-badge", { x: -30, autoAlpha: 0 })
          .from(".hero-title", { y: 40, autoAlpha: 0, duration: 1 }, "<0.15")
          .from(".hero-desc", { x: -20, autoAlpha: 0 }, "<0.2")
          .from(".hero-cta > *", { y: 24, autoAlpha: 0, stagger: 0.12 }, "<0.15")
          .from(
            ".hero-mockup",
            { x: 60, autoAlpha: 0, rotateY: -8, duration: 1.2, ease: "power2.out" },
            "<0.1"
          );

        // ── Floating mockup subtle bob ──
        gsap.to(".hero-mockup", {
          y: -12,
          duration: 3,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });

        // ── Dividers animate width on scroll ──
        gsap.utils.toArray<HTMLElement>(".landing-divider").forEach((div) => {
          gsap.fromTo(div,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 1,
              ease: "power2.inOut",
              scrollTrigger: {
                trigger: div,
                start: "top 95%",
                toggleActions: "play none none none",
              },
            }
          );
        });

        // ── Features section ──
        gsap.fromTo(".features-heading",
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ".features-heading",
              start: "top 90%",
              toggleActions: "play none none none",
            },
          }
        );

        ScrollTrigger.batch(".feature-card", {
          onEnter: (elements) =>
            gsap.fromTo(elements,
              { y: 30, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out" }
            ),
          start: "top 92%",
        });

        // ── Feature Showcase section ──
        gsap.fromTo(".showcase-heading",
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ".showcase-heading",
              start: "top 90%",
              toggleActions: "play none none none",
            },
          }
        );

        gsap.utils.toArray<HTMLElement>(".showcase-feature").forEach((el) => {
          gsap.fromTo(el.children,
            { y: 40, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
              stagger: 0.2,
              ease: "power3.out",
              scrollTrigger: {
                trigger: el,
                start: "top 85%",
                toggleActions: "play none none none",
              },
            }
          );
        });

        ScrollTrigger.batch(".showcase-mini", {
          onEnter: (elements) =>
            gsap.fromTo(elements,
              { y: 20, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }
            ),
          start: "top 92%",
        });

        // ── Technology section ──
        const techTl = gsap.timeline({
          defaults: { ease: "power3.out", duration: 0.8 },
          scrollTrigger: {
            trigger: ".tech-section",
            start: "top 80%",
            toggleActions: "play none none none",
          },
        });

        techTl
          .fromTo(".tech-heading", { y: 30, opacity: 0 }, { y: 0, opacity: 1 })
          .fromTo(".tech-subhead", { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, "<0.1")
          .fromTo(".tech-code", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, "<0.15");

        ScrollTrigger.batch(".tech-card", {
          onEnter: (elements) =>
            gsap.fromTo(elements,
              { y: 30, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.7, stagger: 0.15, ease: "power3.out" }
            ),
          start: "top 92%",
        });

        gsap.fromTo(".tech-footer",
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            scrollTrigger: {
              trigger: ".tech-footer",
              start: "top 95%",
              toggleActions: "play none none none",
            },
          }
        );

        // ── Final CTA section ──
        const ctaTl = gsap.timeline({
          defaults: { ease: "power3.out", duration: 0.9 },
          scrollTrigger: {
            trigger: ".cta-section",
            start: "top 80%",
            toggleActions: "play none none none",
          },
        });

        ctaTl
          .fromTo(".cta-heading", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1 })
          .fromTo(".cta-button", { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1 }, "<0.2")
          .fromTo(".cta-badge", { y: 20, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08 }, "<0.15");

        // ── Support section ──
        const supportTl = gsap.timeline({
          defaults: { ease: "power3.out", duration: 0.8 },
          scrollTrigger: {
            trigger: ".support-section",
            start: "top 85%",
            toggleActions: "play none none none",
          },
        });

        supportTl
          .fromTo(".support-icon", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, ease: "back.out(1.7)" })
          .fromTo(".support-heading", { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, "<0.15")
          .fromTo(".support-desc", { y: 15, opacity: 0 }, { y: 0, opacity: 1 }, "<0.1")
          .fromTo(".support-btn", { y: 15, opacity: 0 }, { y: 0, opacity: 1 }, "<0.1");

        // ── Footer ──
        gsap.fromTo(".landing-footer",
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            scrollTrigger: {
              trigger: ".landing-footer",
              start: "top 95%",
              toggleActions: "play none none none",
            },
          }
        );
      });

      // Reduced motion: just make everything visible
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          ".hero-badge, .hero-title, .hero-desc, .hero-cta > *, .hero-mockup, " +
          ".features-heading, .feature-card, " +
          ".showcase-heading, .showcase-feature > *, .showcase-mini, " +
          ".tech-heading, .tech-subhead, " +
          ".tech-code, .tech-card, .tech-footer, .cta-heading, .cta-button, " +
          ".cta-badge, .support-icon, .support-heading, .support-desc, " +
          ".support-btn, .landing-footer",
          { autoAlpha: 1, y: 0, x: 0, scale: 1 }
        );
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="min-h-screen bg-[#0F1520] text-white selection:bg-[#34F080]/30 selection:text-white relative">
      {/* Atmospheric Orbs */}
      <div className="landing-orb w-[1000px] h-[1000px] bg-[#34F080] bottom-[20%] -left-[400px] opacity-[0.08]" />
      <div className="landing-orb w-[800px] h-[800px] bg-[#20E0AA] top-[40%] left-[15%] opacity-[0.05]" />
      <div className="landing-orb w-[1100px] h-[1100px] bg-[#40B8E0] top-[5%] left-[20%] opacity-[0.06]" />
      <div className="landing-orb w-[900px] h-[900px] bg-[#3090D0] -top-[200px] -right-[200px] opacity-[0.08]" />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#0F1520]/90 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/ChatOn-Logo-Small.png"
              alt="ChatOn"
              className="w-10 h-10 rounded-xl"
            />
            <span className="text-2xl font-black tracking-tighter">ChatOn</span>
          </div>
          <div className="hidden md:flex items-center gap-12 text-xs font-bold tracking-[0.2em] uppercase text-gray-400">
            <a href="#features" className="hover:text-[#34F080] transition-colors">Features</a>
            <a href="#technology" className="hover:text-[#34F080] transition-colors">Technology</a>
          </div>
          <button
            onClick={() => identity.login()}
            className="px-8 py-2.5 landing-btn-vivid text-white text-xs font-black rounded-full transition-all cursor-pointer"
          >
            LAUNCH APP
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-4 md:pt-32 md:pb-28 px-4 md:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-20 items-center">
          <div className="lg:col-span-7 text-left">
            <div className="hero-badge inline-flex items-center gap-3 px-4 md:px-6 py-2 rounded-full bg-[#34F080]/8 border border-[#34F080]/20 text-[#34F080] text-[10px] font-black tracking-[0.3em] uppercase mb-6 md:mb-10">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34F080] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34F080]" />
              </span>
              Built on DeSo Blockchain
            </div>
            <h1 className="hero-title text-[2.75rem] md:text-8xl lg:text-[100px] font-black leading-[0.95] tracking-tight landing-text-logo-gradient mb-6 md:mb-12">
              Messaging that no one can shut down.
            </h1>
            <p className="hero-desc text-base md:text-2xl text-gray-400 leading-relaxed max-w-2xl font-medium border-l-4 border-[#34F080]/25 pl-5 md:pl-8 mb-8 md:mb-14">
              ChatOn is end-to-end encrypted messaging on the DeSo
              blockchain. Your message content is unreadable to everyone
              except you and your recipients.{" "}
              <span className="text-white">Built to scale. Impossible to censor.</span>
            </p>
            <div className="hero-cta flex flex-col sm:flex-row gap-4 md:gap-8">
              <button
                onClick={() => identity.login()}
                className="px-8 py-4 md:px-12 md:py-6 landing-btn-vivid text-white font-black rounded-2xl flex items-center justify-center gap-3 md:gap-4 text-lg md:text-xl group cursor-pointer"
              >
                Start Messaging for Free
                <ArrowRight className="w-7 h-7 group-hover:translate-x-2 transition-transform" />
              </button>
              <a
                href="#technology"
                className="flex items-center justify-center gap-3 px-8 text-gray-400 hover:text-[#34F080] font-bold text-lg transition-all group"
              >
                See how it works
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>

          <div className="hero-mockup lg:col-span-5 -mt-2 lg:mt-0 landing-mockup-wrap">
            <div className="landing-mockup-inner relative">
              <div className="landing-glass-card rounded-3xl lg:rounded-[60px] p-5 lg:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] lg:shadow-[0_40px_100px_rgba(0,0,0,0.7),0_0_60px_rgba(43,184,154,0.06)] border-white/5 bg-[#0F1520]/80">
                <div className="flex items-center gap-3 lg:gap-5 mb-5 lg:mb-12">
                  <img
                    src="/ChatOn-Logo-Small.png"
                    alt=""
                    className="w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl"
                  />
                  <div className="text-left">
                    <div className="text-base lg:text-xl font-black">Satoshi_N</div>
                    <div className="text-[9px] lg:text-[10px] text-[#34F080] uppercase font-black tracking-widest">
                      Encrypted
                    </div>
                  </div>
                </div>

                <div className="space-y-3 lg:space-y-6">
                  <div className="relative bg-[#34F080]/8 border border-[#34F080]/20 p-4 lg:p-6 rounded-2xl lg:rounded-[30px] rounded-tr-none ml-4 lg:ml-8">
                    <p className="text-xs lg:text-sm font-semibold text-[#34F080] text-left">
                      Messages stored on-chain, encrypted with your private key. Only we can read them.
                    </p>
                    <span className="absolute -bottom-3 right-4 bg-[#1a2233] border border-white/10 rounded-full px-2 py-0.5 text-xs">
                      🔒
                    </span>
                  </div>
                  <div className="relative bg-white/5 border border-white/10 p-4 lg:p-6 rounded-2xl lg:rounded-[30px] rounded-tl-none mr-4 lg:mr-8">
                    <p className="text-xs lg:text-sm font-semibold text-gray-300 text-left">
                      The blockchain knows we talked. But only we know what we said.
                    </p>
                    <span className="absolute -bottom-3 left-4 bg-[#1a2233] border border-white/10 rounded-full px-2 py-0.5 text-xs">
                      🤝
                    </span>
                  </div>
                  <div className="relative bg-[#40B8E0]/10 border border-[#40B8E0]/20 p-4 lg:p-6 rounded-2xl lg:rounded-[30px] rounded-tr-none ml-4 lg:ml-8">
                    <p className="text-xs lg:text-sm font-semibold text-[#40B8E0] text-left">
                      Exactly how messaging should work.
                    </p>
                    <span className="absolute -bottom-3 right-4 bg-[#1a2233] border border-white/10 rounded-full px-2 py-0.5 text-xs">
                      🔥
                    </span>
                  </div>
                </div>
              </div>
              <div className="hidden lg:block absolute -top-6 -right-6 px-6 py-3 bg-gradient-to-r from-[#34F080] to-[#40B8E0] text-black text-[10px] font-black rounded-xl rotate-6 shadow-2xl z-20">
                ON-CHAIN VERIFIED
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="landing-divider mx-auto max-w-5xl" />

      {/* Problems Section */}
      <section id="features" className="py-12 md:py-28 px-4 md:px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="features-heading text-center mb-10 md:mb-24">
            <h2 className="text-3xl md:text-7xl font-black tracking-tight mb-5 md:mb-8 max-w-4xl mx-auto leading-tight">
              No single company should{" "}
              <span className="text-[#40B8E0]">control your conversations.</span>
            </h2>
            <p className="text-base md:text-xl text-gray-400 max-w-3xl mx-auto font-medium leading-relaxed">
              Traditional messengers keep your data on servers owned and
              operated by one company. One breach, one policy change, one
              outage — and your conversations are gone. ChatOn encrypts your
              messages and stores them across a decentralized network of DeSo
              nodes that no single entity controls.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="feature-card landing-glass-card p-7 md:p-12 rounded-3xl md:rounded-[48px] group">
              <h3 className="text-2xl font-black mb-6 text-white group-hover:text-[#34F080] transition-colors text-left">
                Content Stays Private
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed text-left">
                Messages are encrypted in your browser before touching the
                blockchain. The network can see that you sent a message — but
                never what you said.
              </p>
            </div>
            <div className="feature-card landing-glass-card p-7 md:p-12 rounded-3xl md:rounded-[48px] group">
              <h3 className="text-2xl font-black mb-6 text-white group-hover:text-[#20E0AA] transition-colors text-left">
                No Single Point of Failure
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed text-left">
                Messages live across thousands of independent nodes. No single
                outage, company, or government can take the network offline.
              </p>
            </div>
            <div className="feature-card landing-glass-card p-7 md:p-12 rounded-3xl md:rounded-[48px] group">
              <h3 className="text-2xl font-black mb-6 text-white group-hover:text-[#40B8E0] transition-colors text-left">
                Censorship Resistant
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed text-left">
                Your account is a cryptographic key pair you control. No
                platform can suspend, delete, or lock you out.
              </p>
            </div>
            <div className="feature-card landing-glass-card p-7 md:p-12 rounded-3xl md:rounded-[48px] group">
              <h3 className="text-2xl font-black mb-6 text-white group-hover:text-[#3090D0] transition-colors text-left">
                Full Portability
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed text-left">
                Your identity and contacts work across every DeSo app. No
                platform lock-in, ever.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="landing-divider mx-auto max-w-5xl" />

      {/* Feature Showcase */}
      <section className="showcase-section py-12 md:py-28 px-4 md:px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="showcase-heading text-center mb-12 md:mb-24">
            <h2 className="text-3xl md:text-7xl font-black tracking-tight mb-5 md:mb-8 max-w-5xl mx-auto leading-tight">
              A full-featured messenger.{" "}
              <span className="landing-text-logo-gradient">On the blockchain.</span>
            </h2>
            <p className="text-base md:text-xl text-gray-400 max-w-3xl mx-auto font-medium leading-relaxed">
              Group chats, reactions, GIFs, replies, typing indicators, and spam
              filtering — everything you expect from a modern messenger, built on
              infrastructure you actually own.
            </p>
          </div>

          {/* Feature 1: Group Chats */}
          <div className="showcase-feature grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center mb-16 md:mb-32">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.3em] uppercase text-[#34F080] mb-4 md:mb-6">
                <Users className="w-4 h-4" />
                Group Chats
              </div>
              <h3 className="text-2xl md:text-5xl font-black tracking-tight mb-4 md:mb-6 leading-tight">
                Group chats that live on-chain.
              </h3>
              <p className="text-base md:text-lg text-gray-400 font-medium leading-relaxed">
                Create encrypted group conversations with custom names and profile
                images. Add or remove members anytime. Every group is a portable
                on-chain access group that works across the entire DeSo ecosystem.
              </p>
            </div>
            <div className="landing-mockup-wrap">
              <div className="landing-mockup-inner">
              <div className="landing-glass-card rounded-3xl p-5 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#34F080] to-[#40B8E0] flex items-center justify-center text-sm font-black text-black shrink-0">
                    DT
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-sm font-black">Design Team</div>
                    <div className="text-[10px] text-gray-500">Alex, Maya, Jordan</div>
                  </div>
                  <div className="flex -space-x-2 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#34F080]/40 to-[#34F080]/10 border-2 border-[#141c28]" />
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#40B8E0]/40 to-[#40B8E0]/10 border-2 border-[#141c28]" />
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#3090D0]/40 to-[#3090D0]/10 border-2 border-[#141c28]" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2 items-end">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#34F080]/30 to-[#34F080]/10 shrink-0" />
                    <div className="bg-white/5 border border-white/8 px-3 py-2 rounded-2xl rounded-bl-sm max-w-[80%]">
                      <div className="text-[10px] text-[#34F080] font-bold mb-0.5">Alex</div>
                      <div className="text-xs text-gray-300">Just pushed the new brand assets to the repo</div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#40B8E0]/30 to-[#40B8E0]/10 shrink-0" />
                    <div className="bg-white/5 border border-white/8 px-3 py-2 rounded-2xl rounded-bl-sm max-w-[80%]">
                      <div className="text-[10px] text-[#40B8E0] font-bold mb-0.5">Maya</div>
                      <div className="text-xs text-gray-300">Love them! The new palette is perfect</div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-[#34F080]/10 border border-[#34F080]/20 px-3 py-2 rounded-2xl rounded-br-sm max-w-[80%]">
                      <div className="text-xs text-[#34F080]/90">Shipping the update tonight 🚀</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 bg-white/3 border border-white/5 rounded-full px-4 py-2.5">
                  <span className="text-[11px] text-gray-600 flex-1">Type a message...</span>
                  <Send className="w-3.5 h-3.5 text-gray-600" />
                </div>
              </div>
              </div>
            </div>
          </div>

          {/* Feature 2: Reactions & Media */}
          <div className="showcase-feature grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center mb-16 md:mb-32">
            <div className="order-2 lg:order-1 landing-mockup-wrap">
              <div className="landing-mockup-inner face-right">
              <div className="landing-glass-card rounded-3xl p-5 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <div className="space-y-4">
                  {/* Message with reactions */}
                  <div className="flex gap-2 items-end">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#20E0AA]/30 to-[#20E0AA]/10 shrink-0" />
                    <div>
                      <div className="bg-white/5 border border-white/8 px-3 py-2 rounded-2xl rounded-bl-sm">
                        <div className="text-xs text-gray-300">The new landing page looks incredible!</div>
                      </div>
                      <div className="flex gap-1.5 mt-1.5 ml-1">
                        <div className="flex items-center gap-1 bg-[#34F080]/10 border border-[#34F080]/20 rounded-full px-2 py-0.5">
                          <AnimatedEmoji emoji="👍" size={14} />
                          <span className="text-[9px] font-bold text-[#34F080]">2</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                          <AnimatedEmoji emoji="❤️" size={14} />
                          <span className="text-[9px] font-bold text-gray-400">3</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                          <AnimatedEmoji emoji="🔥" size={14} />
                          <span className="text-[9px] font-bold text-gray-400">1</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Big emoji message — sent by you */}
                  <div className="flex items-end justify-end gap-2 pr-1">
                    <AnimatedEmoji emoji="🎉" size={56} />
                    <AnimatedEmoji emoji="🙌" size={56} />
                  </div>
                  {/* Reply preview + message */}
                  <div className="flex gap-2 items-end">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#20E0AA]/30 to-[#20E0AA]/10 shrink-0" />
                    <div className="bg-white/5 border border-white/8 rounded-2xl rounded-bl-sm overflow-hidden max-w-[85%]">
                      <div className="bg-white/3 border-l-2 border-[#20E0AA] px-3 py-1.5 mx-2 mt-2 rounded-r-lg">
                        <div className="text-[9px] text-[#20E0AA] font-bold">You</div>
                        <div className="text-[10px] text-gray-500 truncate">Shipping the update tonight 🚀</div>
                      </div>
                      <div className="px-3 py-2">
                        <div className="text-xs text-gray-300">Can't wait to see it live!</div>
                      </div>
                    </div>
                  </div>
                  {/* GIF message from sender */}
                  <div className="flex gap-2 items-end">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#20E0AA]/30 to-[#20E0AA]/10 shrink-0" />
                    <div>
                      <div className="rounded-2xl rounded-bl-sm overflow-hidden border border-white/8 max-w-[180px]">
                        <img
                          src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGljcTF5b2RtZXJmcWFxbjFtcmk2c2RkNWU1b3hsdWxhNTlzZHp6aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7abKhOpu0NwenH3O/giphy.webp"
                          alt="Thumbs up GIF"
                          className="w-[180px] h-auto block"
                          loading="lazy"
                        />
                      </div>
                      <div className="text-[10px] text-blue-300/40 mt-1 px-1">via GIPHY</div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.3em] uppercase text-[#20E0AA] mb-4 md:mb-6">
                <Smile className="w-4 h-4" />
                Reactions & Media
              </div>
              <h3 className="text-2xl md:text-5xl font-black tracking-tight mb-4 md:mb-6 leading-tight">
                React, reply, and share anything.
              </h3>
              <p className="text-base md:text-lg text-gray-400 font-medium leading-relaxed">
                Tap to react with any emoji — they aggregate into tappable pills
                below each message. Quote-reply for threaded context. Share GIFs,
                images, videos, and files — all stored on-chain alongside your
                encrypted conversations.
              </p>
            </div>
          </div>

          {/* Feature 3: Smart Inbox */}
          <div className="showcase-feature grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.3em] uppercase text-[#40B8E0] mb-4 md:mb-6">
                <ShieldCheck className="w-4 h-4" />
                Smart Inbox
              </div>
              <h3 className="text-2xl md:text-5xl font-black tracking-tight mb-4 md:mb-6 leading-tight">
                Your inbox. Your rules.
              </h3>
              <p className="text-base md:text-lg text-gray-400 font-medium leading-relaxed">
                Messages from people you don't follow land in Requests — not your
                main inbox. Accept to start chatting, block to dismiss.
                Classification uses on-chain follows and associations. No backend,
                no middleman.
              </p>
            </div>
            <div className="landing-mockup-wrap">
              <div className="landing-mockup-inner">
              <div className="landing-glass-card rounded-3xl p-5 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <div className="flex gap-1 mb-5 bg-white/3 rounded-xl p-1">
                  <div className="flex-1 text-center py-2 text-[11px] font-black text-gray-500 rounded-lg">
                    Chats
                  </div>
                  <div className="flex-1 text-center py-2 text-[11px] font-black bg-[#40B8E0]/10 text-[#40B8E0] rounded-lg border border-[#40B8E0]/15">
                    Requests{" "}
                    <span className="bg-[#40B8E0] text-black text-[9px] px-1.5 py-0.5 rounded-full ml-0.5">
                      2
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/3 border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3090D0]/30 to-[#3090D0]/10 shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <div className="text-xs font-bold text-gray-300">CryptoFan_42</div>
                        <div className="text-[10px] text-gray-600 truncate">
                          Hey, have you seen the latest DeSo upd...
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 text-center text-[10px] font-black py-1.5 rounded-lg bg-[#34F080]/10 text-[#34F080] border border-[#34F080]/20">
                        Accept
                      </div>
                      <div className="flex-1 text-center text-[10px] font-black py-1.5 rounded-lg bg-white/5 text-gray-500 border border-white/10">
                        Block
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/3 border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <div className="text-xs font-bold text-gray-300">NewUser_2024</div>
                        <div className="text-[10px] text-gray-600 truncate">
                          Hello! I'm new to DeSo and wanted to...
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 text-center text-[10px] font-black py-1.5 rounded-lg bg-[#34F080]/10 text-[#34F080] border border-[#34F080]/20">
                        Accept
                      </div>
                      <div className="flex-1 text-center text-[10px] font-black py-1.5 rounded-lg bg-white/5 text-gray-500 border border-white/10">
                        Block
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 text-center">
                  <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                    Automatic classification · no backend required
                  </span>
                </div>
              </div>
              </div>
            </div>
          </div>

          {/* Mini Features Grid */}
          <div className="mt-16 md:mt-28">
            <div className="showcase-heading text-center mb-8 md:mb-12">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                Plus everything else you'd expect
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[
                { color: "#34F080", title: "Edit & Delete", desc: "Fix typos or remove messages after sending" },
                { color: "#20E0AA", title: "Typing Indicators", desc: "See when someone is composing a reply" },
                { color: "#40B8E0", title: "Push Notifications", desc: "Real-time alerts via WebSocket relay" },
                { color: "#3090D0", title: "Mute Conversations", desc: "Silence noisy chats without leaving" },
                { color: "#34F080", title: "Send $DESO", desc: "Tip friends with crypto in any chat" },
                { color: "#20E0AA", title: "Multi-Account", desc: "Switch between DeSo identities instantly" },
                { color: "#40B8E0", title: "Message Status", desc: "Sending, sent, and confirmed indicators" },
                { color: "#3090D0", title: "Leave & Archive", desc: "Leave groups and rejoin anytime from Archived" },
              ].map((f) => (
                <div key={f.title} className="showcase-mini landing-glass-card p-4 md:p-5 rounded-2xl text-left">
                  <div className="w-2 h-2 rounded-full mb-3" style={{ background: f.color }} />
                  <div className="text-sm font-bold text-white mb-1">{f.title}</div>
                  <div className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="landing-divider mx-auto max-w-5xl" />

      {/* Technology Section */}
      <section id="technology" className="tech-section py-12 md:py-28 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-24 items-start mb-10 md:mb-24">
            <div className="text-left">
              <h2 className="tech-heading text-4xl md:text-8xl font-black tracking-tight mb-5 md:mb-10 leading-[1.05]">
                Math is the{" "}
                <span className="landing-text-logo-gradient">new trust.</span>
              </h2>
              <p className="tech-subhead text-base md:text-xl text-gray-400 font-medium mb-6 md:mb-12 leading-relaxed">
                Don't trust us. Verify it.
              </p>
              <div className="tech-code landing-glass-card p-[1px] rounded-3xl landing-code-border">
                <div className="bg-[#0F1520] rounded-[22px] p-8 md:p-10 font-mono text-[13px] leading-relaxed overflow-x-auto relative">
                  <div className="flex gap-2 mb-8">
                    <div className="w-3 h-3 rounded-full bg-red-500/30" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/30" />
                    <div className="w-3 h-3 rounded-full bg-green-500/30" />
                  </div>
                  <div className="space-y-1 whitespace-nowrap">
                    <p>
                      <span className="text-[#20E0AA]">async function</span>{" "}
                      <span className="text-[#40B8E0]">encryptMessage</span>
                      (content: <span className="text-[#34F080]">string</span>, recipientKey:{" "}
                      <span className="text-[#34F080]">string</span>) {"{"}
                    </p>
                    <p>&nbsp;&nbsp;<span className="text-gray-600">// AES-128-CTR + ECDH key exchange — runs in your browser</span></p>
                    <p>
                      &nbsp;&nbsp;<span className="text-[#20E0AA]">const</span> shared ={" "}
                      <span className="text-[#40B8E0]">deriveSharedSecret</span>(myKey, recipientKey);
                    </p>
                    <p>
                      &nbsp;&nbsp;<span className="text-[#20E0AA]">const</span> encrypted ={" "}
                      <span className="text-[#40B8E0]">aes128ctr</span>(content, shared);
                    </p>
                    <p>&nbsp;</p>
                    <p>&nbsp;&nbsp;<span className="text-gray-600">// Only ciphertext reaches the blockchain</span></p>
                    <p>
                      &nbsp;&nbsp;<span className="text-[#20E0AA]">await</span> deso.
                      <span className="text-[#34F080]">sendDMMessage</span>(encrypted);
                    </p>
                    <p>&nbsp;</p>
                    <p>&nbsp;&nbsp;<span className="text-gray-600">// Anyone can see this transaction happened.</span></p>
                    <p>&nbsp;&nbsp;<span className="text-gray-600">// No one can read what it says.</span></p>
                    <p>{"}"}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 lg:pt-20">
              <div className="tech-card landing-glass-card p-6 md:p-10 rounded-2xl md:rounded-[40px] border-[#34F080]/10 text-left">
                <h4 className="text-xl font-black mb-8 flex items-center gap-3">
                  <Eye className="w-5 h-5 text-[#34F080]" />
                  Visible on-chain
                </h4>
                <ul className="space-y-4 text-sm font-bold text-gray-400">
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#34F080] mt-0.5 shrink-0" />
                    Sender and recipient account IDs
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#34F080] mt-0.5 shrink-0" />
                    Timestamp of the message
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#34F080] mt-0.5 shrink-0" />
                    That a message was sent
                  </li>
                </ul>
                <div className="mt-10 pt-6 border-t border-white/5 text-[10px] text-gray-500 italic">
                  Like a postal service: the addresses on the envelope are visible.
                </div>
              </div>
              <div className="tech-card landing-glass-card p-6 md:p-10 rounded-2xl md:rounded-[40px] border-[#3090D0]/10 text-left">
                <h4 className="text-xl font-black mb-8 flex items-center gap-3">
                  <Lock className="w-5 h-5 text-[#3090D0]" />
                  Encrypted &amp; private
                </h4>
                <ul className="space-y-4 text-sm font-bold text-gray-400">
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#3090D0] mt-0.5 shrink-0" />
                    Your actual message content
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#3090D0] mt-0.5 shrink-0" />
                    Images, files, and media
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#3090D0] mt-0.5 shrink-0" />
                    Group encryption keys
                  </li>
                </ul>
                <div className="mt-10 pt-6 border-t border-white/5 text-[10px] text-gray-500 italic">
                  The letter inside is sealed. Only sender and recipient hold the keys.
                </div>
              </div>
            </div>
          </div>
          <div className="tech-footer max-w-4xl mx-auto text-center">
            <p className="text-gray-500 font-medium leading-relaxed italic">
              DeSo is a public blockchain — anyone can run a node and verify that
              message content is stored as ciphertext, and that no one (including
              ChatOn) can decrypt it without your private key. This is how we
              prove our privacy claims instead of just asking you to believe them.
            </p>
          </div>
        </div>
      </section>

      <div className="landing-divider mx-auto max-w-5xl" />

      {/* Final CTA */}
      <section className="cta-section py-16 md:py-32 px-4 md:px-6 relative">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="cta-heading text-4xl md:text-7xl lg:text-8xl font-black leading-[1.15] tracking-tighter landing-text-logo-gradient mb-8 md:mb-16 py-2">
            Messaging should be yours.
          </h2>
          <div className="flex flex-col items-center gap-8 md:gap-12">
            <button
              onClick={() => identity.login()}
              className="cta-button inline-flex items-center gap-4 md:gap-6 px-8 py-5 md:px-12 md:py-8 landing-btn-vivid text-white text-lg md:text-2xl font-black rounded-2xl md:rounded-[32px] group transition-all shadow-[0_0_80px_rgba(43,184,154,0.3)] cursor-pointer"
            >
              Start Messaging for Free
              <ArrowRight className="w-7 h-7 group-hover:translate-x-3 transition-transform" />
            </button>
            <div className="flex flex-wrap justify-center gap-6 md:gap-14">
              <div className="cta-badge flex flex-col items-center gap-2 md:gap-3">
                <ShieldCheck className="w-7 h-7 text-[#34F080]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">E2E Encrypted</span>
              </div>
              <div className="cta-badge flex flex-col items-center gap-3">
                <Code className="w-7 h-7 text-[#20E0AA]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Open Source</span>
              </div>
              <div className="cta-badge flex flex-col items-center gap-3">
                <Ban className="w-7 h-7 text-[#40B8E0]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Zero Ads</span>
              </div>
              <div className="cta-badge flex flex-col items-center gap-3">
                <UserCheck className="w-7 h-7 text-[#3090D0]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">No Lock-in</span>
              </div>
              <div className="cta-badge flex flex-col items-center gap-3">
                <Globe className="w-7 h-7 text-[#34F080]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Global Network</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="support-section py-12 md:py-20 px-4 md:px-6 relative">
        <div className="max-w-xl mx-auto text-center">
          <div className="support-icon w-14 h-14 mx-auto mb-6 rounded-full bg-[#34F080]/8 border border-[#34F080]/15 flex items-center justify-center">
            <Heart className="w-6 h-6 text-[#34F080]" />
          </div>
          <h3 className="support-heading text-2xl md:text-3xl font-black text-white mb-3">
            Enjoying ChatOn?
          </h3>
          <p className="support-desc text-sm md:text-base text-gray-500 font-medium leading-relaxed mb-6">
            ChatOn is free, open-source, and runs at zero infrastructure cost.
            If you believe in decentralized messaging, a small $DESO tip helps
            fund ongoing development.
          </p>
          <a
            href="/support"
            className="support-btn inline-flex items-center gap-2.5 px-6 py-3 bg-white/5 border border-white/10 text-gray-300 hover:text-[#34F080] hover:border-[#34F080]/40 font-semibold rounded-xl transition-all cursor-pointer text-sm"
          >
            <Heart className="w-4 h-4" />
            Support ChatOn with $DESO
          </a>
        </div>
      </section>

      <div className="landing-divider mx-auto max-w-5xl" />

      {/* Footer */}
      <footer className="landing-footer py-12 md:py-24 border-t border-white/5 bg-[#0F1520]">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-8 md:gap-16">
            <div className="flex items-center gap-5">
              <img
                src="/ChatOn-Logo-Small.png"
                alt="ChatOn"
                className="w-12 h-12 rounded-2xl"
              />
              <span className="font-black tracking-tighter text-4xl">ChatOn</span>
            </div>
            <div className="flex flex-wrap justify-center gap-10 md:gap-16 text-xs font-black uppercase tracking-[0.4em] text-gray-500">
              <a
                href="https://github.com/sungkhum/chaton"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#34F080] transition-colors"
              >
                GitHub
              </a>
              <a href="/support" className="hover:text-[#34F080] transition-colors">Support</a>
              <a href="/privacy" className="hover:text-[#34F080] transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-[#34F080] transition-colors">Terms</a>
            </div>
          </div>
          <div className="mt-12 md:mt-32 text-center">
            <p className="text-[10px] text-gray-600 font-bold tracking-[0.4em] uppercase leading-loose">
              &copy; {new Date().getFullYear()} CHATON. END-TO-END ENCRYPTED MESSAGING ON DESO BLOCKCHAIN.
            </p>
            <p className="text-[10px] text-gray-600 font-bold tracking-[0.3em] uppercase mt-3">
              Built by{" "}
              <a
                href="https://focus.xyz/nathanwells"
                target="_blank"
                rel="noreferrer"
                className="text-gray-500 hover:text-[#34F080] transition-colors"
              >
                @nathanwells
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
