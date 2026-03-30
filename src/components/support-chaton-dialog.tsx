import { Fragment, useState } from "react";
import { sendDeso, identity } from "deso-protocol";
import { toast } from "sonner";
import { Heart, Sparkles, X } from "lucide-react";
import { AppUser } from "../store";
import { CHATON_DONATION_PUBLIC_KEY } from "../utils/constants";
import { desoNanosToDeso } from "../utils/helpers";
import { withAuth } from "../utils/with-auth";

const PRESET_AMOUNTS = [0.1, 0.5, 1, 5] as const;

interface SupportChatOnDialogProps {
  appUser: AppUser;
  onClose: () => void;
}

export const SupportChatOnDialog = ({
  appUser,
  onClose,
}: SupportChatOnDialogProps) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const activeAmount = isCustom ? parseFloat(customAmount) || 0 : selectedAmount;
  const amountNanos = Math.round(activeAmount * 1e9);
  const balance = desoNanosToDeso(appUser.BalanceNanos);
  const canSend = activeAmount > 0 && activeAmount <= balance && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);

    try {
      // Check if derived key has enough spending limit, request if needed
      const hasPerms = identity.hasPermissions({
        GlobalDESOLimit: amountNanos,
        TransactionCountLimitMap: {
          BASIC_TRANSFER: 1,
        },
      });

      if (!hasPerms) {
        await identity.requestPermissions({
          GlobalDESOLimit: amountNanos + 1e7, // small buffer for fees
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
      toast.success(`Thank you for supporting ChatOn!`);
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

  return (
    <Fragment>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#050e1d] text-blue-100 border border-blue-900/60 w-[92%] max-w-[420px] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Header gradient bar */}
          <div className="h-1 bg-gradient-to-r from-[#34F080] via-[#20E0AA] to-[#40B8E0]" />

          {sent ? (
            /* ── Success state ── */
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#34F080]/10 border border-[#34F080]/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[#34F080]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Thank you!
              </h3>
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
              <button
                onClick={onClose}
                className="px-8 py-2.5 bg-[#34F080]/10 border border-[#34F080]/30 text-[#34F080] font-semibold rounded-lg hover:bg-[#34F080]/20 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            /* ── Main donation form ── */
            <>
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <Heart className="w-5 h-5 text-[#34F080]" />
                  <h3 className="text-lg font-bold text-white">
                    Support ChatOn
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-white transition-colors p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 pb-5">
                <p className="text-gray-400 text-sm mb-5 leading-relaxed">
                  ChatOn is free, open-source, and runs at $0/month. If you
                  enjoy it, a small tip helps fund development.
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
                        className={`py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                          active
                            ? "bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black shadow-[0_0_20px_rgba(52,240,128,0.2)]"
                            : "bg-white/5 text-gray-300 border border-white/10 hover:border-[#34F080]/40 hover:text-white"
                        }`}
                      >
                        {amount} DESO
                      </button>
                    );
                  })}
                </div>

                {/* Custom amount */}
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 mb-4 transition-colors ${
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
                  <span className="text-gray-500 text-xs font-semibold">
                    DESO
                  </span>
                </div>

                {/* Balance */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-5">
                  <span>Your balance</span>
                  <span className="font-semibold text-gray-400">
                    {balance.toFixed(4)} $DESO
                  </span>
                </div>

                {/* Insufficient balance warning */}
                {activeAmount > balance && activeAmount > 0 && (
                  <div className="text-xs text-red-400/80 mb-3 text-center">
                    Insufficient balance for this amount.
                  </div>
                )}

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
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
            </>
          )}
        </div>
      </div>
    </Fragment>
  );
};
