import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sendDeso, identity } from "deso-protocol";
import { toast } from "sonner";
import { CircleDollarSign, Sparkles, X, Loader2 } from "lucide-react";
import { AppUser } from "../store";
import { desoNanosToDeso } from "../utils/helpers";
import { withAuth } from "../utils/with-auth";
import {
  fetchExchangeRate,
  usdToNanos,
  nanosToUsd,
  formatUsd,
} from "../utils/exchange-rate";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";

const PRESET_AMOUNTS_USD = [0.01, 0.25, 1, 5] as const;

// Confirmation tier thresholds (USD)
const MEDIUM_THRESHOLD = 5;
const LARGE_THRESHOLD = 20;

// Activation delay to prevent accidental taps (ms)
const ACTIVATION_DELAY_MS = 500;

// Double-tap confirmation timeout (ms)
const CONFIRM_TIMEOUT_MS = 5000;

interface TipConfirmDialogProps {
  appUser: AppUser;
  recipientPublicKey: string;
  recipientUsername?: string;
  /** TimestampNanosString of the message being tipped (super-reaction). */
  tipReplyTo?: string;
  onClose: () => void;
  /** Called after a successful tip with the ExtraData fields to attach to the chat message. */
  onTipSent: (tipData: {
    amountNanos: number;
    txHash: string;
    recipientPublicKey: string;
    recipientUsername?: string;
    tipReplyTo?: string;
    message?: string;
  }) => void;
}

export const TipConfirmDialog = ({
  appUser,
  recipientPublicKey,
  recipientUsername,
  tipReplyTo,
  onClose,
  onTipSent,
}: TipConfirmDialogProps) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [tipMessage, setTipMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  // Activation delay state
  const [activated, setActivated] = useState(false);

  // Double-tap confirmation state (medium tier)
  const [confirmArmed, setConfirmArmed] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Large-tier: checkbox confirmation instead of hold-to-confirm (accessible)
  const [largeConfirmChecked, setLargeConfirmChecked] = useState(false);

  // Focus trap ref
  const dialogRef = useRef<HTMLDivElement>(null);

  const activeAmount = isCustom ? parseFloat(customAmount) || 0 : selectedAmount;
  const amountNanos =
    exchangeRate != null ? usdToNanos(activeAmount, exchangeRate) : 0;
  const balance = desoNanosToDeso(appUser.BalanceNanos);
  const balanceUsd =
    exchangeRate != null ? nanosToUsd(appUser.BalanceNanos, exchangeRate) : null;
  const afterTipUsd =
    balanceUsd != null ? balanceUsd - activeAmount : null;
  const desoEquivalent =
    exchangeRate != null && activeAmount > 0
      ? (activeAmount * 100) / exchangeRate
      : 0;
  const canSend =
    activated &&
    activeAmount >= 0.01 &&
    amountNanos > 0 &&
    amountNanos <= appUser.BalanceNanos &&
    !sending;

  // Determine confirmation tier
  const tier =
    activeAmount >= LARGE_THRESHOLD
      ? "large"
      : activeAmount >= MEDIUM_THRESHOLD
        ? "medium"
        : "small";

  // Fetch exchange rate on mount (empty deps — fire once)
  useEffect(() => {
    fetchExchangeRate().then(setExchangeRate).catch(() => {
      toast.error("Could not fetch exchange rate. Please try again.");
      onClose();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Activation delay
  useEffect(() => {
    const timer = setTimeout(() => setActivated(true), ACTIVATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Escape key handler + focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) {
        onClose();
        return;
      }
      // Focus trap: Tab cycles within dialog
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, sending]);

  // Auto-focus dialog on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  // Reset confirmation state when amount changes
  useEffect(() => {
    setConfirmArmed(false);
    setLargeConfirmChecked(false);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, [activeAmount]);

  const executeTip = useCallback(async () => {
    if (!canSend) return;
    setSending(true);

    try {
      const hasPerms = identity.hasPermissions({
        GlobalDESOLimit: amountNanos,
        TransactionCountLimitMap: { BASIC_TRANSFER: 1 },
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

      const result = await withAuth(() =>
        sendDeso({
          SenderPublicKeyBase58Check: appUser.PublicKeyBase58Check,
          RecipientPublicKeyOrUsername: recipientPublicKey,
          AmountNanos: amountNanos,
          MinFeeRateNanosPerKB: 1000,
        })
      );

      const txHash =
        (result as any)?.TxnHashHex ||
        (result as any)?.TransactionIDBase58Check ||
        "";

      setSent(true);
      onTipSent({
        amountNanos,
        txHash,
        recipientPublicKey,
        recipientUsername,
        tipReplyTo,
        message: tipMessage || undefined,
      });

      // Auto-close after 1.5s
      setTimeout(onClose, 1500);
    } catch (error: any) {
      const msg = error?.message || error?.toString?.() || "";
      if (msg.includes("user cancelled") || msg.includes("WINDOW_CLOSED")) {
        toast.error("Transaction cancelled.");
      } else {
        toast.error("Tip failed. Your balance was not charged.");
        console.error("Tip error:", error);
      }
    } finally {
      setSending(false);
    }
  }, [
    canSend,
    amountNanos,
    appUser.PublicKeyBase58Check,
    recipientPublicKey,
    recipientUsername,
    tipReplyTo,
    tipMessage,
    onTipSent,
    onClose,
  ]);

  const handleSendClick = useCallback(() => {
    if (!canSend) return;

    if (tier === "small") {
      executeTip();
    } else if (tier === "medium") {
      if (confirmArmed) {
        executeTip();
      } else {
        setConfirmArmed(true);
        confirmTimerRef.current = setTimeout(() => {
          setConfirmArmed(false);
        }, CONFIRM_TIMEOUT_MS);
      }
    } else if (tier === "large") {
      if (largeConfirmChecked) {
        executeTip();
      }
    }
  }, [canSend, tier, confirmArmed, largeConfirmChecked, executeTip]);

  const displayName = recipientUsername
    ? `@${recipientUsername}`
    : `${recipientPublicKey.slice(0, 8)}...`;

  // After-tip balance color
  const afterTipColor =
    afterTipUsd == null
      ? "text-gray-400"
      : afterTipUsd > 1
        ? "text-[#34F080]"
        : afterTipUsd > 0.1
          ? "text-amber-400"
          : "text-red-400";

  // Send button styling and text
  const getButtonContent = () => {
    if (sending) {
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Sending...
        </span>
      );
    }
    if (tier === "medium" && confirmArmed) {
      return `Confirm ${formatUsd(activeAmount)}`;
    }
    if (tier === "large" && !largeConfirmChecked) {
      return `Check the box above to confirm`;
    }
    return `Tip ${formatUsd(activeAmount)} to ${displayName}`;
  };

  const getButtonClasses = () => {
    const base =
      "w-full py-3 rounded-xl text-sm font-bold transition-all cursor-pointer relative overflow-hidden";
    if (!canSend || (tier === "large" && !largeConfirmChecked))
      return `${base} bg-white/5 text-gray-500 cursor-not-allowed`;
    if (tier === "medium" && confirmArmed)
      return `${base} bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30`;
    return `${base} bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black hover:shadow-[0_0_30px_rgba(52,240,128,0.3)] active:scale-[0.98]`;
  };

  if (exchangeRate == null) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Loading tip dialog"
          className="bg-[#050e1d] text-blue-100 border border-blue-900/60 w-[92%] max-w-[420px] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-8 flex flex-col items-center justify-center gap-3"
        >
          <Loader2 className="w-6 h-6 animate-spin text-[#34F080]" />
          <span className="text-gray-500 text-xs">Loading exchange rate...</span>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Send tip to ${displayName}`}
        tabIndex={-1}
        className="bg-[#050e1d] text-blue-100 border border-blue-900/60 w-[92%] max-w-[420px] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient bar */}
        <div className="h-1 bg-gradient-to-r from-[#34F080] via-[#20E0AA] to-[#40B8E0]" />

        {sent ? (
          /* Success state */
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#34F080]/10 border border-[#34F080]/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-[#34F080]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Tip sent!</h3>
            <p className="text-gray-400 text-sm mb-1">
              You tipped{" "}
              <span className="text-[#34F080] font-semibold">
                {formatUsd(activeAmount)}
              </span>{" "}
              to {displayName}
            </p>
            <p className="text-gray-600 text-xs mb-6">
              {desoEquivalent.toFixed(4)} DESO sent on-chain
            </p>
            <button
              onClick={onClose}
              className="px-8 py-2.5 bg-[#34F080]/10 border border-[#34F080]/30 text-[#34F080] font-semibold rounded-lg hover:bg-[#34F080]/20 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          /* Main tip form */
          <>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <CircleDollarSign className="w-5 h-5 text-[#34F080]" />
                <h3 className="text-lg font-bold text-white">Send Tip</h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Close tip dialog"
                className="text-gray-500 hover:text-white transition-colors p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pb-5">
              {/* Recipient */}
              <div className="flex items-center gap-3 mb-5">
                <MessagingDisplayAvatar
                  publicKey={recipientPublicKey}
                  username={recipientUsername}
                  diameter={40}
                />
                <div>
                  <p className="text-white font-semibold text-sm">
                    {displayName}
                  </p>
                  <p className="text-gray-500 text-xs">Tip recipient</p>
                </div>
              </div>

              {/* Preset amounts */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {PRESET_AMOUNTS_USD.map((amount) => {
                  const active = !isCustom && selectedAmount === amount;
                  return (
                    <button
                      key={amount}
                      aria-label={`Tip ${formatUsd(amount)}`}
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
                      {formatUsd(amount)}
                    </button>
                  );
                })}
              </div>

              {/* Custom amount */}
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 mb-3 transition-colors ${
                  isCustom
                    ? "border-[#34F080]/50 bg-[#34F080]/5"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <span className="text-gray-400 text-sm font-semibold">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  aria-label="Custom tip amount in USD"
                  placeholder="Custom amount"
                  value={customAmount}
                  onFocus={() => setIsCustom(true)}
                  onChange={(e) => {
                    setIsCustom(true);
                    setCustomAmount(e.target.value);
                  }}
                  className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-gray-500 text-xs font-semibold">USD</span>
              </div>

              {/* DESO equivalent */}
              {activeAmount > 0 && (
                <div className="text-xs text-gray-500 mb-3">
                  ≈ {desoEquivalent.toFixed(4)} DESO
                </div>
              )}

              {/* Optional message */}
              <textarea
                placeholder="Add a message (optional)"
                aria-label="Tip message"
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                rows={2}
                className="w-full bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none resize-none mb-4 focus:border-[#34F080]/50"
              />

              {/* Balance info */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Your balance</span>
                <span className="font-semibold text-gray-400">
                  {balanceUsd != null ? formatUsd(balanceUsd) : "..."} (
                  {balance.toFixed(4)} DESO)
                </span>
              </div>
              {activeAmount > 0 && afterTipUsd != null && (
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>After tip</span>
                  <span className={`font-semibold ${afterTipColor}`}>
                    {formatUsd(Math.max(0, afterTipUsd))}
                  </span>
                </div>
              )}

              {/* Insufficient balance warning */}
              {activeAmount > 0 &&
                balanceUsd != null &&
                activeAmount > balanceUsd && (
                  <div className="text-xs text-red-400/80 mb-3 text-center">
                    Insufficient balance for this amount.
                  </div>
                )}

              {/* Large amount confirmation checkbox (accessible alternative to hold-to-confirm) */}
              {tier === "large" && (
                <label className="flex items-start gap-2.5 mb-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={largeConfirmChecked}
                    onChange={(e) => setLargeConfirmChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-amber-500 shrink-0"
                  />
                  <span className="text-xs text-amber-400/80">
                    I confirm I want to send{" "}
                    <span className="font-semibold">{formatUsd(activeAmount)}</span>{" "}
                    ({desoEquivalent.toFixed(4)} DESO) to {displayName}
                  </span>
                </label>
              )}

              {/* Send button */}
              <button
                onClick={handleSendClick}
                disabled={!canSend || (tier === "large" && !largeConfirmChecked)}
                aria-label={`Send ${formatUsd(activeAmount)} tip to ${displayName}`}
                className={getButtonClasses()}
              >
                <span className="relative z-10">{getButtonContent()}</span>
              </button>

              <p className="text-[10px] text-gray-600 text-center mt-3">
                Sent directly on-chain via DeSo
              </p>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
