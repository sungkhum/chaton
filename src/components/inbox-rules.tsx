import { useCallback, useMemo, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import {
  setSpamFilterOnChain,
  setPaidMessagingSettingsOnChain,
} from "../services/conversations.service";
import { DEFAULT_SPAM_FILTER } from "../utils/spam-filter";
import type { SpamFilterConfig } from "../utils/spam-filter";
import { DiscreteSlider, findClosestStopIndex } from "./shared/discrete-slider";

/** Price stops in USD cents. */
const PRICE_STOPS = [0, 25, 50, 100, 200, 500, 1000, 2500, 5000, 10000];
/** Show labels only at these indices to avoid overflow on mobile. */
const PRICE_VISIBLE_LABELS = [0, 2, 3, 5, 6, 8, 9]; // free, $0.50, $1, $5, $10, $50, $100
/** DESO balance stops in nanos. */
const BALANCE_STOPS = [0, 1_000_000_000, 5_000_000_000, 10_000_000_000];

const MIN_PRICE_CENTS = 1; // $0.01
const MAX_PRICE_CENTS = 10000; // $100.00

function formatPriceCents(cents: number): string {
  if (cents === 0) return "free";
  if (cents < 100) return `$${(cents / 100).toFixed(2)}`;
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

function formatBalanceNanos(nanos: number): string {
  if (nanos === 0) return "0";
  return String(nanos / 1e9);
}

function getSummaryText(priceCents: number, freePassEnabled: boolean): string {
  if (priceCents === 0 && !freePassEnabled) {
    return "All unknown senders go to Requests.";
  }
  if (priceCents === 0 && freePassEnabled) {
    return "Senders who meet your filter go to Chats. Everyone else goes to Requests.";
  }
  if (priceCents > 0 && !freePassEnabled) {
    return `Everyone who doesn\u2019t follow you pays ${formatPriceCents(
      priceCents
    )}/msg. Once you reply, it\u2019s free.`;
  }
  return `Senders who meet your filter message free. Everyone else pays ${formatPriceCents(
    priceCents
  )}/msg. Once you reply, it\u2019s free.`;
}

export function InboxRules() {
  const {
    appUser,
    spamFilter,
    spamFilterAssociationId,
    setSpamFilter,
    dmPriceUsdCents,
    dmFollowingPriceUsdCents,
    dmPriceAssociationId,
    setDmPrice,
  } = useStore(
    useShallow((s) => ({
      appUser: s.appUser,
      spamFilter: s.spamFilter,
      spamFilterAssociationId: s.spamFilterAssociationId,
      setSpamFilter: s.setSpamFilter,
      dmPriceUsdCents: s.dmPriceUsdCents,
      dmFollowingPriceUsdCents: s.dmFollowingPriceUsdCents,
      dmPriceAssociationId: s.dmPriceAssociationId,
      setDmPrice: s.setDmPrice,
    }))
  );

  const isEnabled =
    (dmPriceUsdCents != null && dmPriceUsdCents > 0) || spamFilter.enabled;

  const [pendingEnabled, setPendingEnabled] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  // Price state — cents is the source of truth, slider derives index from it
  const [priceCents, setPriceCents] = useState(() => dmPriceUsdCents ?? 0);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInputValue, setPriceInputValue] = useState("");
  const priceInputRef = useRef<HTMLInputElement>(null);

  const [freePassEnabled, setFreePassEnabled] = useState(
    () => spamFilter.enabled
  );
  const [requireProfile, setRequireProfile] = useState(
    spamFilter.requireProfile
  );
  const [balanceStopIndex, setBalanceStopIndex] = useState(() =>
    findClosestStopIndex(BALANCE_STOPS, spamFilter.minBalanceNanos)
  );

  // Slider index derived from priceCents
  const priceSliderIndex = findClosestStopIndex(PRICE_STOPS, priceCents);

  const syncFormFromState = useCallback(() => {
    setPriceCents(dmPriceUsdCents ?? 0);
    setFreePassEnabled(spamFilter.enabled);
    setRequireProfile(spamFilter.requireProfile);
    setBalanceStopIndex(
      findClosestStopIndex(BALANCE_STOPS, spamFilter.minBalanceNanos)
    );
  }, [dmPriceUsdCents, spamFilter]);

  const handleToggle = useCallback(() => {
    if (loading) return;

    // If pending but not yet saved, just cancel
    if (pendingEnabled && !isEnabled) {
      setPendingEnabled(false);
      setEditing(false);
      syncFormFromState();
      return;
    }

    if (isEnabled) {
      setConfirmDisable(true);
    } else {
      // Enable — open editor with defaults
      setPriceCents(100); // default $1
      setFreePassEnabled(false);
      setRequireProfile(true);
      setBalanceStopIndex(0);
      setPendingEnabled(true);
      setEditing(true);
    }
  }, [isEnabled, pendingEnabled, loading, syncFormFromState]);

  const handleDisable = useCallback(async () => {
    if (!appUser || loading) return;

    const prevFilter = spamFilter;
    const prevFilterId = spamFilterAssociationId;
    const prevPrice = dmPriceUsdCents;
    const prevFollowing = dmFollowingPriceUsdCents;
    const prevPriceId = dmPriceAssociationId;

    // Optimistic clear
    setSpamFilter(DEFAULT_SPAM_FILTER, null);
    setDmPrice(null, 0, null);
    setEditing(false);
    setConfirmDisable(false);
    setPendingEnabled(false);
    setLoading(true);

    try {
      await Promise.all([
        setSpamFilterOnChain(
          appUser.PublicKeyBase58Check,
          DEFAULT_SPAM_FILTER,
          prevFilterId
        ),
        setPaidMessagingSettingsOnChain(
          appUser.PublicKeyBase58Check,
          null,
          0,
          prevPriceId
        ),
      ]);
      toast.success("Inbox rules disabled");
    } catch {
      setSpamFilter(prevFilter, prevFilterId);
      setDmPrice(prevPrice, prevFollowing, prevPriceId);
      toast.error("Failed to disable inbox rules");
    } finally {
      setLoading(false);
    }
  }, [
    appUser,
    loading,
    spamFilter,
    spamFilterAssociationId,
    dmPriceUsdCents,
    dmFollowingPriceUsdCents,
    dmPriceAssociationId,
    setSpamFilter,
    setDmPrice,
  ]);

  const handleSave = useCallback(async () => {
    if (!appUser || loading) return;

    const newCents = priceCents;
    const newFilter: SpamFilterConfig = {
      enabled: freePassEnabled,
      minBalanceNanos: BALANCE_STOPS[balanceStopIndex] ?? 0,
      requireProfile,
    };

    // Must have at least one rule active
    if (newCents === 0 && !freePassEnabled) {
      toast.error(
        "Set a price or enable the free pass. To disable, use the toggle."
      );
      return;
    }

    // Warn if filter has no criteria
    if (
      freePassEnabled &&
      !requireProfile &&
      (BALANCE_STOPS[balanceStopIndex] ?? 0) === 0
    ) {
      toast.error("Enable at least one filter criterion (profile or balance)");
      return;
    }

    const prevFilter = spamFilter;
    const prevFilterId = spamFilterAssociationId;
    const prevPrice = dmPriceUsdCents;
    const prevFollowing = dmFollowingPriceUsdCents;
    const prevPriceId = dmPriceAssociationId;

    // Optimistic updates — preserve followingCents from store
    setSpamFilter(newFilter);
    setDmPrice(newCents > 0 ? newCents : null, dmFollowingPriceUsdCents);
    setLoading(true);

    try {
      const [newFilterId, newPriceId] = await Promise.all([
        setSpamFilterOnChain(
          appUser.PublicKeyBase58Check,
          newFilter,
          prevFilterId
        ),
        setPaidMessagingSettingsOnChain(
          appUser.PublicKeyBase58Check,
          newCents > 0 ? newCents : null,
          dmFollowingPriceUsdCents,
          prevPriceId
        ),
      ]);

      setSpamFilter(newFilter, newFilterId || null);
      setDmPrice(
        newCents > 0 ? newCents : null,
        dmFollowingPriceUsdCents,
        newPriceId || null
      );
      setEditing(false);
      setPendingEnabled(false);
      toast.success("Inbox rules saved");
    } catch {
      setSpamFilter(prevFilter, prevFilterId);
      setDmPrice(prevPrice, prevFollowing, prevPriceId);
      toast.error("Failed to save inbox rules");
    } finally {
      setLoading(false);
    }
  }, [
    appUser,
    loading,
    priceCents,
    freePassEnabled,
    balanceStopIndex,
    requireProfile,
    spamFilter,
    spamFilterAssociationId,
    dmPriceUsdCents,
    dmFollowingPriceUsdCents,
    dmPriceAssociationId,
    setSpamFilter,
    setDmPrice,
  ]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setEditingPrice(false);
    setPendingEnabled(false);
    setConfirmDisable(false);
    syncFormFromState();
  }, [syncFormFromState]);

  // Custom price input handlers
  const startEditingPrice = useCallback(() => {
    setPriceInputValue(priceCents === 0 ? "" : (priceCents / 100).toFixed(2));
    setEditingPrice(true);
    setTimeout(() => {
      priceInputRef.current?.focus();
      priceInputRef.current?.select();
    }, 0);
  }, [priceCents]);

  const commitPriceInput = useCallback(() => {
    setEditingPrice(false);
    const val = parseFloat(priceInputValue);
    if (priceInputValue === "" || priceInputValue === "0" || isNaN(val)) {
      setPriceCents(0);
      return;
    }
    const cents = Math.round(val * 100);
    if (cents < MIN_PRICE_CENTS) {
      setPriceCents(MIN_PRICE_CENTS);
    } else if (cents > MAX_PRICE_CENTS) {
      setPriceCents(MAX_PRICE_CENTS);
    } else {
      setPriceCents(cents);
    }
  }, [priceInputValue]);

  if (!appUser) return null;

  const showToggleOn = isEnabled || pendingEnabled;

  const summaryText = useMemo(
    () => getSummaryText(priceCents, freePassEnabled),
    [priceCents, freePassEnabled]
  );

  // Sub-section label adapts to price
  const freePassLabel =
    priceCents > 0
      ? "Let some people skip the fee"
      : "Auto-approve verified senders";

  return (
    <div>
      {/* Header row with toggle */}
      <button
        onClick={handleToggle}
        disabled={loading}
        role="switch"
        aria-checked={showToggleOn}
        aria-label="Inbox Rules"
        className="flex items-center justify-between w-full py-3 px-3 rounded-lg transition-colors disabled:opacity-50 text-gray-400 hover:text-white hover:bg-white/[0.06] cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
      >
        <div className="flex items-center">
          <ShieldCheck
            className={`mr-3 w-[18px] h-[18px] ${
              showToggleOn ? "text-[#34F080]" : ""
            }`}
          />
          <div className="flex flex-col items-start">
            <span className="text-[14px]">Inbox Rules</span>
            {showToggleOn && !editing && !confirmDisable && (
              <span className="text-[11px] text-[#34F080]/70 tabular-nums">
                {isEnabled && dmPriceUsdCents && dmPriceUsdCents > 0
                  ? `${formatPriceCents(dmPriceUsdCents)}/msg`
                  : "Filtering active"}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        ) : (
          <div
            className={`w-9 h-5 rounded-full transition-colors relative ${
              showToggleOn ? "bg-[#34F080]" : "bg-white/20"
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                showToggleOn ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
        )}
      </button>

      {/* Edit button when enabled but not editing */}
      {isEnabled && !editing && !confirmDisable && (
        <div className="px-3 pb-2">
          <button
            onClick={() => {
              syncFormFromState();
              setEditing(true);
            }}
            className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-white transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50 rounded"
          >
            Edit rules
          </button>
        </div>
      )}

      {/* Confirm disable dialog */}
      {confirmDisable && (
        <div className="px-3 pb-3">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-xs text-gray-300 mb-2">
              Disable inbox rules? Anyone will be able to message you for free.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDisable}
                disabled={loading}
                className="flex-1 bg-red-500/80 text-white text-xs font-medium py-1.5 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 outline-none focus-visible:ring-1 focus-visible:ring-red-400/50"
              >
                Disable
              </button>
              <button
                onClick={() => setConfirmDisable(false)}
                className="px-4 text-xs text-gray-500 hover:text-white transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50 rounded"
              >
                Keep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editing form */}
      {editing && (
        <div className="px-3 pb-3 space-y-4">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            These rules only apply to new conversations.
          </p>

          {/* Price slider */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-[11px] text-gray-500 uppercase tracking-wide">
                Price for everyone else
              </label>
              {editingPrice ? (
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm text-gray-500">$</span>
                  <input
                    ref={priceInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={priceInputValue}
                    onChange={(e) => setPriceInputValue(e.target.value)}
                    onBlur={commitPriceInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitPriceInput();
                      if (e.key === "Escape") setEditingPrice(false);
                    }}
                    className="w-16 bg-white/5 border border-[#34F080]/50 rounded px-1.5 py-0.5 text-sm text-[#34F080] font-medium outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label="Custom price in dollars"
                  />
                  <span className="text-gray-500 text-xs">/msg</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditingPrice}
                  className="text-sm font-medium text-[#34F080] hover:text-[#2dd06e] transition-colors border-b border-dashed border-[#34F080]/30 hover:border-[#34F080]/60 outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50 rounded-sm"
                  title="Click to enter a custom amount"
                >
                  {formatPriceCents(priceCents)}
                  {priceCents > 0 && (
                    <span className="text-gray-500 font-normal">/msg</span>
                  )}
                </button>
              )}
            </div>
            <DiscreteSlider
              stops={PRICE_STOPS}
              index={priceSliderIndex}
              onChange={(i) => {
                setPriceCents(PRICE_STOPS[i] ?? 0);
                setEditingPrice(false);
              }}
              formatLabel={formatPriceCents}
              visibleLabels={PRICE_VISIBLE_LABELS}
              ariaLabel="Price per message for non-followers"
            />
          </div>

          {/* Free pass sub-section */}
          <div className="border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => setFreePassEnabled((v) => !v)}
              role="switch"
              aria-checked={freePassEnabled}
              aria-label={freePassLabel}
              className="flex items-center justify-between w-full outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50 rounded"
            >
              <span className="text-[13px] text-gray-300">{freePassLabel}</span>
              <div
                className={`w-9 h-5 rounded-full transition-colors relative ${
                  freePassEnabled ? "bg-[#34F080]" : "bg-white/20"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    freePassEnabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>

            {freePassEnabled && (
              <div className="mt-3 space-y-3">
                {/* Require profile */}
                <button
                  type="button"
                  onClick={() => setRequireProfile((p) => !p)}
                  role="switch"
                  aria-checked={requireProfile}
                  aria-label="Require DeSo profile"
                  className="flex items-center justify-between w-full cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50 rounded"
                >
                  <span className="text-[13px] text-gray-300">
                    Require DeSo profile
                  </span>
                  <div
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      requireProfile ? "bg-[#34F080]" : "bg-white/20"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        requireProfile ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </button>

                {/* Balance slider */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-[11px] text-gray-500 uppercase tracking-wide">
                      Min DESO balance
                    </label>
                    <span className="text-sm font-medium text-[#34F080] tabular-nums">
                      {formatBalanceNanos(BALANCE_STOPS[balanceStopIndex] ?? 0)}
                      {(BALANCE_STOPS[balanceStopIndex] ?? 0) > 0 && (
                        <span className="text-gray-500 font-normal"> DESO</span>
                      )}
                    </span>
                  </div>
                  <DiscreteSlider
                    stops={BALANCE_STOPS}
                    index={balanceStopIndex}
                    onChange={setBalanceStopIndex}
                    formatLabel={formatBalanceNanos}
                    ariaLabel="Minimum DESO balance"
                  />
                </div>

                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Senders must meet all enabled criteria.
                </p>
              </div>
            )}
          </div>

          {/* Dynamic summary */}
          <p className="text-[11px] text-gray-500 leading-relaxed">
            {summaryText}
          </p>

          {/* Save / Cancel */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-[#34F080] text-black text-sm font-medium py-2 rounded-lg hover:bg-[#2dd06e] transition-colors disabled:opacity-50 active:scale-[0.96] outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-4 text-sm text-gray-500 hover:text-white transition-colors disabled:opacity-50 outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
