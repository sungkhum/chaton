import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sendDeso, identity, transferDeSoToken } from "deso-protocol";
import { toast } from "sonner";
import {
  CircleDollarSign,
  Sparkles,
  X,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { AppUser } from "../store";
import { desoNanosToDeso } from "../utils/helpers";
import { withAuth } from "../utils/with-auth";
import {
  fetchExchangeRate,
  usdToNanos,
  nanosToUsd,
  formatUsd,
} from "../utils/exchange-rate";
import {
  fetchUsdcBalance,
  usdcBaseUnitsToUsd,
  usdToUsdcBaseUnits,
  toHexUint256,
  invalidateUsdcBalanceCache,
} from "../utils/usdc-balance";
import { USDC_CREATOR_PUBLIC_KEY, TIP_FEE_RATE } from "../utils/constants";
import {
  hasTipFee,
  tipFeeUsd,
  tipRecipientUsd,
  splitDesoTip,
  splitUsdcTip,
} from "../utils/tip-fees";
import { sendAtomicDesoTip, sendAtomicUsdcTip } from "../utils/atomic-tip";
import {
  cacheTipCurrency,
  getCachedTipCurrency,
} from "../services/cache.service";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { CurrencyToggle } from "./currency-toggle";
import type { TipCurrency } from "../utils/extra-data";

const PRESET_AMOUNTS_USD = [0.01, 0.25, 1, 5] as const;

const MEDIUM_THRESHOLD = 5;
const LARGE_THRESHOLD = 20;
const ACTIVATION_DELAY_MS = 500;
const CONFIRM_TIMEOUT_MS = 5000;

// Minimum DESO needed for DAO coin transfer fees (~0.001 DESO)
const MIN_DESO_FOR_FEES = 1e6;

interface TipConfirmDialogProps {
  appUser: AppUser;
  recipientPublicKey: string;
  recipientUsername?: string;
  tipReplyTo?: string;
  initialAmountUsd?: number;
  onClose: () => void;
  onTipSent: (tipData: {
    amountNanos: number;
    amountUsdcBaseUnits?: string;
    amountUsd: number;
    currency: TipCurrency;
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
  initialAmountUsd,
  onClose,
  onTipSent,
}: TipConfirmDialogProps) => {
  // Currency preference (persisted)
  const [currency, setCurrency] = useState<TipCurrency>(() => {
    return (
      (getCachedTipCurrency(appUser.PublicKeyBase58Check) as TipCurrency) ||
      "DESO"
    );
  });

  const [selectedAmount, setSelectedAmount] = useState<number>(
    initialAmountUsd && PRESET_AMOUNTS_USD.includes(initialAmountUsd as any)
      ? initialAmountUsd
      : 1
  );
  const [customAmount, setCustomAmount] = useState(
    initialAmountUsd && !PRESET_AMOUNTS_USD.includes(initialAmountUsd as any)
      ? String(initialAmountUsd)
      : ""
  );
  const [isCustom, setIsCustom] = useState(
    !!initialAmountUsd && !PRESET_AMOUNTS_USD.includes(initialAmountUsd as any)
  );
  const [tipMessage, setTipMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [showHeroSwap, setShowHeroSwap] = useState(false);
  const [heroSwapForFees, setHeroSwapForFees] = useState(false); // true when opened for DESO fees specifically

  const [activated, setActivated] = useState(false);
  const [confirmArmed, setConfirmArmed] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [largeConfirmChecked, setLargeConfirmChecked] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const activeAmount = isCustom
    ? parseFloat(customAmount) || 0
    : selectedAmount;
  const feeApplies = hasTipFee(activeAmount);
  const feeUsd = tipFeeUsd(activeAmount);
  const recipientUsd = tipRecipientUsd(activeAmount);

  // DESO calculations
  const amountNanos =
    exchangeRate != null ? usdToNanos(activeAmount, exchangeRate) : 0;
  const desoBalanceUsd =
    exchangeRate != null
      ? nanosToUsd(appUser.BalanceNanos, exchangeRate)
      : null;
  const desoEquivalent =
    exchangeRate != null && activeAmount > 0
      ? (activeAmount * 100) / exchangeRate
      : 0;

  // USDC calculations
  const usdcBalanceUsd =
    usdcBalance != null ? usdcBaseUnitsToUsd(usdcBalance) : null;
  const usdcBaseUnits = usdToUsdcBaseUnits(activeAmount);

  // Active balance based on selected currency
  const balanceUsd = currency === "USDC" ? usdcBalanceUsd : desoBalanceUsd;
  const afterTipUsd = balanceUsd != null ? balanceUsd - activeAmount : null;

  const canSend =
    activated &&
    activeAmount >= 0.01 &&
    !sending &&
    (currency === "DESO"
      ? amountNanos > 0 && amountNanos <= appUser.BalanceNanos
      : usdcBalance != null &&
        usdcBaseUnits <= usdcBalance &&
        appUser.BalanceNanos >= MIN_DESO_FOR_FEES);

  const tier =
    activeAmount >= LARGE_THRESHOLD
      ? "large"
      : activeAmount >= MEDIUM_THRESHOLD
      ? "medium"
      : "small";

  // Color theme based on currency: DESO = blue, USDC = green
  const accentColor = currency === "DESO" ? "#2775ca" : "#34F080";
  const accentTextClass =
    currency === "DESO" ? "text-[#2775ca]" : "text-[#34F080]";
  const gradientClasses =
    currency === "DESO"
      ? "bg-gradient-to-r from-[#2775ca] to-[#4a9aea] text-white"
      : "bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black";

  const handleCurrencyChange = (c: TipCurrency) => {
    setCurrency(c);
    cacheTipCurrency(appUser.PublicKeyBase58Check, c);
  };

  // Fetch exchange rate + USDC balance on mount
  useEffect(() => {
    fetchExchangeRate()
      .then(setExchangeRate)
      .catch(() => {
        toast.error("Could not fetch exchange rate. Please try again.");
        onClose();
      });
    fetchUsdcBalance(appUser.PublicKeyBase58Check)
      .then(setUsdcBalance)
      .catch(() => {});
  }, []); // mount-only: fetch rates once on open

  useEffect(() => {
    const timer = setTimeout(() => setActivated(true), ACTIVATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Escape key + focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) {
        if (showHeroSwap) {
          setShowHeroSwap(false);
          return;
        }
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
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
  }, [onClose, sending, showHeroSwap]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);
  useEffect(
    () => () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    },
    []
  );
  useEffect(() => {
    setConfirmArmed(false);
    setLargeConfirmChecked(false);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, [activeAmount, currency]);

  const executeTip = useCallback(async () => {
    if (!canSend) return;
    setSending(true);

    try {
      let txHash = "";

      if (currency === "DESO") {
        const { recipientNanos, feeNanos } = splitDesoTip(
          amountNanos,
          activeAmount
        );
        const transferCount = feeNanos > 0 ? 2 : 1;
        const hasPerms = identity.hasPermissions({
          GlobalDESOLimit: amountNanos,
          TransactionCountLimitMap: { BASIC_TRANSFER: transferCount },
        });
        if (!hasPerms) {
          await identity.requestPermissions({
            GlobalDESOLimit: amountNanos + 1e7,
            TransactionCountLimitMap: {
              AUTHORIZE_DERIVED_KEY: 1,
              BASIC_TRANSFER: transferCount,
            },
          });
        }

        if (feeNanos > 0) {
          // Atomic: tip + platform fee in one transaction
          const result = await withAuth(() =>
            sendAtomicDesoTip(
              appUser.PublicKeyBase58Check,
              recipientPublicKey,
              recipientNanos,
              feeNanos
            )
          );
          txHash =
            (result as any)?.TxnHashHex ||
            (result as any)?.TransactionIDBase58Check ||
            "";
        } else {
          // No fee — single transfer
          const result = await withAuth(() =>
            sendDeso({
              SenderPublicKeyBase58Check: appUser.PublicKeyBase58Check,
              RecipientPublicKeyOrUsername: recipientPublicKey,
              AmountNanos: amountNanos,
              MinFeeRateNanosPerKB: 1000,
            })
          );
          txHash =
            (result as any)?.TxnHashHex ||
            (result as any)?.TransactionIDBase58Check ||
            "";
        }
      } else {
        // USDC — DAO coin transfer
        const { recipientBaseUnits, feeBaseUnits } = splitUsdcTip(
          usdcBaseUnits,
          activeAmount
        );
        const transferCount = feeBaseUnits > 0n ? 2 : 1;
        const hasPerms = identity.hasPermissions({
          GlobalDESOLimit: MIN_DESO_FOR_FEES * transferCount,
          DAOCoinOperationLimitMap: {
            [USDC_CREATOR_PUBLIC_KEY]: { transfer: transferCount },
          },
        });
        if (!hasPerms) {
          await identity.requestPermissions({
            GlobalDESOLimit: MIN_DESO_FOR_FEES * 10,
            TransactionCountLimitMap: { AUTHORIZE_DERIVED_KEY: 1 },
            DAOCoinOperationLimitMap: {
              [USDC_CREATOR_PUBLIC_KEY]: { transfer: transferCount },
            },
          });
        }

        if (feeBaseUnits > 0n) {
          // Atomic: tip + platform fee in one transaction
          const result = await withAuth(() =>
            sendAtomicUsdcTip(
              appUser.PublicKeyBase58Check,
              recipientPublicKey,
              recipientBaseUnits,
              feeBaseUnits
            )
          );
          txHash =
            (result as any)?.TxnHashHex ||
            (result as any)?.TransactionIDBase58Check ||
            "";
        } else {
          // No fee — single transfer
          const result = await withAuth(() =>
            transferDeSoToken({
              SenderPublicKeyBase58Check: appUser.PublicKeyBase58Check,
              ProfilePublicKeyBase58CheckOrUsername: USDC_CREATOR_PUBLIC_KEY,
              ReceiverPublicKeyBase58CheckOrUsername: recipientPublicKey,
              DAOCoinToTransferNanos: toHexUint256(usdcBaseUnits),
              MinFeeRateNanosPerKB: 1000,
            })
          );
          txHash =
            (result as any)?.TxnHashHex ||
            (result as any)?.TransactionIDBase58Check ||
            "";
        }
        invalidateUsdcBalanceCache();
      }

      setSent(true);
      onTipSent({
        amountNanos: currency === "DESO" ? amountNanos : 0,
        amountUsdcBaseUnits:
          currency === "USDC" ? toHexUint256(usdcBaseUnits) : undefined,
        amountUsd: activeAmount,
        currency,
        txHash,
        recipientPublicKey,
        recipientUsername,
        tipReplyTo,
        message: tipMessage || undefined,
      });
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
    currency,
    amountNanos,
    usdcBaseUnits,
    activeAmount,
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
    if (tier === "small") executeTip();
    else if (tier === "medium") {
      if (confirmArmed) executeTip();
      else {
        setConfirmArmed(true);
        confirmTimerRef.current = setTimeout(
          () => setConfirmArmed(false),
          CONFIRM_TIMEOUT_MS
        );
      }
    } else if (tier === "large" && largeConfirmChecked) executeTip();
  }, [canSend, tier, confirmArmed, largeConfirmChecked, executeTip]);

  const displayName = recipientUsername
    ? `@${recipientUsername}`
    : `${recipientPublicKey.slice(0, 8)}...`;
  const afterTipColor =
    afterTipUsd == null
      ? "text-gray-400"
      : afterTipUsd > 1
      ? accentTextClass
      : afterTipUsd > 0.1
      ? "text-amber-400"
      : "text-red-400";

  const getButtonContent = () => {
    if (sending)
      return (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Sending...
        </span>
      );
    if (tier === "medium" && confirmArmed)
      return `Confirm ${formatUsd(activeAmount)}`;
    if (tier === "large" && !largeConfirmChecked)
      return "Check the box above to confirm";
    return `Tip ${formatUsd(activeAmount)} to ${displayName}`;
  };

  const getButtonClasses = () => {
    const base =
      "w-full py-3 rounded-xl text-sm font-bold transition-all cursor-pointer relative overflow-hidden";
    if (!canSend || (tier === "large" && !largeConfirmChecked))
      return `${base} bg-white/5 text-gray-500 cursor-not-allowed`;
    if (tier === "medium" && confirmArmed)
      return `${base} bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30`;
    return `${base} ${gradientClasses} hover:shadow-[0_0_30px_rgba(${
      currency === "DESO" ? "39,117,202" : "52,240,128"
    },0.3)] active:scale-[0.98]`;
  };

  // HeroSwap full-screen modal
  if (showHeroSwap) {
    // When opened for DESO fees, only allow DESO as destination
    const heroSwapUrl = heroSwapForFees
      ? "https://heroswap.com/widget?affiliateName=ChatOn&theme=dark-blue&depositTicker=USDC&depositTickers=USDT%2CUSDC%2CUSDC-SOL&destinationTickers=DESO"
      : "https://heroswap.com/widget?affiliateName=ChatOn&theme=dark-blue&depositTicker=USDC&depositTickers=USDT%2CUSDC%2CUSDC-SOL&destinationTickers=DESO%2CDUSD";
    return createPortal(
      <div className="fixed inset-0 z-[10000] bg-[#050e1d] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <button
            onClick={() => {
              setShowHeroSwap(false);
              setHeroSwapForFees(false);
              // Refresh both balances after returning from HeroSwap
              fetchUsdcBalance(appUser.PublicKeyBase58Check)
                .then(setUsdcBalance)
                .catch(() => {});
              fetchExchangeRate().catch(() => {}); // refresh DESO rate too
            }}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-white font-semibold text-sm">Add Funds</h2>
        </div>
        <div className="px-4 py-2 bg-[#3b82f6]/10 border-b border-[#3b82f6]/20">
          <p className="text-xs text-[#93c5fd]">
            {heroSwapForFees
              ? "Deposit USDC or USDT to receive DESO for transaction fees. Typically arrives in ~1 minute."
              : "Deposit USDC or USDT to receive funds on DeSo. Typically arrives in ~1 minute."}
          </p>
        </div>
        <iframe
          src={heroSwapUrl}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          allow="clipboard-write"
          title="HeroSwap — Add Funds"
        />
      </div>,
      document.body
    );
  }

  // Loading state (exchange rate needed for DESO)
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
          <span className="text-gray-500 text-xs">
            Loading exchange rate...
          </span>
        </div>
      </div>,
      document.body
    );
  }

  const currencyLabel =
    currency === "USDC"
      ? `${activeAmount.toFixed(2)} USDC`
      : `${desoEquivalent.toFixed(4)} DESO`;
  const balanceLabel =
    currency === "USDC"
      ? `${usdcBalanceUsd != null ? formatUsd(usdcBalanceUsd) : "..."} USDC`
      : `${
          desoBalanceUsd != null ? formatUsd(desoBalanceUsd) : "..."
        } (${desoNanosToDeso(appUser.BalanceNanos).toFixed(4)} DESO)`;

  // USDC selected but no DESO for fees
  const needsDesoForFees =
    currency === "USDC" && appUser.BalanceNanos < MIN_DESO_FOR_FEES;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 modal-backdrop-enter"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Send tip to ${displayName}`}
        tabIndex={-1}
        className="bg-[#050e1d] text-blue-100 border border-blue-900/60 w-[92%] max-w-[420px] max-h-[90vh] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-y-auto overflow-x-hidden outline-none modal-card-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient bar — themed per currency */}
        <div
          className={`h-1 ${
            currency === "DESO"
              ? "bg-gradient-to-r from-[#2775ca] via-[#4a9aea] to-[#2775ca]"
              : "bg-gradient-to-r from-[#34F080] via-[#20E0AA] to-[#40B8E0]"
          }`}
        />

        {sent ? (
          <div className="p-8 text-center">
            <div
              className={
                "w-16 h-16 mx-auto mb-5 rounded-full border flex items-center justify-center"
              }
              style={{
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}30`,
              }}
            >
              <Sparkles className="w-8 h-8" style={{ color: accentColor }} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Tip sent!</h3>
            <p className="text-gray-400 text-sm mb-1">
              You tipped{" "}
              <span className={`${accentTextClass} font-semibold`}>
                {formatUsd(activeAmount)}
              </span>{" "}
              to {displayName}
            </p>
            <p className="text-gray-600 text-xs mb-6">
              {currencyLabel} sent on-chain
            </p>
            <button
              onClick={onClose}
              className={
                "px-8 py-2.5 border font-semibold rounded-lg transition-colors cursor-pointer"
              }
              style={{
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <CircleDollarSign
                  className="w-5 h-5"
                  style={{ color: accentColor }}
                />
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
              <div className="flex items-center gap-3 mb-4">
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

              {/* Currency toggle */}
              <CurrencyToggle
                value={currency}
                onChange={handleCurrencyChange}
              />

              {/* Preset amounts */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {PRESET_AMOUNTS_USD.map((amount) => {
                  const active = !isCustom && selectedAmount === amount;
                  return (
                    <button
                      key={amount}
                      aria-label={`Tip ${formatUsd(amount)} ${currency}`}
                      onClick={() => {
                        setSelectedAmount(amount);
                        setIsCustom(false);
                        setCustomAmount("");
                      }}
                      className={`py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                        active
                          ? `${gradientClasses} shadow-[0_0_20px_rgba(${
                              currency === "DESO" ? "39,117,202" : "52,240,128"
                            },0.2)]`
                          : "bg-white/5 text-gray-300 border border-white/10 hover:text-white"
                      }`}
                      style={active ? undefined : { borderColor: undefined }}
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
                    ? currency === "DESO"
                      ? "border-[#2775ca]/50 bg-[#2775ca]/5"
                      : "border-[#34F080]/50 bg-[#34F080]/5"
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

              {/* Currency equivalent */}
              {activeAmount > 0 && (
                <div className="text-xs text-gray-500 mb-3">
                  ≈ {currencyLabel}
                </div>
              )}

              {/* Optional message */}
              <textarea
                placeholder="Add a message (optional)"
                aria-label="Tip message"
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                rows={2}
                className="w-full bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none resize-none mb-4 focus:border-white/30"
              />

              {/* Balance info */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Your balance</span>
                <span className="font-semibold text-gray-400">
                  {balanceLabel}
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

              {/* Platform fee disclosure */}
              {feeApplies && activeAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>
                    Includes {Math.round(TIP_FEE_RATE * 100)}% ChatOn fee
                  </span>
                  <span className="font-semibold text-gray-400">
                    {formatUsd(recipientUsd)} to {displayName} ·{" "}
                    {formatUsd(feeUsd)} to ChatOn
                  </span>
                </div>
              )}

              {/* Insufficient balance / needs DESO for fees warnings */}
              {needsDesoForFees && (
                <div className="text-xs text-amber-400/80 mb-3 text-center">
                  USDC tips need a tiny DESO fee (~$0.001) to process on-chain.{" "}
                  <button
                    onClick={() => {
                      setHeroSwapForFees(true);
                      setShowHeroSwap(true);
                    }}
                    className="text-[#3b82f6] underline cursor-pointer"
                  >
                    Get DESO
                  </button>
                </div>
              )}
              {activeAmount > 0 &&
                balanceUsd != null &&
                activeAmount > balanceUsd &&
                !needsDesoForFees && (
                  <div className="text-xs text-red-400/80 mb-3 text-center">
                    Insufficient balance.{" "}
                    <button
                      onClick={() => setShowHeroSwap(true)}
                      className="text-[#3b82f6] underline cursor-pointer"
                    >
                      Add funds
                    </button>
                  </div>
                )}

              {/* Large amount confirmation */}
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
                    <span className="font-semibold">
                      {formatUsd(activeAmount)}
                    </span>{" "}
                    ({currencyLabel}) to {displayName}
                  </span>
                </label>
              )}

              {/* Send button */}
              <button
                onClick={handleSendClick}
                disabled={
                  !canSend || (tier === "large" && !largeConfirmChecked)
                }
                aria-label={`Send ${formatUsd(
                  activeAmount
                )} tip to ${displayName}`}
                className={getButtonClasses()}
              >
                <span className="relative z-10">{getButtonContent()}</span>
              </button>

              <p className="text-[10px] text-gray-600 text-center mt-3">
                Sent on-chain via DeSo {currency === "USDC" ? "(USDC) " : ""}+
                tiny network fee
                {feeApplies && " · 10% supports ChatOn development"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
