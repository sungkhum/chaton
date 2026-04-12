import { useLayoutEffect, useRef } from "react";
import { identity } from "deso-protocol";
import { usePageMeta } from "../hooks/usePageMeta";
import { PublicNav, PublicFooter } from "./public-layout";
import {
  Lock,
  Globe,
  Users,
  Smartphone,
  Code,
  Shield,
  MessageCircle,
  Smile,
  Image,
  Bell,
  FileText,
  Reply,
  Coins,
  DollarSign,
  Languages,
  Filter,
} from "lucide-react";
import gsap from "gsap";

const FEATURES = [
  {
    icon: Lock,
    title: "End-to-end encryption",
    desc: "Every message is encrypted on your device using ECDH key exchange and AES-128-CTR before it leaves. Only you and your recipients hold the keys.",
  },
  {
    icon: Globe,
    title: "Decentralized storage",
    desc: "Messages are stored as encrypted transactions on the DeSo blockchain. No company server holds your data — no single point of failure.",
  },
  {
    icon: Shield,
    title: "No phone number required",
    desc: "Sign up with a seed phrase, Google account, or MetaMask wallet. No phone number, no email, no personal information required.",
  },
  {
    icon: Users,
    title: "Encrypted group chats",
    desc: "Create group conversations with admin controls. Each member receives an individually encrypted copy of the group key via DeSo Access Groups.",
  },
  {
    icon: Smile,
    title: "Emoji reactions",
    desc: "React to any message with the full emoji set. See who reacted at a glance. Reactions are encrypted along with message content.",
  },
  {
    icon: Image,
    title: "Rich media sharing",
    desc: "Share images, videos, GIFs and stickers via Klipy, and file attachments with link previews. All media URLs are encrypted by default.",
  },
  {
    icon: Reply,
    title: "Reply threads",
    desc: "Reply to specific messages with quoted previews to keep conversations organized and easy to follow.",
  },
  {
    icon: Coins,
    title: "Instant Tips",
    desc: "Send DESO or USDC tips to anyone in a conversation. Atomic transactions ensure instant, verifiable delivery with zero fees on tips under $0.10.",
  },
  {
    icon: DollarSign,
    title: "Paid DMs",
    desc: "Set a price for new DMs from people outside your conversations. Payment is bundled with the first message in a single atomic transaction. Reply once and the conversation is free.",
  },
  {
    icon: Languages,
    title: "Auto-Translation",
    desc: "Messages are automatically translated to your preferred language in real-time. Language detection happens at send time, and translation runs client-side.",
  },
  {
    icon: Filter,
    title: "Spam Filtering",
    desc: "Set custom filters — minimum DESO balance, verified profile — to control who reaches your inbox. Classification uses on-chain data with no backend.",
  },
  {
    icon: Bell,
    title: "Push notifications",
    desc: "Two-layer notification system: instant relay push when the sender is online, plus blockchain polling as backup. You never miss a message.",
  },
  {
    icon: MessageCircle,
    title: "Community directory",
    desc: "Browse and join public group chats through the community directory. Find conversations about topics you care about.",
  },
  {
    icon: Smartphone,
    title: "Works everywhere",
    desc: "Install ChatOn from any browser — no app store required. Works on iPhone, Android, desktop, and tablet with offline support.",
  },
  {
    icon: FileText,
    title: "Portable chat history",
    desc: "Your messages live on the blockchain, not on our servers. Any DeSo-compatible messaging app can access the same conversations.",
  },
  {
    icon: Code,
    title: "Open source",
    desc: "The full codebase is on GitHub. Inspect the encryption, verify claims, report issues, or contribute improvements.",
  },
];

export const AboutPage = () => {
  usePageMeta({
    title: "About ChatOn — Decentralized Encrypted Messaging on DeSo",
    description:
      "ChatOn is a free, open-source, decentralized messaging app built on the DeSo blockchain. End-to-end encrypted. No phone number required. No company servers.",
    path: "/about",
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

        tl.from(".about-badge", { y: -20, autoAlpha: 0, duration: 0.6 })
          .from(".about-title", { y: 40, autoAlpha: 0, duration: 1 }, "<0.1")
          .from(".about-intro", { y: 20, autoAlpha: 0 }, "<0.15")
          .from(
            ".about-section",
            {
              y: 30,
              autoAlpha: 0,
              stagger: 0.1,
              duration: 0.7,
            },
            "<0.2"
          )
          .from(
            ".about-feature",
            {
              y: 20,
              autoAlpha: 0,
              stagger: 0.04,
              duration: 0.5,
            },
            "<0.1"
          );
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          ".about-badge, .about-title, .about-intro, .about-section, .about-feature",
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
      <div className="landing-orb w-[600px] h-[600px] bg-[#20E0AA] top-[40%] right-[-200px] opacity-[0.05]" />
      <div className="landing-orb w-[700px] h-[700px] bg-[#40B8E0] bottom-[-100px] left-[20%] opacity-[0.04]" />

      <PublicNav />

      <main className="relative pt-28 md:pt-36 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 md:mb-16">
            <div className="about-badge inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#34F080]/8 border border-[#34F080]/20 text-[#34F080] text-[10px] font-black tracking-[0.3em] uppercase mb-6">
              <MessageCircle className="w-3.5 h-3.5" />
              About ChatOn
            </div>

            <h1 className="about-title text-4xl md:text-7xl font-black leading-[0.95] tracking-tight mb-6 md:mb-8">
              Messaging that belongs{" "}
              <span className="landing-text-logo-gradient">to you.</span>
            </h1>

            <p className="about-intro text-base md:text-xl text-gray-400 font-medium leading-relaxed max-w-3xl mx-auto">
              ChatOn is a free, open-source messaging app that stores your
              encrypted messages on the DeSo blockchain instead of company
              servers. No phone number. No ads. No single entity that can shut
              it down or read your conversations.
            </p>
          </div>

          {/* How it works */}
          <div className="about-section mb-16 md:mb-20">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3">
              How it works
            </h2>
            <p className="text-sm md:text-base text-gray-400 leading-relaxed mb-8 max-w-2xl">
              Traditional messaging apps store your messages on servers owned by
              one company. ChatOn takes a different approach.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="landing-glass-card rounded-2xl p-6 border-[#34F080]/10">
                <div className="text-2xl font-black text-[#34F080] mb-3">
                  01
                </div>
                <h3 className="text-sm font-bold mb-2">
                  Encrypted on your device
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  When you send a message, it is encrypted on your device before
                  it goes anywhere. Only you and your intended recipients hold
                  the decryption keys.
                </p>
              </div>
              <div className="landing-glass-card rounded-2xl p-6 border-[#34F080]/10">
                <div className="text-2xl font-black text-[#20E0AA] mb-3">
                  02
                </div>
                <h3 className="text-sm font-bold mb-2">
                  Stored on the blockchain
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  The encrypted message is recorded as a transaction on the DeSo
                  blockchain — a public, decentralized network with no single
                  owner. The cost per message is roughly $0.000017.
                </p>
              </div>
              <div className="landing-glass-card rounded-2xl p-6 border-[#34F080]/10">
                <div className="text-2xl font-black text-[#40B8E0] mb-3">
                  03
                </div>
                <h3 className="text-sm font-bold mb-2">
                  Decrypted by the recipient
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Your recipient's device fetches the encrypted transaction from
                  the blockchain and decrypts it locally. No intermediary ever
                  sees the plaintext.
                </p>
              </div>
            </div>
          </div>

          {/* Why decentralized */}
          <div className="about-section mb-16 md:mb-20">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3">
              Why decentralized messaging matters
            </h2>
            <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-2xl">
              When messages live on company servers, that company can be hacked,
              shut down, pressured by governments, or simply change its privacy
              policy. When messages live on a blockchain, there is no single
              point of failure — no server to seize, no company to subpoena, no
              kill switch to flip. Your conversations persist regardless of what
              happens to any single app or organization.
            </p>
          </div>

          {/* Features grid */}
          <div className="about-section mb-16 md:mb-20">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-8">
              Features
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="about-feature landing-glass-card rounded-2xl p-5 border-white/5 hover:border-[#34F080]/20 transition-colors"
                >
                  <Icon className="w-5 h-5 text-[#34F080] mb-3" />
                  <h3 className="text-sm font-bold mb-1.5">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* What it's built on */}
          <div className="about-section mb-16 md:mb-20">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3">
              Built on DeSo
            </h2>
            <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-2xl mb-4">
              DeSo is a public, open-source blockchain designed for social
              applications. Unlike general-purpose blockchains, DeSo is
              optimized for storing social data like messages, posts, and
              profiles at scale — with transaction costs under a fraction of a
              penny. Anyone can run a DeSo node, and the network is governed by
              its validator set through on-chain voting.
            </p>
            <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-2xl">
              ChatOn uses DeSo as its data layer, which means there is no custom
              backend to build, maintain, or pay for. This keeps infrastructure
              costs near zero and ensures that your data is never locked inside
              a proprietary system.
            </p>
          </div>

          {/* Tradeoffs */}
          <div className="about-section mb-12 md:mb-16">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3">
              Honest tradeoffs
            </h2>
            <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-2xl mb-6">
              No tool is perfect for everyone. Here is what you should know
              before choosing ChatOn.
            </p>

            <div className="space-y-4 max-w-2xl">
              <div className="landing-glass-card rounded-xl p-5 border-white/5">
                <h3 className="text-sm font-bold mb-1">Smaller network</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  ChatOn has a smaller user base than WhatsApp, Signal, or
                  Telegram. You may need to invite the people you want to talk
                  to.
                </p>
              </div>
              <div className="landing-glass-card rounded-xl p-5 border-white/5">
                <h3 className="text-sm font-bold mb-1">
                  Simpler encryption model
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  ChatOn uses ECDH + AES-128-CTR encryption, which does not
                  include forward secrecy. The Signal Protocol (used by Signal
                  and WhatsApp) provides stronger cryptographic guarantees at
                  the cost of requiring centralized key servers.
                </p>
              </div>
              <div className="landing-glass-card rounded-xl p-5 border-white/5">
                <h3 className="text-sm font-bold mb-1">
                  Requires a small DESO balance
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Each message costs a fraction of a penny in DESO tokens. Free
                  starter tokens cover thousands of messages, but the balance
                  can eventually run out for very active users.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="about-section text-center">
            <button
              onClick={() => identity.login()}
              className="px-8 py-3.5 rounded-xl landing-btn-vivid text-white text-sm font-bold cursor-pointer"
            >
              Start Messaging
            </button>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-600">
              <a href="/faq" className="hover:text-gray-400 transition-colors">
                Read the FAQ
              </a>
              <a
                href="/compare"
                className="hover:text-gray-400 transition-colors"
              >
                Compare apps
              </a>
              <a
                href="https://github.com/sungkhum/chaton"
                target="_blank"
                rel="noreferrer"
                className="hover:text-gray-400 transition-colors"
              >
                View source
              </a>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default AboutPage;
