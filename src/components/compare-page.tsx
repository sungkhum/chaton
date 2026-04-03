import { useLayoutEffect, useRef } from "react";
import { identity } from "deso-protocol";
import { usePageMeta } from "../hooks/usePageMeta";
import { ArrowLeftRight, Check, X, Minus } from "lucide-react";
import gsap from "gsap";
import { PublicNav, PublicFooter } from "./public-layout";

interface ComparisonRow {
  feature: string;
  chatOn: "yes" | "no" | "partial" | string;
  signal: "yes" | "no" | "partial" | string;
  telegram: "yes" | "no" | "partial" | string;
  whatsapp: "yes" | "no" | "partial" | string;
  session: "yes" | "no" | "partial" | string;
}

const COMPARISON_DATA: ComparisonRow[] = [
  {
    feature: "E2E encrypted by default",
    chatOn: "yes",
    signal: "yes",
    telegram: "no",
    whatsapp: "yes",
    session: "yes",
  },
  {
    feature: "E2E encrypted group chats",
    chatOn: "yes",
    signal: "yes",
    telegram: "no",
    whatsapp: "yes",
    session: "yes",
  },
  {
    feature: "Decentralized",
    chatOn: "Blockchain (DeSo)",
    signal: "no",
    telegram: "no",
    whatsapp: "no",
    session: "Onion network (Oxen)",
  },
  {
    feature: "No phone number required",
    chatOn: "yes",
    signal: "no",
    telegram: "no",
    whatsapp: "no",
    session: "yes",
  },
  {
    feature: "Messages survive app shutdown",
    chatOn: "yes",
    signal: "no",
    telegram: "no",
    whatsapp: "no",
    session: "no",
  },
  {
    feature: "Open source",
    chatOn: "yes",
    signal: "yes",
    telegram: "partial",
    whatsapp: "no",
    session: "yes",
  },
  {
    feature: "Forward secrecy",
    chatOn: "no",
    signal: "yes",
    telegram: "Secret Chats only",
    whatsapp: "yes",
    session: "yes",
  },
  {
    feature: "No app store required",
    chatOn: "yes",
    signal: "no",
    telegram: "partial",
    whatsapp: "no",
    session: "no",
  },
  {
    feature: "Portable chat history",
    chatOn: "yes",
    signal: "no",
    telegram: "no",
    whatsapp: "no",
    session: "no",
  },
  {
    feature: "GIFs and stickers",
    chatOn: "yes",
    signal: "yes",
    telegram: "yes",
    whatsapp: "yes",
    session: "no",
  },
  {
    feature: "Emoji reactions",
    chatOn: "yes",
    signal: "yes",
    telegram: "yes",
    whatsapp: "yes",
    session: "yes",
  },
  {
    feature: "Push notifications",
    chatOn: "yes",
    signal: "yes",
    telegram: "yes",
    whatsapp: "yes",
    session: "partial",
  },
  {
    feature: "Community directory",
    chatOn: "yes",
    signal: "no",
    telegram: "yes",
    whatsapp: "no",
    session: "no",
  },
];

const CellValue = ({ value }: { value: string }) => {
  if (value === "yes")
    return <Check className="w-4 h-4 text-[#34F080] mx-auto" />;
  if (value === "no") return <X className="w-4 h-4 text-gray-600 mx-auto" />;
  if (value === "partial")
    return <Minus className="w-4 h-4 text-yellow-500 mx-auto" />;
  return (
    <span className="text-[10px] md:text-xs text-gray-400 leading-tight">
      {value}
    </span>
  );
};

const APP_SUMMARIES = [
  {
    name: "ChatOn vs Signal",
    content:
      "Both offer end-to-end encryption by default. Signal stores messages on centralized servers and requires a phone number. ChatOn stores messages on the DeSo blockchain and requires no phone number. Signal uses the Signal Protocol with forward secrecy — a stronger cryptographic model. ChatOn uses ECDH + AES-128-CTR, which is simpler but means your messages are decentralized and portable. Choose Signal for the strongest encryption guarantees. Choose ChatOn if you want decentralized storage and no phone number requirement.",
  },
  {
    name: "ChatOn vs Telegram",
    content:
      "Telegram does not encrypt messages by default. Only opt-in 'Secret Chats' between two people use end-to-end encryption — group chats are never end-to-end encrypted. Telegram runs on centralized servers owned by one company. ChatOn encrypts every message by default, including group chats, and stores them on the DeSo blockchain. Choose Telegram for its massive user base and feature set. Choose ChatOn if you want encryption by default and decentralized message storage.",
  },
  {
    name: "ChatOn vs WhatsApp",
    content:
      "WhatsApp uses the Signal Protocol for end-to-end encryption, which includes forward secrecy. However, WhatsApp is owned by Meta, requires a phone number, stores metadata on centralized servers, and its privacy policy has changed multiple times. ChatOn stores encrypted messages on a blockchain, requires no phone number, and has no company that can change privacy terms. Choose WhatsApp for the largest user base. Choose ChatOn if you want decentralized ownership of your messages.",
  },
  {
    name: "ChatOn vs Session",
    content:
      "Session and ChatOn both offer end-to-end encryption without requiring a phone number. Session routes messages through an onion network (Lokinet) for metadata protection. ChatOn stores messages on the DeSo blockchain for persistence and portability. Session provides stronger metadata privacy. ChatOn provides faster message delivery, richer features (GIFs, reactions, community directory), and chat history that survives across apps. Choose Session for maximum metadata privacy. Choose ChatOn for a fuller messaging experience with portable history.",
  },
];

export const ComparePage = () => {
  usePageMeta({
    title: "Compare Messaging Apps — ChatOn vs Signal vs Telegram vs WhatsApp",
    description:
      "Honest feature comparison of ChatOn, Signal, Telegram, WhatsApp, and Session. See how decentralized encrypted messaging compares to centralized alternatives.",
    path: "/compare",
  });

  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "power3.out", duration: 0.8 },
        });

        tl.from(".cmp-badge", { y: -20, autoAlpha: 0, duration: 0.6 })
          .from(".cmp-title", { y: 40, autoAlpha: 0, duration: 1 }, "<0.1")
          .from(".cmp-subtitle", { y: 20, autoAlpha: 0 }, "<0.15")
          .from(".cmp-table", { y: 30, autoAlpha: 0, duration: 0.7 }, "<0.2")
          .from(
            ".cmp-summary",
            {
              y: 20,
              autoAlpha: 0,
              stagger: 0.08,
              duration: 0.6,
            },
            "<0.1"
          )
          .from(".cmp-cta", { y: 20, autoAlpha: 0 }, "<0.1");
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          ".cmp-badge, .cmp-title, .cmp-subtitle, .cmp-table, .cmp-summary, .cmp-cta",
          { autoAlpha: 1, y: 0 }
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
      <div className="landing-orb w-[800px] h-[800px] bg-[#34F080] -top-[200px] -left-[300px] opacity-[0.06]" />
      <div className="landing-orb w-[600px] h-[600px] bg-[#20E0AA] top-[30%] right-[-200px] opacity-[0.05]" />
      <div className="landing-orb w-[700px] h-[700px] bg-[#40B8E0] bottom-[-100px] left-[20%] opacity-[0.04]" />

      <PublicNav />

      <main className="relative pt-28 md:pt-36 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10 md:mb-14">
            <div className="cmp-badge inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#34F080]/8 border border-[#34F080]/20 text-[#34F080] text-[10px] font-black tracking-[0.3em] uppercase mb-6">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Compare
            </div>

            <h1 className="cmp-title text-4xl md:text-7xl font-black leading-[0.95] tracking-tight mb-6 md:mb-8">
              How ChatOn{" "}
              <span className="landing-text-logo-gradient">compares.</span>
            </h1>

            <p className="cmp-subtitle text-base md:text-xl text-gray-400 font-medium leading-relaxed max-w-2xl mx-auto">
              An honest look at how ChatOn stacks up against Signal, Telegram,
              WhatsApp, and Session. Every app makes tradeoffs — here are ours.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="cmp-table mb-16 md:mb-20 overflow-x-auto -mx-4 md:mx-0">
            <div className="min-w-[640px] px-4 md:px-0">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider py-4 pr-4 w-[28%]">
                      Feature
                    </th>
                    <th className="text-center text-xs font-bold text-[#34F080] uppercase tracking-wider py-4 px-2 w-[14.4%]">
                      ChatOn
                    </th>
                    <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider py-4 px-2 w-[14.4%]">
                      Signal
                    </th>
                    <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider py-4 px-2 w-[14.4%]">
                      Telegram
                    </th>
                    <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider py-4 px-2 w-[14.4%]">
                      WhatsApp
                    </th>
                    <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider py-4 px-2 w-[14.4%]">
                      Session
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_DATA.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={`border-b border-white/5 ${
                        i % 2 === 0 ? "bg-white/[0.01]" : ""
                      }`}
                    >
                      <td className="text-xs md:text-sm text-gray-300 py-3.5 pr-4">
                        {row.feature}
                      </td>
                      <td className="text-center py-3.5 px-2 bg-[#34F080]/[0.03]">
                        <CellValue value={row.chatOn} />
                      </td>
                      <td className="text-center py-3.5 px-2">
                        <CellValue value={row.signal} />
                      </td>
                      <td className="text-center py-3.5 px-2">
                        <CellValue value={row.telegram} />
                      </td>
                      <td className="text-center py-3.5 px-2">
                        <CellValue value={row.whatsapp} />
                      </td>
                      <td className="text-center py-3.5 px-2">
                        <CellValue value={row.session} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed comparisons */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-8">
              Detailed comparisons
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {APP_SUMMARIES.map(({ name, content }) => (
                <div
                  key={name}
                  className="cmp-summary landing-glass-card rounded-2xl p-6 border-white/5"
                >
                  <h3 className="text-sm font-bold mb-3">{name}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom note */}
          <p className="cmp-summary text-xs text-gray-600 text-center mb-10 max-w-2xl mx-auto leading-relaxed">
            This comparison reflects our understanding as of April 2026.
            Features change — if you spot an inaccuracy,{" "}
            <a
              href="https://github.com/sungkhum/chaton/issues"
              target="_blank"
              rel="noreferrer"
              className="text-gray-500 hover:text-[#34F080] transition-colors"
            >
              let us know on GitHub
            </a>
            .
          </p>

          {/* CTA */}
          <div className="cmp-cta text-center">
            <button
              onClick={() => identity.login()}
              className="px-8 py-3.5 rounded-xl landing-btn-vivid text-white text-sm font-bold cursor-pointer"
            >
              Try ChatOn
            </button>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default ComparePage;
