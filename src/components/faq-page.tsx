import { useLayoutEffect, useRef, useState } from "react";
import { identity } from "deso-protocol";
import { usePageMeta } from "../hooks/usePageMeta";
import { ChevronDown, HelpCircle } from "lucide-react";
import gsap from "gsap";
import { PublicNav, PublicFooter } from "./public-layout";

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What is ChatOn?",
    a: "ChatOn is a free, open-source messaging app that stores encrypted messages on the DeSo blockchain instead of company servers. It works as a progressive web app — open getchaton.com in any browser, or install it to your home screen for a native app experience. No app store download required.",
  },
  {
    q: "How does ChatOn encrypt messages?",
    a: "Every message is end-to-end encrypted by default using ECDH key exchange and AES-128-CTR encryption. Your messages are encrypted on your device before they leave it. The DeSo blockchain only ever stores ciphertext that no one — not ChatOn, not node operators, not anyone — can read without your keys.",
  },
  {
    q: "Does ChatOn require a phone number?",
    a: "No. ChatOn does not require a phone number, email address, or any personal information to sign up. You create a DeSo account using a seed phrase, a Google account, or a MetaMask wallet. A simple CAPTCHA during signup gives you free starter DESO tokens to begin messaging immediately.",
  },
  {
    q: "Is ChatOn free to use?",
    a: "ChatOn is free to download and use. Each message is a blockchain transaction that costs roughly $0.000017 — far less than one-hundredth of a penny. The free starter DESO you receive during signup covers thousands of messages. There are no subscription fees, no ads, and no premium tiers. When you send tips of $0.10 or more, a 10% platform fee supports ongoing development.",
  },
  {
    q: "Does ChatOn take a fee on tips?",
    a: "Tips under $0.10 go entirely to the recipient with no fee. For tips of $0.10 or more, a 10% platform fee is applied to support ChatOn development. For example, on a $5 tip, $4.50 goes to the recipient and $0.50 goes to ChatOn. A tiny DeSo network fee (fractions of a penny) also applies to all on-chain transactions, including tips. The ChatOn fee is clearly disclosed before you confirm every tip, and both transfers are sent in a single atomic transaction on-chain — transparent and verifiable by anyone.",
  },
  {
    q: "Where are my messages stored?",
    a: "Your messages are stored as encrypted transactions on the DeSo blockchain — a public, permissionless network that anyone can run a node on. Only encrypted ciphertext is stored on-chain. No company server holds your messages, which means there is no single point of failure and no single entity that can shut down access.",
  },
  {
    q: "Can anyone read my messages on the blockchain?",
    a: "No. While the DeSo blockchain is public, your message content is encrypted before it reaches the chain. What the blockchain stores is ciphertext — scrambled data that only you and your intended recipients can decrypt with your private keys. Think of it as a locked mailbox on a public street: everyone can see the mailbox exists, but only you have the key.",
  },
  {
    q: "What happens to my messages if ChatOn shuts down?",
    a: "Your messages survive because they live on the DeSo blockchain, not on ChatOn's servers. Any DeSo-compatible messaging app can access the same on-chain conversations. Your chat history is portable — it belongs to you, not to any single app. Core message content will transfer to other DeSo clients, though app-specific features like reactions and reply previews may display differently across apps.",
  },
  {
    q: "Does ChatOn have group chats?",
    a: "Yes. ChatOn supports encrypted group chats using DeSo Access Groups. When you create a group, each member receives a copy of the group encryption key that's individually encrypted to their own public key. Groups include admin controls for adding and removing members, renaming the group, and setting a group image.",
  },
  {
    q: "What features does ChatOn have?",
    a: "ChatOn includes encrypted DMs and group chats, emoji reactions, GIFs and stickers via Klipy, image and video sharing, encrypted link sharing for files hosted on services like Google Drive, reply threads, push notifications, a public community directory for discovering group chats, and unread message badges. All message content — including media URLs, reactions, and shared links — is encrypted by default.",
  },
  {
    q: "How is ChatOn different from Signal?",
    a: "Both ChatOn and Signal offer end-to-end encryption, but they take fundamentally different approaches. Signal stores messages on centralized servers and requires a phone number. ChatOn stores messages on a decentralized blockchain and requires no phone number. If Signal's servers go down or the organization shuts down, your messages go with it. ChatOn messages persist on-chain regardless of what happens to the app. The tradeoff: Signal uses the Signal Protocol with forward secrecy, while ChatOn uses a simpler ECDH + AES scheme.",
  },
  {
    q: "How is ChatOn different from Telegram?",
    a: "Telegram does not encrypt messages by default — only opt-in 'Secret Chats' between two people are end-to-end encrypted, and group chats are never end-to-end encrypted. ChatOn encrypts every message by default, including group chats. Telegram runs on centralized servers controlled by one company. ChatOn stores messages on the DeSo blockchain, where no single entity has control over the data.",
  },
  {
    q: "What is DeSo?",
    a: "DeSo is a public, open-source blockchain purpose-built for social applications like messaging and social media. It is designed to store large amounts of data cheaply — about $0.000002 per message. Anyone can run a DeSo node, and the network is governed by its validator set through on-chain voting. Development is led by the DeSo Foundation, an organization focused on building decentralized social infrastructure.",
  },
  {
    q: "Do I need cryptocurrency to use ChatOn?",
    a: "You need a tiny amount of DESO tokens to cover transaction fees, but you don't need to buy any. During signup, you complete a simple CAPTCHA to receive free starter DESO — enough for thousands of messages. You do not need a crypto wallet, exchange account, or any prior crypto experience to start chatting.",
  },
  {
    q: "How does tipping work in ChatOn?",
    a: "You can send DESO or USDC tips to anyone in a conversation. Tips are delivered in a single atomic transaction — the payment and any tip message are bundled together so they either both succeed or both fail. Tips under $0.10 have zero platform fees. Tips of $0.10 or more include a 10% platform fee that supports ChatOn development.",
  },
  {
    q: "What are paid DMs?",
    a: 'Paid DMs let you set a price for messages from new contacts. When someone you haven\'t chatted with sends you a message, their payment is bundled with the message in a single atomic transaction. Once you reply, the conversation becomes free. You can also set a "free pass" filter — for example, requiring senders to have a DeSo profile or a minimum DESO balance — so qualified senders can message you without paying.',
  },
  {
    q: "How does the spam filter work?",
    a: "ChatOn classifies incoming messages using on-chain data — no backend required. Messages from existing contacts go straight to your Chats tab. Messages from new senders land in Requests. You can set additional filters like requiring a minimum DESO balance or a verified DeSo profile. Senders who meet your criteria are auto-approved; everyone else stays in Requests until you accept or dismiss them.",
  },
  {
    q: "Can ChatOn translate messages automatically?",
    a: "Yes. ChatOn detects the language of each message when it's sent and can auto-translate messages into your preferred language in real-time. Translation happens client-side and uses a free, privacy-respecting API. You can also manually translate any individual message from the context menu.",
  },
  {
    q: "How do group invite links work?",
    a: "Group owners can generate a shareable invite link with a short code. Anyone with the link can preview the group and request to join. Owners can also list their group in the public community directory so anyone can discover and join it. Invite links can be revoked and regenerated at any time.",
  },
  {
    q: "Is ChatOn open source?",
    a: "Yes. ChatOn's entire codebase is publicly available on GitHub at github.com/sungkhum/chaton. Anyone can inspect the code, verify how encryption works, report issues, or contribute improvements. Open source means you don't have to take our word for it — you can check for yourself.",
  },
  {
    q: "Can I install ChatOn on my phone?",
    a: "Yes. ChatOn is a progressive web app (PWA) that works on any device with a modern browser. On iPhone, open getchaton.com in Safari and tap Share then 'Add to Home Screen.' On Android, Chrome will prompt you to install it automatically. Once installed, it looks and feels like a native app — with push notifications, full-screen mode, and offline support.",
  },
];

// JSON-LD structured data for FAQPage schema
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: {
      "@type": "Answer",
      text: a,
    },
  })),
};

const FaqItem = ({ q, a, index }: { q: string; a: string; index: number }) => {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={`faq-item border-b border-white/5 ${
        index === 0 ? "border-t" : ""
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-5 md:py-6 text-left cursor-pointer group"
        aria-expanded={open}
      >
        <h3 className="text-sm md:text-base font-bold text-white group-hover:text-[#34F080] transition-colors pr-4">
          {q}
        </h3>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: open ? contentRef.current?.scrollHeight + "px" : "0px",
        }}
      >
        <p className="text-sm md:text-base text-gray-400 leading-relaxed pb-5 md:pb-6 pr-8">
          {a}
        </p>
      </div>
    </div>
  );
};

export const FaqPage = () => {
  usePageMeta({
    title: "FAQ — ChatOn",
    description:
      "Frequently asked questions about ChatOn — the free, decentralized, end-to-end encrypted messaging app built on the DeSo blockchain.",
    path: "/faq",
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

        tl.from(".faq-badge", { y: -20, autoAlpha: 0, duration: 0.6 })
          .from(".faq-title", { y: 40, autoAlpha: 0, duration: 1 }, "<0.1")
          .from(".faq-subtitle", { y: 20, autoAlpha: 0 }, "<0.15")
          .from(
            ".faq-item",
            {
              y: 20,
              autoAlpha: 0,
              stagger: 0.05,
              duration: 0.6,
            },
            "<0.2"
          )
          .from(".faq-cta", { y: 20, autoAlpha: 0 }, "<0.1");
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".faq-badge, .faq-title, .faq-subtitle, .faq-item, .faq-cta", {
          autoAlpha: 1,
          y: 0,
        });
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={root}
      className="min-h-screen bg-[#0F1520] text-white selection:bg-[#34F080]/30 selection:text-white relative overflow-hidden"
    >
      {/* FAQPage structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Atmospheric orbs */}
      <div className="landing-orb w-[800px] h-[800px] bg-[#34F080] -top-[200px] -left-[300px] opacity-[0.06]" />
      <div className="landing-orb w-[600px] h-[600px] bg-[#20E0AA] top-[30%] right-[-200px] opacity-[0.05]" />
      <div className="landing-orb w-[700px] h-[700px] bg-[#40B8E0] bottom-[-100px] left-[20%] opacity-[0.04]" />

      <PublicNav />

      <main className="relative pt-28 md:pt-36 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10 md:mb-14">
            <div className="faq-badge inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#34F080]/8 border border-[#34F080]/20 text-[#34F080] text-[10px] font-black tracking-[0.3em] uppercase mb-6">
              <HelpCircle className="w-3.5 h-3.5" />
              FAQ
            </div>

            <h1 className="faq-title text-4xl md:text-7xl font-black leading-[0.95] tracking-tight mb-6 md:mb-8">
              Frequently asked{" "}
              <span className="landing-text-logo-gradient">questions.</span>
            </h1>

            <p className="faq-subtitle text-base md:text-xl text-gray-400 font-medium leading-relaxed max-w-2xl mx-auto">
              Everything you need to know about ChatOn, encryption, and
              decentralized messaging.
            </p>
          </div>

          {/* FAQ List */}
          <div className="mb-12 md:mb-16">
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} index={i} />
            ))}
          </div>

          {/* CTA */}
          <div className="faq-cta text-center">
            <p className="text-sm text-gray-500 mb-4">Still have questions?</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://github.com/sungkhum/chaton/issues"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-gray-300 hover:text-white hover:border-white/20 transition-all"
              >
                Ask on GitHub
              </a>
              <button
                onClick={() => identity.login()}
                className="px-6 py-3 rounded-xl landing-btn-vivid text-white text-sm font-bold cursor-pointer"
              >
                Start Messaging
              </button>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default FaqPage;
