import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { AnimatedEmoji } from "./messages/animated-emoji";
import {
  ArrowRight,
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
  DollarSign,
  Languages,
  AtSign,
  Coins,
  CircleDollarSign,
  PenLine,
  MessageSquareMore,
  Bell,
  BellOff,
  CheckCheck,
  UserCog,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PreSignupTutorial } from "./onboarding/pre-signup-tutorial";
import { SeoStructuredData } from "./seo-structured-data";
import { PublicNav } from "./public-layout";
import {
  EnrichedCommunityListing,
  enrichCommunityListings,
  fetchCommunityListings,
} from "../services/community.service";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { buildInviteUrl } from "../utils/invite-link";

gsap.registerPlugin(ScrollTrigger);

/*
 * ChatOn logo palette (green→teal→blue):
 *   #34F080  Green
 *   #20E0AA  Teal
 *   #40B8E0  Steel blue
 *   #3090D0  Deep blue
 */

export const LandingPage = () => {
  usePageMeta({ path: "/" });

  const root = useRef<HTMLDivElement>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [communities, setCommunities] = useState<EnrichedCommunityListing[]>(
    []
  );

  const FEATURED_GROUPS = ["AI Wire", "ChatOn Fun", "Deso Bulls"];

  useEffect(() => {
    fetchCommunityListings()
      .then((raw) => enrichCommunityListings(raw))
      .then((enriched) => {
        const featured = FEATURED_GROUPS.map((name) =>
          enriched.find((l) => l.groupKeyName === name)
        ).filter((l): l is EnrichedCommunityListing => !!l);
        setCommunities(featured);
      })
      .catch(() => {});
  }, []);

  useLayoutEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isDesktop:
            "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          isMobile:
            "(max-width: 767px) and (prefers-reduced-motion: no-preference)",
          isReduced: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { isMobile, isReduced } = context.conditions!;

          // Reduced motion: just make everything visible
          if (isReduced) {
            gsap.set(
              ".hero-badge, .hero-title, .hero-desc, .hero-cta, .hero-mockup, " +
                ".features-heading, .feature-card, " +
                ".showcase-heading, .showcase-feature > *, .showcase-mini, " +
                ".tech-heading, .tech-subhead, " +
                ".tech-code, .tech-card, .tech-footer, " +
                ".community-heading, .community-card, .community-cta, " +
                ".cta-heading, .cta-button, " +
                ".cta-badge, .support-icon, .support-heading, .support-desc, " +
                ".support-btn, .landing-footer",
              { autoAlpha: 1, y: 0, x: 0, scale: 1 }
            );
            return;
          }

          // Shorter distances + durations on mobile to avoid jerky appearance
          const d = isMobile
            ? { sm: 10, md: 16, lg: 20, dur: 0.5, stagger: 0.06 }
            : { sm: 20, md: 30, lg: 40, dur: 0.8, stagger: 0.1 };

          // Trigger earlier on mobile so animation completes before user scrolls past
          const start = isMobile ? "top 88%" : "top 92%";
          const startEarly = isMobile ? "top 82%" : "top 90%";

          // ── Hero entrance timeline ──
          const hero = gsap.timeline({
            defaults: { ease: "power3.out", duration: d.dur },
          });

          hero
            .from(".hero-badge", { x: isMobile ? -15 : -30, autoAlpha: 0 })
            .from(
              ".hero-title",
              {
                y: isMobile ? 20 : 40,
                autoAlpha: 0,
                duration: isMobile ? 0.6 : 1,
              },
              "<0.15"
            )
            .from(
              ".hero-desc",
              { x: isMobile ? -10 : -20, autoAlpha: 0 },
              "<0.2"
            )
            .from(".hero-cta", { y: isMobile ? 14 : 24, autoAlpha: 0 }, "<0.15")
            .from(
              ".hero-mockup",
              isMobile
                ? { y: 20, autoAlpha: 0, duration: 0.7, ease: "power2.out" }
                : {
                    x: 60,
                    autoAlpha: 0,
                    rotateY: -8,
                    duration: 1.2,
                    ease: "power2.out",
                  },
              "<0.1"
            );

          // ── Floating mockup subtle bob (desktop only — saves GPU on mobile) ──
          if (!isMobile) {
            gsap.to(".hero-mockup", {
              y: -12,
              duration: 3,
              ease: "sine.inOut",
              repeat: -1,
              yoyo: true,
            });
          }

          // ── Dividers animate width on scroll ──
          gsap.utils.toArray<HTMLElement>(".landing-divider").forEach((div) => {
            gsap.fromTo(
              div,
              { scaleX: 0 },
              {
                scaleX: 1,
                duration: isMobile ? 0.6 : 1,
                ease: "power2.inOut",
                scrollTrigger: {
                  trigger: div,
                  start: start,
                  toggleActions: "play none none none",
                },
              }
            );
          });

          // ── Features section ──
          gsap.fromTo(
            ".features-heading",
            { y: d.md, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: d.dur,
              ease: "power3.out",
              scrollTrigger: {
                trigger: ".features-heading",
                start: startEarly,
                toggleActions: "play none none none",
              },
            }
          );

          ScrollTrigger.batch(".feature-card", {
            onEnter: (elements) =>
              gsap.fromTo(
                elements,
                { y: d.md, autoAlpha: 0 },
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: isMobile ? 0.5 : 0.7,
                  stagger: d.stagger,
                  ease: "power3.out",
                }
              ),
            start,
          });

          // ── Feature Showcase section ──
          gsap.fromTo(
            ".showcase-heading",
            { y: d.md, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: d.dur,
              ease: "power3.out",
              scrollTrigger: {
                trigger: ".showcase-heading",
                start: startEarly,
                toggleActions: "play none none none",
              },
            }
          );

          gsap.utils.toArray<HTMLElement>(".showcase-feature").forEach((el) => {
            gsap.fromTo(
              el.children,
              { y: d.lg, autoAlpha: 0 },
              {
                y: 0,
                autoAlpha: 1,
                duration: d.dur,
                stagger: isMobile ? 0.1 : 0.2,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: el,
                  start: isMobile ? "top 85%" : "top 85%",
                  toggleActions: "play none none none",
                },
              }
            );
          });

          ScrollTrigger.batch(".showcase-mini", {
            onEnter: (elements) =>
              gsap.fromTo(
                elements,
                { y: d.sm, autoAlpha: 0 },
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: isMobile ? 0.35 : 0.5,
                  stagger: d.stagger,
                  ease: "power3.out",
                }
              ),
            start,
          });

          // ── Technology section ──
          const techTl = gsap.timeline({
            defaults: { ease: "power3.out", duration: d.dur },
            scrollTrigger: {
              trigger: ".tech-section",
              start: isMobile ? "top 82%" : "top 80%",
              toggleActions: "play none none none",
            },
          });

          techTl
            .fromTo(
              ".tech-heading",
              { y: d.md, autoAlpha: 0 },
              { y: 0, autoAlpha: 1 }
            )
            .fromTo(
              ".tech-subhead",
              { y: d.sm, autoAlpha: 0 },
              { y: 0, autoAlpha: 1 },
              "<0.1"
            )
            .fromTo(
              ".tech-code",
              { y: d.lg, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: isMobile ? 0.6 : 1 },
              "<0.15"
            );

          ScrollTrigger.batch(".tech-card", {
            onEnter: (elements) =>
              gsap.fromTo(
                elements,
                { y: d.md, autoAlpha: 0 },
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: isMobile ? 0.5 : 0.7,
                  stagger: isMobile ? 0.08 : 0.15,
                  ease: "power3.out",
                }
              ),
            start,
          });

          gsap.fromTo(
            ".tech-footer",
            { y: d.sm, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: d.dur,
              scrollTrigger: {
                trigger: ".tech-footer",
                start,
                toggleActions: "play none none none",
              },
            }
          );

          // ── Community section ──
          const communityTl = gsap.timeline({
            defaults: { ease: "power3.out", duration: d.dur },
            scrollTrigger: {
              trigger: ".community-section",
              start: isMobile ? "top 82%" : "top 80%",
              toggleActions: "play none none none",
            },
          });

          communityTl
            .fromTo(
              ".community-heading",
              { y: d.md, autoAlpha: 0 },
              { y: 0, autoAlpha: 1 }
            )
            .fromTo(
              ".community-cta",
              { y: d.sm, autoAlpha: 0 },
              { y: 0, autoAlpha: 1 },
              "<0.3"
            );

          ScrollTrigger.batch(".community-card", {
            onEnter: (elements) =>
              gsap.fromTo(
                elements,
                { y: d.md, autoAlpha: 0 },
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: isMobile ? 0.5 : 0.7,
                  stagger: isMobile ? 0.08 : 0.15,
                  ease: "power3.out",
                }
              ),
            start,
          });

          // ── Final CTA section ──
          const ctaTl = gsap.timeline({
            defaults: { ease: "power3.out", duration: isMobile ? 0.6 : 0.9 },
            scrollTrigger: {
              trigger: ".cta-section",
              start: isMobile ? "top 82%" : "top 80%",
              toggleActions: "play none none none",
            },
          });

          ctaTl
            .fromTo(
              ".cta-heading",
              { y: d.lg, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: isMobile ? 0.6 : 1 }
            )
            .fromTo(
              ".cta-button",
              { scale: 0.95, autoAlpha: 0 },
              { scale: 1, autoAlpha: 1 },
              "<0.2"
            )
            .fromTo(
              ".cta-badge",
              { y: d.sm, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, stagger: 0.08 },
              "<0.15"
            );

          // ── Support section ──
          const supportTl = gsap.timeline({
            defaults: { ease: "power3.out", duration: d.dur },
            scrollTrigger: {
              trigger: ".support-section",
              start: isMobile ? "top 85%" : "top 85%",
              toggleActions: "play none none none",
            },
          });

          supportTl
            .fromTo(
              ".support-icon",
              { scale: 0, autoAlpha: 0 },
              { scale: 1, autoAlpha: 1, ease: "back.out(1.7)" }
            )
            .fromTo(
              ".support-heading",
              { y: d.sm, autoAlpha: 0 },
              { y: 0, autoAlpha: 1 },
              "<0.15"
            )
            .fromTo(
              ".support-desc",
              { y: d.sm, autoAlpha: 0 },
              { y: 0, autoAlpha: 1 },
              "<0.1"
            )
            .fromTo(
              ".support-btn",
              { y: d.sm, autoAlpha: 0 },
              { y: 0, autoAlpha: 1 },
              "<0.1"
            );

          // ── Footer ──
          gsap.fromTo(
            ".landing-footer",
            { y: d.sm, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: d.dur,
              scrollTrigger: {
                trigger: ".landing-footer",
                start,
                toggleActions: "play none none none",
              },
            }
          );
        }
      );
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={root}
      className="min-h-screen bg-[#0F1520] text-white selection:bg-[#34F080]/30 selection:text-white relative overflow-x-clip"
    >
      <SeoStructuredData />
      {/* Atmospheric Orbs */}
      <div className="landing-orb w-[1000px] h-[1000px] bg-[#34F080] bottom-[20%] -left-[400px] opacity-[0.10]" />
      <div className="landing-orb w-[800px] h-[800px] bg-[#20E0AA] top-[40%] left-[15%] opacity-[0.07]" />
      <div className="landing-orb w-[1100px] h-[1100px] bg-[#40B8E0] top-[5%] left-[20%] opacity-[0.08]" />
      <div className="landing-orb w-[900px] h-[900px] bg-[#3090D0] -top-[200px] -right-[200px] opacity-[0.10]" />

      {/* Navigation */}
      <PublicNav variant="auth" onSignUp={() => setShowTutorial(true)} />

      {/* Hero */}
      <section className="relative pt-22 pb-4 md:pt-32 md:pb-28 px-4 md:px-6">
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
              ChatOn is end-to-end encrypted messaging on the DeSo blockchain.
              Send messages, tip creators, and control who reaches your inbox —
              all on a network no single company controls.{" "}
              <span className="text-white">
                Built to scale. Impossible to censor.
              </span>
            </p>
            <div className="hero-cta flex flex-col sm:flex-row gap-5 md:gap-6">
              <button
                onClick={() => setShowTutorial(true)}
                className="px-8 py-4 md:px-10 md:py-5 landing-btn-vivid text-white font-black rounded-2xl flex items-center justify-center gap-3 text-lg md:text-xl group cursor-pointer"
              >
                Start Messaging
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
              </button>
              <a
                href="/community"
                className="px-8 py-4 md:px-10 md:py-5 flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:border-[#34F080]/40 hover:bg-[#34F080]/5 text-gray-300 hover:text-white font-black text-lg md:text-xl rounded-2xl transition-all group"
              >
                <Users className="w-5 h-5 text-[#34F080]" />
                Explore Communities
              </a>
            </div>
          </div>

          <div className="hero-mockup lg:col-span-5 mt-8 lg:mt-0 landing-mockup-wrap">
            <div className="landing-mockup-inner relative">
              <div className="landing-glass-card rounded-3xl lg:rounded-[60px] p-5 lg:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] lg:shadow-[0_40px_100px_rgba(0,0,0,0.7),0_0_60px_rgba(43,184,154,0.06)] border-white/5 bg-[#0F1520]/80">
                {/* Chat header */}
                <div className="flex items-center gap-3 lg:gap-4 mb-5 lg:mb-8 pb-4 lg:pb-6 border-b border-white/5">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-[#34F080]/40 to-[#20E0AA]/20 shrink-0 flex items-center justify-center text-xs lg:text-sm font-black text-[#34F080]">
                    SN
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm lg:text-base font-black">
                      Satoshi_N
                    </div>
                    <div className="text-[9px] lg:text-[10px] text-[#34F080] uppercase font-black tracking-widest">
                      Encrypted
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-[#34F080] shrink-0" />
                </div>

                {/* Chat messages */}
                <div className="space-y-3 lg:space-y-5">
                  {/* Received message */}
                  <div className="flex gap-2 items-end">
                    <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-gradient-to-br from-[#34F080]/30 to-[#20E0AA]/10 shrink-0 flex items-center justify-center text-[8px] lg:text-[9px] font-bold text-[#34F080]/70">
                      SN
                    </div>
                    <div>
                      <div className="bg-white/5 border border-white/8 px-3 lg:px-4 py-2 lg:py-3 rounded-2xl rounded-bl-sm max-w-[85%]">
                        <div className="text-[10px] text-[#34F080] font-bold mb-0.5">
                          Satoshi_N
                        </div>
                        <div className="text-xs lg:text-sm text-gray-300">
                          Every message encrypted before it leaves your device.
                          No one else can read them. 🔒
                        </div>
                      </div>
                      <div className="flex gap-1.5 -mt-1 relative z-10 ml-1">
                        <div className="flex items-center gap-1 bg-[#1a2436] border border-[#34F080]/20 rounded-full px-2 py-0.5">
                          <AnimatedEmoji emoji="💯" size={14} />
                          <span className="text-[9px] font-bold text-[#34F080]">
                            2
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sent message */}
                  <div className="flex justify-end">
                    <div className="bg-[#34F080]/10 border border-[#34F080]/20 px-3 lg:px-4 py-2 lg:py-3 rounded-2xl rounded-br-sm max-w-[85%]">
                      <div className="text-xs lg:text-sm text-[#34F080]/90">
                        That's why I switched. No company in the middle.
                      </div>
                    </div>
                  </div>

                  {/* Received message with tip pill + reaction */}
                  <div className="flex gap-2 items-end">
                    <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-gradient-to-br from-[#34F080]/30 to-[#20E0AA]/10 shrink-0 flex items-center justify-center text-[8px] lg:text-[9px] font-bold text-[#34F080]/70">
                      SN
                    </div>
                    <div>
                      <div className="bg-white/5 border border-white/8 px-3 lg:px-4 py-2 lg:py-3 rounded-2xl rounded-bl-sm max-w-[85%]">
                        <div className="text-xs lg:text-sm text-gray-300">
                          Exactly how messaging should work.
                        </div>
                      </div>
                      <div className="flex gap-1.5 -mt-1 relative z-10 ml-1 flex-wrap">
                        <div className="flex items-center gap-1 h-[22px] bg-[#2775ca]/[0.10] border border-[#2775ca]/25 rounded-full px-1.5 py-0.5 backdrop-blur-xl">
                          <CircleDollarSign className="w-3 h-3 text-[#2775ca]" />
                          <span className="text-[10px] font-semibold text-[#2775ca]">
                            $0.50
                          </span>
                          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#40B8E0]/40 to-[#40B8E0]/20 ring-1 ring-[#141c2b] flex items-center justify-center text-[6px] font-bold text-[#40B8E0]/70">
                            Y
                          </div>
                        </div>
                        <div className="flex items-center gap-1 bg-[#1a2436] border border-white/10 rounded-full px-2 py-0.5">
                          <AnimatedEmoji emoji="🔥" size={14} />
                          <span className="text-[9px] font-bold text-gray-400">
                            3
                          </span>
                        </div>
                      </div>
                    </div>
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
            <h2 className="text-3xl md:text-7xl font-black tracking-tight mb-5 md:mb-8 max-w-4xl mx-auto leading-tight landing-heading-glow">
              No single company should{" "}
              <span className="text-[#40B8E0]">
                control your conversations.
              </span>
            </h2>
            <p className="text-base md:text-xl text-gray-400 max-w-3xl mx-auto font-medium leading-relaxed">
              Traditional messengers keep your data on servers owned and
              operated by one company. One breach, one policy change, one outage
              — and your conversations are gone. ChatOn encrypts your messages
              and stores them across a decentralized network of DeSo nodes that
              no single entity controls.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="feature-card landing-glass-card p-7 md:p-12 rounded-3xl md:rounded-[48px] group">
              <div className="relative w-14 h-14 md:w-16 md:h-16 mb-6 md:mb-8">
                <div className="absolute inset-0 rounded-2xl bg-[#34F080]/[0.08] group-hover:bg-[#34F080]/[0.12] transition-all duration-700" />
                <div className="absolute -inset-3 rounded-3xl bg-[#34F080]/[0.06] blur-xl group-hover:bg-[#34F080]/[0.12] group-hover:-inset-5 group-hover:blur-2xl transition-all duration-700" />
                <div className="relative w-full h-full flex items-center justify-center">
                  <Eye className="w-7 h-7 md:w-8 md:h-8 text-[#34F080] drop-shadow-[0_0_8px_rgba(52,240,128,0.4)]" />
                </div>
              </div>
              <h3 className="text-2xl font-black mb-4 text-white group-hover:text-[#34F080] transition-colors text-left">
                Content Stays Private
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed text-left">
                Messages, media URLs, reactions, and file metadata are all
                encrypted in your browser before touching the blockchain. The
                network can see that you sent a message — but never what you
                said or shared.
              </p>
            </div>
            <div className="feature-card landing-glass-card p-7 md:p-12 rounded-3xl md:rounded-[48px] group">
              <div className="relative w-14 h-14 md:w-16 md:h-16 mb-6 md:mb-8">
                <div className="absolute inset-0 rounded-2xl bg-[#20E0AA]/[0.08] group-hover:bg-[#20E0AA]/[0.12] transition-all duration-700" />
                <div className="absolute -inset-3 rounded-3xl bg-[#20E0AA]/[0.06] blur-xl group-hover:bg-[#20E0AA]/[0.12] group-hover:-inset-5 group-hover:blur-2xl transition-all duration-700" />
                <div className="relative w-full h-full flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 md:w-8 md:h-8 text-[#20E0AA] drop-shadow-[0_0_8px_rgba(32,224,170,0.4)]" />
                </div>
              </div>
              <h3 className="text-2xl font-black mb-4 text-white group-hover:text-[#20E0AA] transition-colors text-left">
                No Single Point of Failure
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed text-left">
                Messages live across thousands of independent nodes. No single
                outage, company, or government can take the network offline.
              </p>
            </div>
            <div className="feature-card landing-glass-card p-7 md:p-12 rounded-3xl md:rounded-[48px] group">
              <div className="relative w-14 h-14 md:w-16 md:h-16 mb-6 md:mb-8">
                <div className="absolute inset-0 rounded-2xl bg-[#40B8E0]/[0.08] group-hover:bg-[#40B8E0]/[0.12] transition-all duration-700" />
                <div className="absolute -inset-3 rounded-3xl bg-[#40B8E0]/[0.06] blur-xl group-hover:bg-[#40B8E0]/[0.12] group-hover:-inset-5 group-hover:blur-2xl transition-all duration-700" />
                <div className="relative w-full h-full flex items-center justify-center">
                  <Ban className="w-7 h-7 md:w-8 md:h-8 text-[#40B8E0] drop-shadow-[0_0_8px_rgba(64,184,224,0.4)]" />
                </div>
              </div>
              <h3 className="text-2xl font-black mb-4 text-white group-hover:text-[#40B8E0] transition-colors text-left">
                Censorship Resistant
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed text-left">
                Your account is a cryptographic key pair you control. No
                platform can suspend, delete, or lock you out.
              </p>
            </div>
            <div className="feature-card landing-glass-card p-7 md:p-12 rounded-3xl md:rounded-[48px] group">
              <div className="relative w-14 h-14 md:w-16 md:h-16 mb-6 md:mb-8">
                <div className="absolute inset-0 rounded-2xl bg-[#3090D0]/[0.08] group-hover:bg-[#3090D0]/[0.12] transition-all duration-700" />
                <div className="absolute -inset-3 rounded-3xl bg-[#3090D0]/[0.06] blur-xl group-hover:bg-[#3090D0]/[0.12] group-hover:-inset-5 group-hover:blur-2xl transition-all duration-700" />
                <div className="relative w-full h-full flex items-center justify-center">
                  <Globe className="w-7 h-7 md:w-8 md:h-8 text-[#3090D0] drop-shadow-[0_0_8px_rgba(48,144,208,0.4)]" />
                </div>
              </div>
              <h3 className="text-2xl font-black mb-4 text-white group-hover:text-[#3090D0] transition-colors text-left">
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
            <h2 className="text-3xl md:text-7xl font-black tracking-tight mb-5 md:mb-8 max-w-5xl mx-auto leading-tight landing-heading-glow">
              A full-featured messenger.{" "}
              <span className="landing-text-logo-gradient">
                On the blockchain.
              </span>
            </h2>
            <p className="text-base md:text-xl text-gray-400 max-w-3xl mx-auto font-medium leading-relaxed">
              Tipping, paid DMs, group chats, reactions, GIFs, video, replies,
              and real-time translation — everything you expect from a modern
              messenger, plus features you won't find anywhere else.
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
                Create encrypted group conversations with custom names and
                images. Share invite links to let anyone join with a tap, or
                list your group in the public community directory. Every group
                is portable across the entire DeSo ecosystem.
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
                      <div className="text-[10px] text-gray-500">
                        Alex, Maya, Jordan
                      </div>
                    </div>
                    <div className="flex -space-x-2 shrink-0">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#34F080]/40 to-[#34F080]/10 border-2 border-[#141c28]" />
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#40B8E0]/40 to-[#40B8E0]/10 border-2 border-[#141c28]" />
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#3090D0]/40 to-[#3090D0]/10 border-2 border-[#141c28]" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-2 items-end">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#34F080]/30 to-[#34F080]/10 shrink-0 flex items-center justify-center text-[8px] font-bold text-[#34F080]/70">
                        A
                      </div>
                      <div className="bg-white/5 border border-white/8 px-3 py-2 rounded-2xl rounded-bl-sm max-w-[80%]">
                        <div className="text-[10px] text-[#34F080] font-bold mb-0.5">
                          Alex
                        </div>
                        <div className="text-xs text-gray-300">
                          Just pushed the new brand assets to the repo
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#40B8E0]/30 to-[#40B8E0]/10 shrink-0 flex items-center justify-center text-[8px] font-bold text-[#40B8E0]/70">
                        M
                      </div>
                      <div className="bg-white/5 border border-white/8 px-3 py-2 rounded-2xl rounded-bl-sm max-w-[80%]">
                        <div className="text-[10px] text-[#40B8E0] font-bold mb-0.5">
                          Maya
                        </div>
                        <div className="text-xs text-gray-300">
                          Love them! The new palette is perfect
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div>
                        <div className="bg-[#34F080]/10 border border-[#34F080]/20 px-3 py-2 rounded-2xl rounded-br-sm max-w-[80%] ml-auto">
                          <div className="text-xs text-[#34F080]/90">
                            Shipping the update tonight 🚀
                          </div>
                        </div>
                        <div className="flex justify-end gap-1.5 -mt-1 relative z-10 mr-1">
                          <div className="flex items-center gap-1 h-[22px] bg-[#2775ca]/[0.10] border border-[#2775ca]/25 rounded-full px-1.5 py-0.5 backdrop-blur-xl">
                            <CircleDollarSign className="w-3 h-3 text-[#2775ca]" />
                            <span className="text-[10px] font-semibold text-[#2775ca]">
                              $0.01
                            </span>
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#40B8E0]/40 to-[#40B8E0]/20 ring-1 ring-[#141c2b]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 bg-white/3 border border-white/5 rounded-full px-4 py-2.5">
                    <span className="text-[11px] text-gray-600 flex-1">
                      Type a message...
                    </span>
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
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#20E0AA]/30 to-[#20E0AA]/10 shrink-0 flex items-center justify-center text-[8px] font-bold text-[#20E0AA]/70">
                        J
                      </div>
                      <div>
                        <div className="bg-white/5 border border-white/8 px-3 py-2 rounded-2xl rounded-bl-sm">
                          <div className="text-xs text-gray-300">
                            The new landing page looks incredible!
                          </div>
                        </div>
                        <div className="flex gap-1.5 -mt-1 relative z-10 ml-1">
                          <div className="flex items-center gap-1 bg-[#1a2436] border border-[#34F080]/20 rounded-full px-2 py-0.5">
                            <AnimatedEmoji emoji="👍" size={14} />
                            <span className="text-[9px] font-bold text-[#34F080]">
                              2
                            </span>
                          </div>
                          <div className="flex items-center gap-1 bg-[#1a2436] border border-white/10 rounded-full px-2 py-0.5">
                            <AnimatedEmoji emoji="❤️" size={14} />
                            <span className="text-[9px] font-bold text-gray-400">
                              3
                            </span>
                          </div>
                          <div className="flex items-center gap-1 bg-[#1a2436] border border-white/10 rounded-full px-2 py-0.5">
                            <AnimatedEmoji emoji="🔥" size={14} />
                            <span className="text-[9px] font-bold text-gray-400">
                              1
                            </span>
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
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#20E0AA]/30 to-[#20E0AA]/10 shrink-0 flex items-center justify-center text-[8px] font-bold text-[#20E0AA]/70">
                        J
                      </div>
                      <div className="bg-white/5 border border-white/8 rounded-2xl rounded-bl-sm overflow-hidden max-w-[85%]">
                        <div className="bg-white/3 border-l-2 border-[#20E0AA] px-3 py-1.5 mx-2 mt-2 rounded-r-lg">
                          <div className="text-[9px] text-[#20E0AA] font-bold">
                            You
                          </div>
                          <div className="text-[10px] text-gray-500 truncate">
                            Shipping the update tonight 🚀
                          </div>
                        </div>
                        <div className="px-3 py-2">
                          <div className="text-xs text-gray-300">
                            Can't wait to see it live!
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Big emoji reply */}
                    <div className="flex gap-2 items-end">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#20E0AA]/30 to-[#20E0AA]/10 shrink-0 flex items-center justify-center text-[8px] font-bold text-[#20E0AA]/70">
                        J
                      </div>
                      <div className="flex items-center gap-1 py-1">
                        <AnimatedEmoji emoji="👍" size={48} />
                        <AnimatedEmoji emoji="💯" size={48} />
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
                below each message. Quote-reply for threaded context. Share
                GIFs, images, videos, and files — all encrypted and stored
                on-chain alongside your conversations.
              </p>
            </div>
          </div>

          {/* Feature 3: Smart Inbox */}
          <div className="showcase-feature grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center mb-16 md:mb-32">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.3em] uppercase text-[#40B8E0] mb-4 md:mb-6">
                <ShieldCheck className="w-4 h-4" />
                Smart Inbox
              </div>
              <h3 className="text-2xl md:text-5xl font-black tracking-tight mb-4 md:mb-6 leading-tight">
                Your inbox. Your rules.
              </h3>
              <p className="text-base md:text-lg text-gray-400 font-medium leading-relaxed">
                Messages from strangers land in Requests — not your main inbox.
                Set custom filters like minimum DESO balance or verified profile
                to auto-sort who gets through. Accept, block, or dismiss — all
                enforced on-chain with no backend.
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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3090D0]/30 to-[#3090D0]/10 shrink-0 flex items-center justify-center text-[9px] font-bold text-[#3090D0]/70">
                          CF
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="text-xs font-bold text-gray-300">
                            CryptoFan_42
                          </div>
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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 shrink-0 flex items-center justify-center text-[9px] font-bold text-gray-400">
                          NU
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="text-xs font-bold text-gray-300">
                            NewUser_2024
                          </div>
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

          {/* Feature 4: Tipping */}
          <div className="showcase-feature grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center mb-16 md:mb-32">
            <div className="order-2 lg:order-1 landing-mockup-wrap">
              <div className="landing-mockup-inner face-right">
                <div className="landing-glass-card rounded-3xl p-5 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                  <div className="space-y-4">
                    {/* Message with tip pills below (like reaction pills) */}
                    <div className="flex gap-2 items-end">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2775ca]/30 to-[#2775ca]/10 shrink-0 flex items-center justify-center text-[8px] font-bold text-[#2775ca]/70">
                        K
                      </div>
                      <div>
                        <div className="bg-white/5 border border-white/8 px-3 py-2 rounded-2xl rounded-bl-sm">
                          <div className="text-xs text-gray-300">
                            Just shipped the new landing page! 🚀
                          </div>
                        </div>
                        <div className="flex gap-1.5 -mt-1 relative z-10 ml-1 flex-wrap">
                          {/* DESO tip pill — blue glassmorphism */}
                          <div className="flex items-center gap-1 h-[22px] bg-[#2775ca]/[0.08] border border-[#2775ca]/25 rounded-full px-2 py-0.5 backdrop-blur-xl">
                            <CircleDollarSign className="w-3 h-3 text-[#2775ca]" />
                            <span className="text-[11px] font-semibold text-[#2775ca]">
                              $1.50
                            </span>
                            <div className="flex -space-x-1.5 ml-0.5">
                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#34F080]/40 to-[#34F080]/20 ring-1 ring-[#141c2b]" />
                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#40B8E0]/40 to-[#40B8E0]/20 ring-1 ring-[#141c2b]" />
                            </div>
                          </div>
                          {/* Reaction pill alongside tips */}
                          <div className="flex items-center gap-1 bg-[#1a2436] border border-white/10 rounded-full px-2 py-0.5">
                            <AnimatedEmoji emoji="🔥" size={14} />
                            <span className="text-[9px] font-bold text-gray-400">
                              4
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sent message */}
                    <div className="flex items-end justify-end gap-2">
                      <div className="bg-[#34F080]/10 border border-[#34F080]/15 px-3 py-2 rounded-2xl rounded-br-sm max-w-[85%]">
                        <div className="text-xs text-gray-200">
                          Amazing work — this deserves a tip! 🎉
                        </div>
                      </div>
                    </div>

                    {/* Standalone USDC tip message (receipt style) */}
                    <div className="flex gap-2 items-end">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#20E0AA]/30 to-[#20E0AA]/10 shrink-0 flex items-center justify-center text-[8px] font-bold text-[#20E0AA]/70">
                        L
                      </div>
                      <div className="bg-white/5 border border-white/8 px-3 py-2 rounded-2xl rounded-bl-sm">
                        <div className="flex items-center gap-1.5">
                          <CircleDollarSign className="w-4 h-4 text-[#34F080]" />
                          <span className="text-sm font-bold text-[#34F080]">
                            $2.00
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          2.00 USDC
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5 text-center">
                    <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                      Atomic on-chain transactions · instant delivery
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.3em] uppercase text-[#34F080] mb-4 md:mb-6">
                <Coins className="w-4 h-4" />
                Instant Tips
              </div>
              <h3 className="text-2xl md:text-5xl font-black tracking-tight mb-4 md:mb-6 leading-tight">
                Tip anyone.{" "}
                <span className="landing-text-logo-gradient">
                  No middleman.
                </span>
              </h3>
              <p className="text-base md:text-lg text-gray-400 font-medium leading-relaxed">
                Send DESO or USDC to anyone in a conversation. Tips under $0.10
                have zero platform fees. Everything happens in a single atomic
                transaction — instant, verifiable, and entirely on-chain.
              </p>
            </div>
          </div>

          {/* Feature 5: Paid DMs */}
          <div className="showcase-feature grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center mb-16 md:mb-32">
            <div>
              <div className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.3em] uppercase text-[#40B8E0] mb-4 md:mb-6">
                <DollarSign className="w-4 h-4" />
                Paid DMs
              </div>
              <h3 className="text-2xl md:text-5xl font-black tracking-tight mb-4 md:mb-6 leading-tight">
                Get paid for{" "}
                <span className="landing-text-logo-gradient">
                  your attention.
                </span>
              </h3>
              <p className="text-base md:text-lg text-gray-400 font-medium leading-relaxed">
                Set a price for DMs from people you haven't chatted with. Their
                payment is bundled with the first message in a single atomic
                transaction. Once you reply, the conversation is free. Your
                price, your rules — enforced by the blockchain.
              </p>
            </div>
            <div className="landing-mockup-wrap">
              <div className="landing-mockup-inner">
                <div className="landing-glass-card rounded-3xl p-5 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#40B8E0] mb-4">
                    Inbox Rules
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] text-gray-400 mb-2 font-bold">
                        Price per message
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full relative">
                          <div className="absolute left-0 top-0 h-full w-[40%] bg-gradient-to-r from-[#40B8E0] to-[#3090D0] rounded-full" />
                          <div className="absolute top-1/2 -translate-y-1/2 left-[40%] w-3 h-3 bg-white rounded-full shadow-lg border-2 border-[#40B8E0]" />
                        </div>
                        <span className="text-sm font-black text-white">
                          $1.00
                        </span>
                      </div>
                    </div>
                    <div className="bg-white/3 border border-white/5 rounded-xl p-3">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Free pass filter
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">
                            Require DeSo profile
                          </span>
                          <div className="w-8 h-[18px] bg-[#34F080]/30 rounded-full relative shrink-0">
                            <div className="absolute right-[3px] top-[3px] w-3 h-3 bg-[#34F080] rounded-full" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">
                            Min DESO balance
                          </span>
                          <span className="text-[11px] font-bold text-white">
                            1 DESO
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[#40B8E0]/5 border border-[#40B8E0]/15 rounded-xl p-3">
                      <div className="text-[11px] text-[#40B8E0] font-medium">
                        Senders who pass your filter message free. Everyone else
                        pays $1.00/msg.
                      </div>
                    </div>
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
              {(
                [
                  {
                    icon: PenLine,
                    color: "#34F080",
                    title: "Edit & Delete",
                    desc: "Fix typos or remove messages after sending",
                  },
                  {
                    icon: MessageSquareMore,
                    color: "#20E0AA",
                    title: "Typing Indicators",
                    desc: "See when someone is composing a reply",
                  },
                  {
                    icon: Bell,
                    color: "#40B8E0",
                    title: "Push Notifications",
                    desc: "Real-time alerts via WebSocket relay",
                  },
                  {
                    icon: BellOff,
                    color: "#3090D0",
                    title: "Mute Conversations",
                    desc: "Silence noisy chats without leaving",
                  },
                  {
                    icon: Languages,
                    color: "#34F080",
                    title: "Auto-Translate",
                    desc: "Messages translated to your language in real-time",
                  },
                  {
                    icon: UserCog,
                    color: "#20E0AA",
                    title: "Multi-Account",
                    desc: "Switch between DeSo identities instantly",
                  },
                  {
                    icon: CheckCheck,
                    color: "#40B8E0",
                    title: "Message Status",
                    desc: "Sending, sent, and confirmed indicators",
                  },
                  {
                    icon: AtSign,
                    color: "#3090D0",
                    title: "@Mentions",
                    desc: "Tag people in group conversations",
                  },
                ] as const
              ).map((f) => (
                <div
                  key={f.title}
                  className="showcase-mini landing-glass-card p-4 md:p-5 rounded-2xl text-left"
                >
                  <f.icon className="w-5 h-5 mb-3" style={{ color: f.color }} />
                  <div className="text-sm font-bold text-white mb-1">
                    {f.title}
                  </div>
                  <div className="text-[11px] text-gray-500 leading-relaxed">
                    {f.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="landing-divider mx-auto max-w-5xl" />

      {/* Technology Section */}
      <section
        id="technology"
        className="tech-section py-12 md:py-28 px-4 md:px-6"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-24 items-start mb-10 md:mb-24">
            <div className="text-left">
              <h2 className="tech-heading text-4xl md:text-8xl font-black tracking-tight mb-5 md:mb-10 leading-[1.05] landing-heading-glow">
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
                      (content: <span className="text-[#34F080]">string</span>,
                      recipientKey:{" "}
                      <span className="text-[#34F080]">string</span>) {"{"}
                    </p>
                    <p>
                      &nbsp;&nbsp;
                      <span className="text-gray-600">
                        {
                          "// AES-128-CTR + ECDH key exchange — runs in your browser"
                        }
                      </span>
                    </p>
                    <p>
                      &nbsp;&nbsp;<span className="text-[#20E0AA]">const</span>{" "}
                      shared ={" "}
                      <span className="text-[#40B8E0]">deriveSharedSecret</span>
                      (myKey, recipientKey);
                    </p>
                    <p>
                      &nbsp;&nbsp;<span className="text-[#20E0AA]">const</span>{" "}
                      encrypted ={" "}
                      <span className="text-[#40B8E0]">aes128ctr</span>(content,
                      shared);
                    </p>
                    <p>&nbsp;</p>
                    <p>
                      &nbsp;&nbsp;
                      <span className="text-gray-600">
                        {"// Only ciphertext reaches the blockchain"}
                      </span>
                    </p>
                    <p>
                      &nbsp;&nbsp;<span className="text-[#20E0AA]">await</span>{" "}
                      deso.
                      <span className="text-[#34F080]">sendDMMessage</span>
                      (encrypted);
                    </p>
                    <p>&nbsp;</p>
                    <p>
                      &nbsp;&nbsp;
                      <span className="text-gray-600">
                        {"// Anyone can see this transaction happened."}
                      </span>
                    </p>
                    <p>
                      &nbsp;&nbsp;
                      <span className="text-gray-600">
                        {"// No one can read what it says."}
                      </span>
                    </p>
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
                  Like a postal service: the addresses on the envelope are
                  visible.
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
                    Image, video, and file URLs
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#3090D0] mt-0.5 shrink-0" />
                    Reactions and reply previews
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-[#3090D0] mt-0.5 shrink-0" />
                    Group encryption keys
                  </li>
                </ul>
                <div className="mt-10 pt-6 border-t border-white/5 text-[10px] text-gray-500 italic">
                  The letter inside is sealed — including every attachment. Only
                  sender and recipient hold the keys.
                </div>
              </div>
            </div>
          </div>
          <div className="tech-footer max-w-4xl mx-auto text-center">
            <p className="text-gray-500 font-medium leading-relaxed italic">
              DeSo is a public blockchain — anyone can run a node and verify
              that message content is stored as ciphertext, and that no one
              (including ChatOn) can decrypt it without your private key. This
              is how we prove our privacy claims instead of just asking you to
              believe them.
            </p>
          </div>
        </div>
      </section>

      <div className="landing-divider mx-auto max-w-5xl" />

      {/* Community Section */}
      <section className="community-section py-12 md:py-28 px-4 md:px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="community-heading text-center mb-10 md:mb-20">
            <div className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.3em] uppercase text-[#34F080] mb-5 md:mb-8">
              <Globe className="w-4 h-4" />
              Open Communities
            </div>
            <h2 className="text-3xl md:text-7xl font-black tracking-tight mb-5 md:mb-8 max-w-5xl mx-auto leading-tight landing-heading-glow">
              Find your people.{" "}
              <span className="landing-text-logo-gradient">
                Join the conversation.
              </span>
            </h2>
            <p className="text-base md:text-xl text-gray-400 max-w-3xl mx-auto font-medium leading-relaxed">
              Explore public group chats created by the community — from crypto
              trading to design, development to DeFi. Every group is encrypted,
              decentralized, and free to join.
            </p>
          </div>

          {/* Community preview cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-10 md:mb-16">
            {communities.map((listing) => {
              const displayName =
                listing.groupDisplayName ??
                listing.groupKeyName.replace(/\0/g, "");
              const ownerUsername = listing.ownerProfile?.Username;
              return (
                <a
                  key={listing.associationId}
                  href={
                    listing.inviteCode
                      ? buildInviteUrl(listing.inviteCode)
                      : "/community"
                  }
                  className="community-card landing-glass-card rounded-3xl p-6 md:p-8 text-left block group"
                >
                  <div className="flex items-center gap-3.5 mb-4">
                    <MessagingDisplayAvatar
                      publicKey={listing.groupKeyName}
                      groupChat
                      groupImageUrl={listing.groupImageUrl}
                      diameter={48}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-white truncate group-hover:text-[#34F080] transition-colors">
                        {displayName}
                      </h4>
                      {ownerUsername && (
                        <p className="text-[11px] text-gray-500">
                          by @{ownerUsername}
                        </p>
                      )}
                    </div>
                  </div>
                  {listing.description && (
                    <p className="text-sm text-gray-400 leading-relaxed mb-5 line-clamp-2">
                      {listing.description}
                    </p>
                  )}
                  {!listing.description && <div className="mb-5" />}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {listing.memberCount}
                        {listing.memberCountCapped ? "+" : ""} members
                      </span>
                    </div>
                    <span className="px-4 py-2 bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black text-xs font-black rounded-full opacity-80 group-hover:opacity-100 transition-opacity">
                      Join
                    </span>
                  </div>
                </a>
              );
            })}
          </div>

          <div className="community-cta text-center">
            <a
              href="/community"
              className="inline-flex items-center gap-3 px-8 py-4 md:px-10 md:py-5 landing-glass-card rounded-2xl text-white font-black text-base md:text-lg hover:border-[#34F080]/25 transition-all group"
            >
              Browse All Communities
              <ArrowRight className="w-5 h-5 text-[#34F080] group-hover:translate-x-2 transition-transform" />
            </a>
            <p className="mt-5 text-xs text-gray-600 font-medium">
              Or list your own group for others to discover
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
              onClick={() => setShowTutorial(true)}
              className="cta-button inline-flex items-center gap-4 md:gap-6 px-8 py-5 md:px-12 md:py-8 landing-btn-vivid text-white text-lg md:text-2xl font-black rounded-2xl md:rounded-[32px] group transition-all shadow-[0_0_80px_rgba(43,184,154,0.3)] cursor-pointer"
            >
              Start Messaging for Free
              <ArrowRight className="w-7 h-7 group-hover:translate-x-3 transition-transform" />
            </button>
            <div className="flex flex-wrap justify-center gap-6 md:gap-14">
              <div className="cta-badge flex flex-col items-center gap-2 md:gap-3">
                <ShieldCheck className="w-7 h-7 text-[#34F080]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                  E2E Encrypted
                </span>
              </div>
              <div className="cta-badge flex flex-col items-center gap-3">
                <Code className="w-7 h-7 text-[#20E0AA]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                  Open Source
                </span>
              </div>
              <div className="cta-badge flex flex-col items-center gap-3">
                <Ban className="w-7 h-7 text-[#40B8E0]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                  Zero Ads
                </span>
              </div>
              <div className="cta-badge flex flex-col items-center gap-3">
                <UserCheck className="w-7 h-7 text-[#3090D0]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                  No Lock-in
                </span>
              </div>
              <div className="cta-badge flex flex-col items-center gap-3">
                <Globe className="w-7 h-7 text-[#34F080]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                  Global Network
                </span>
              </div>
              <div className="cta-badge flex flex-col items-center gap-3">
                <Coins className="w-7 h-7 text-[#20E0AA]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                  Built-in Tips
                </span>
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
            href="/donate"
            className="support-btn inline-flex items-center gap-2.5 px-6 py-3 bg-white/5 border border-white/10 text-gray-300 hover:text-[#34F080] hover:border-[#34F080]/40 font-semibold rounded-xl transition-all cursor-pointer text-sm"
          >
            <Heart className="w-4 h-4" />
            Donate $DESO to ChatOn
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
              <span className="font-black tracking-tighter text-4xl">
                ChatOn
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-10 md:gap-16 text-xs font-black uppercase tracking-[0.4em] text-gray-500">
              <a
                href="/about"
                className="hover:text-[#34F080] transition-colors"
              >
                About
              </a>
              <a
                href="https://github.com/sungkhum/chaton"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#34F080] transition-colors"
              >
                GitHub
              </a>
              <a
                href="/donate"
                className="hover:text-[#34F080] transition-colors"
              >
                Donate
              </a>
              <a
                href="/privacy"
                className="hover:text-[#34F080] transition-colors"
              >
                Privacy
              </a>
              <a
                href="/terms"
                className="hover:text-[#34F080] transition-colors"
              >
                Terms
              </a>
            </div>
          </div>
          <div className="mt-12 md:mt-32 text-center">
            <p className="text-[10px] text-gray-600 font-bold tracking-[0.4em] uppercase leading-loose">
              &copy; {new Date().getFullYear()} CHATON. END-TO-END ENCRYPTED
              MESSAGING ON DESO BLOCKCHAIN.
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

      {showTutorial && (
        <PreSignupTutorial onClose={() => setShowTutorial(false)} />
      )}
    </div>
  );
};
