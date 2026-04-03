import { useLayoutEffect, useRef, useState } from "react";
import { identity, sendDeso } from "deso-protocol";
import { usePageMeta } from "../hooks/usePageMeta";
import { Heart, ArrowRight, Sparkles } from "lucide-react";
import gsap from "gsap";
import { toast } from "sonner";
import { AppUser, useStore } from "../store";
import { CHATON_DONATION_PUBLIC_KEY } from "../utils/constants";
import { desoNanosToDeso } from "../utils/helpers";
import { withAuth } from "../utils/with-auth";
import { PublicNav, PublicFooter } from "./public-layout";

const PRESET_AMOUNTS = [0.1, 0.5, 1, 5] as const;

/*
 * ChatOn logo palette:
 *   #34F080  Green
 *   #20E0AA  Teal
 *   #40B8E0  Steel blue
 *   #3090D0  Deep blue
 */

export const SupportPage = () => {
  usePageMeta({
    title: "Support ChatOn — Keep Decentralized Messaging Alive",
    description:
      "ChatOn is free, open-source, and costs $0/month to run. No ads. No data harvesting. Support the project with a $DESO tip.",
    path: "/support",
  });

  const appUser = useStore((s) => s.appUser);
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "power3.out", duration: 0.8 },
        });

        tl.from(".sp-badge", { y: -20, autoAlpha: 0, duration: 0.6 })
          .from(".sp-title", { y: 40, autoAlpha: 0, duration: 1 }, "<0.1")
          .from(".sp-subtitle", { y: 20, autoAlpha: 0 }, "<0.15")
          .from(".sp-donate", { y: 40, autoAlpha: 0, duration: 0.9 }, "<0.2")
          .from(".sp-footer-text", { y: 10, autoAlpha: 0 }, "<0.2");
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          ".sp-badge, .sp-title, .sp-subtitle, .sp-donate, .sp-footer-text",
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
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 md:mb-10">
            <div className="sp-badge inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#34F080]/8 border border-[#34F080]/20 text-[#34F080] text-[10px] font-black tracking-[0.3em] uppercase mb-6">
              <Heart className="w-3.5 h-3.5" />
              Support Open Source
            </div>

            <h1 className="sp-title text-4xl md:text-7xl font-black leading-[0.95] tracking-tight mb-6 md:mb-8">
              Keep decentralized{" "}
              <span className="landing-text-logo-gradient">
                messaging alive.
              </span>
            </h1>

            <p className="sp-subtitle text-base md:text-xl text-gray-400 font-medium leading-relaxed max-w-2xl mx-auto">
              ChatOn is free, open-source, and costs{" "}
              <span className="text-white font-semibold">$0/month</span> to run.
              No ads. No data harvesting. No VC funding. Just a developer
              building messaging that belongs to its users. Your support keeps
              it that way.
            </p>
          </div>

          {/* Donation section */}
          <div className="sp-donate max-w-md mx-auto">
            {appUser ? (
              <InlineDonationForm appUser={appUser} />
            ) : (
              <LoggedOutCTA />
            )}
          </div>

          {/* Footer text */}
          <p className="sp-footer-text text-center text-xs text-gray-600 mt-10 md:mt-16 max-w-lg mx-auto leading-relaxed">
            All donations are sent directly on-chain to{" "}
            <a
              href="https://focus.xyz/GetChatOn"
              target="_blank"
              rel="noreferrer"
              className="text-gray-500 hover:text-[#34F080] transition-colors"
            >
              @GetChatOn
            </a>{" "}
            via the DeSo blockchain. Transparent and verifiable by anyone.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

/* ── Logged-out CTA ── */
const LoggedOutCTA = () => (
  <div className="landing-glass-card rounded-2xl md:rounded-3xl p-8 md:p-10 text-center border-[#34F080]/10">
    <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-[#34F080]/8 border border-[#34F080]/15 flex items-center justify-center">
      <Heart className="w-6 h-6 text-[#34F080]" />
    </div>
    <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
      Send a tip with $DESO
    </h2>
    <p className="text-sm text-gray-400 mb-6 leading-relaxed max-w-xs mx-auto">
      Log in with your DeSo account to send a tip directly on the blockchain.
      Any amount helps.
    </p>
    <button
      onClick={() => identity.login()}
      className="inline-flex items-center gap-3 px-8 py-4 landing-btn-vivid text-white font-bold rounded-xl group cursor-pointer text-sm"
    >
      Log In to Support ChatOn
      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
    </button>
    <p className="text-[10px] text-gray-600 mt-4">
      Don't have an account? Logging in will create one for free.
    </p>
  </div>
);

/* ── Inline donation form for logged-in users ── */
const InlineDonationForm = ({ appUser }: { appUser: AppUser }) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const activeAmount = isCustom
    ? parseFloat(customAmount) || 0
    : selectedAmount;
  const amountNanos = Math.round(activeAmount * 1e9);
  const balance = desoNanosToDeso(appUser.BalanceNanos);
  const canSend = activeAmount > 0 && activeAmount <= balance && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);

    try {
      const hasPerms = identity.hasPermissions({
        GlobalDESOLimit: amountNanos,
        TransactionCountLimitMap: {
          BASIC_TRANSFER: 1,
        },
      });

      if (!hasPerms) {
        await identity.requestPermissions({
          GlobalDESOLimit: amountNanos + 1e7,
          TransactionCountLimitMap: {
            AUTHORIZE_DERIVED_KEY: 1,
            BASIC_TRANSFER: 1,
          },
        });
      }

      await withAuth(() =>
        sendDeso({
          SenderPublicKeyBase58Check: appUser.PublicKeyBase58Check,
          RecipientPublicKeyOrUsername: CHATON_DONATION_PUBLIC_KEY,
          AmountNanos: amountNanos,
          MinFeeRateNanosPerKB: 1000,
        })
      );

      setSent(true);
      toast.success("Thank you for supporting ChatOn!");
    } catch (error: any) {
      const msg = error?.message || error?.toString?.() || "";
      if (msg.includes("user cancelled") || msg.includes("WINDOW_CLOSED")) {
        toast.error("Transaction cancelled.");
      } else {
        toast.error("Transaction failed. Please try again.");
        console.error("Donation error:", error);
      }
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="landing-glass-card rounded-2xl md:rounded-3xl p-8 md:p-10 text-center border-[#34F080]/15">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#34F080]/10 border border-[#34F080]/20 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-[#34F080]" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Thank you!</h2>
        <p className="text-gray-400 text-sm mb-1">
          You sent{" "}
          <span className="text-[#34F080] font-semibold">
            {activeAmount} $DESO
          </span>{" "}
          to ChatOn.
        </p>
        <p className="text-gray-500 text-xs mb-6">
          Your support keeps decentralized messaging alive.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#34F080]/10 border border-[#34F080]/30 text-[#34F080] font-semibold rounded-lg hover:bg-[#34F080]/20 transition-colors text-sm"
        >
          Back to ChatOn
        </a>
      </div>
    );
  }

  return (
    <div className="landing-glass-card rounded-2xl md:rounded-3xl p-6 md:p-8 border-[#34F080]/10">
      {/* Header gradient bar */}
      <div className="h-0.5 bg-gradient-to-r from-[#34F080] via-[#20E0AA] to-[#40B8E0] rounded-full mb-6" />

      <div className="flex items-center gap-2.5 mb-2">
        <Heart className="w-5 h-5 text-[#34F080]" />
        <h2 className="text-lg font-bold text-white">Send a tip</h2>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        Pick an amount or enter your own. Every bit helps.
      </p>

      {/* Preset amounts */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {PRESET_AMOUNTS.map((amount) => {
          const active = !isCustom && selectedAmount === amount;
          return (
            <button
              key={amount}
              onClick={() => {
                setSelectedAmount(amount);
                setIsCustom(false);
                setCustomAmount("");
              }}
              className={`py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                active
                  ? "bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black shadow-[0_0_20px_rgba(52,240,128,0.2)]"
                  : "bg-white/5 text-gray-300 border border-white/10 hover:border-[#34F080]/40 hover:text-white"
              }`}
            >
              {amount}
            </button>
          );
        })}
      </div>

      {/* Custom amount */}
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 mb-4 transition-colors ${
          isCustom
            ? "border-[#34F080]/50 bg-[#34F080]/5"
            : "border-white/10 bg-white/[0.02]"
        }`}
      >
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          placeholder="Custom amount"
          value={customAmount}
          onFocus={() => setIsCustom(true)}
          onChange={(e) => {
            setIsCustom(true);
            setCustomAmount(e.target.value);
          }}
          className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-gray-500 text-xs font-semibold">DESO</span>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-5">
        <span>Your balance</span>
        <span className="font-semibold text-gray-400">
          {balance.toFixed(4)} $DESO
        </span>
      </div>

      {/* Insufficient balance */}
      {activeAmount > balance && activeAmount > 0 && (
        <div className="text-xs text-red-400/80 mb-3 text-center">
          Insufficient balance for this amount.
        </div>
      )}

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!canSend}
        className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
          canSend
            ? "bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black hover:shadow-[0_0_30px_rgba(52,240,128,0.3)] active:scale-[0.98]"
            : "bg-white/5 text-gray-500 cursor-not-allowed"
        }`}
      >
        {sending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Sending...
          </span>
        ) : (
          `Send ${activeAmount > 0 ? activeAmount : "0"} $DESO`
        )}
      </button>

      <p className="text-[10px] text-gray-600 text-center mt-3">
        Sent directly on-chain to @GetChatOn
      </p>
    </div>
  );
};
