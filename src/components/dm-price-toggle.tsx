import { useCallback, useEffect, useRef, useState } from "react";
import { CircleDollarSign, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { setPaidMessagingSettingsOnChain } from "../services/conversations.service";

export function DmPriceToggle() {
  const {
    appUser,
    dmPriceUsdCents,
    dmFollowingPriceUsdCents,
    dmPriceAssociationId,
    setDmPrice,
  } = useStore(
    useShallow((s) => ({
      appUser: s.appUser,
      dmPriceUsdCents: s.dmPriceUsdCents,
      dmFollowingPriceUsdCents: s.dmFollowingPriceUsdCents,
      dmPriceAssociationId: s.dmPriceAssociationId,
      setDmPrice: s.setDmPrice,
    }))
  );

  const isEnabled = dmPriceUsdCents !== null && dmPriceUsdCents > 0;
  const [editing, setEditing] = useState(false);
  const [priceInput, setPriceInput] = useState(() =>
    isEnabled ? (dmPriceUsdCents / 100).toFixed(2) : "1.00"
  );
  const [followingPriceInput, setFollowingPriceInput] = useState(() =>
    dmFollowingPriceUsdCents > 0
      ? (dmFollowingPriceUsdCents / 100).toFixed(2)
      : "0.00"
  );
  const [loading, setLoading] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync inputs when store changes (e.g., after on-chain fetch)
  useEffect(() => {
    if (!editing) {
      if (isEnabled) {
        setPriceInput((dmPriceUsdCents / 100).toFixed(2));
      }
      setFollowingPriceInput(
        dmFollowingPriceUsdCents > 0
          ? (dmFollowingPriceUsdCents / 100).toFixed(2)
          : "0.00"
      );
    }
  }, [dmPriceUsdCents, dmFollowingPriceUsdCents, isEnabled, editing]);

  const handleToggle = useCallback(() => {
    if (loading) return;
    if (isEnabled) {
      // Ask for confirmation before disabling
      setConfirmDisable(true);
    } else {
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isEnabled, loading]);

  const handleDisable = useCallback(async () => {
    if (!appUser || loading) return;
    const prevCents = dmPriceUsdCents;
    const prevFollowing = dmFollowingPriceUsdCents;
    const prevAssocId = dmPriceAssociationId;

    setDmPrice(null, 0, null);
    setEditing(false);
    setConfirmDisable(false);
    setLoading(true);

    try {
      await setPaidMessagingSettingsOnChain(
        appUser.PublicKeyBase58Check,
        null,
        0,
        prevAssocId
      );
      toast.success("DM pricing disabled");
    } catch {
      setDmPrice(prevCents, prevFollowing, prevAssocId);
      toast.error("Failed to disable DM pricing");
    } finally {
      setLoading(false);
    }
  }, [
    appUser,
    loading,
    dmPriceUsdCents,
    dmFollowingPriceUsdCents,
    dmPriceAssociationId,
    setDmPrice,
  ]);

  const handleSave = useCallback(async () => {
    if (!appUser || loading) return;

    const cents = Math.round(parseFloat(priceInput) * 100);
    const followingCents = Math.round(parseFloat(followingPriceInput) * 100);

    if (isNaN(cents) || cents < 1) {
      toast.error("Minimum price is $0.01");
      return;
    }
    if (cents > 10000) {
      toast.error("Maximum price is $100.00");
      return;
    }
    if (isNaN(followingCents) || followingCents < 0) {
      setFollowingPriceInput("0.00");
      return;
    }

    const prevCents = dmPriceUsdCents;
    const prevFollowing = dmFollowingPriceUsdCents;
    const prevAssocId = dmPriceAssociationId;

    setDmPrice(cents, followingCents);
    setLoading(true);

    try {
      const newAssocId = await setPaidMessagingSettingsOnChain(
        appUser.PublicKeyBase58Check,
        cents,
        followingCents,
        prevAssocId
      );
      setDmPrice(cents, followingCents, newAssocId || null);
      setEditing(false);
      toast.success(`DM price set to $${(cents / 100).toFixed(2)}`);
    } catch {
      setDmPrice(prevCents, prevFollowing, prevAssocId);
      toast.error("Failed to update DM pricing");
    } finally {
      setLoading(false);
    }
  }, [
    appUser,
    loading,
    priceInput,
    followingPriceInput,
    dmPriceUsdCents,
    dmFollowingPriceUsdCents,
    dmPriceAssociationId,
    setDmPrice,
  ]);

  if (!appUser) return null;

  return (
    <div>
      {/* Header row with toggle */}
      <button
        onClick={handleToggle}
        disabled={loading}
        className="flex items-center justify-between w-full py-3 px-3 rounded-lg transition-colors disabled:opacity-50 text-gray-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
      >
        <div className="flex items-center">
          <CircleDollarSign
            className={`mr-3 w-[18px] h-[18px] ${
              isEnabled ? "text-[#34F080]" : ""
            }`}
          />
          <div className="flex flex-col items-start">
            <span className="text-[14px]">Charge for DMs</span>
            {isEnabled && !editing && (
              <span className="text-[11px] text-[#34F080]/70">
                ${(dmPriceUsdCents / 100).toFixed(2)}/message
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        ) : (
          <div
            className={`w-9 h-5 rounded-full transition-colors relative ${
              isEnabled ? "bg-[#34F080]" : "bg-white/20"
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                isEnabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
        )}
      </button>

      {/* Confirm disable dialog */}
      {confirmDisable && (
        <div className="px-3 pb-3">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-xs text-gray-300 mb-2">
              Disable DM pricing? Anyone will be able to message you for free.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDisable}
                disabled={loading}
                className="flex-1 bg-red-500/80 text-white text-xs font-medium py-1.5 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                Disable
              </button>
              <button
                onClick={() => setConfirmDisable(false)}
                className="px-4 text-xs text-gray-500 hover:text-white transition-colors"
              >
                Keep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enabled summary with edit button (when NOT editing) */}
      {isEnabled && !editing && !confirmDisable && (
        <div className="px-3 pb-2">
          <button
            onClick={() => {
              setEditing(true);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-white transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit pricing
          </button>
        </div>
      )}

      {/* Price editing form */}
      {editing && (
        <div className="px-3 pb-3 space-y-3">
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
              Strangers
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#34F080]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-gray-500 text-xs shrink-0">per msg</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
              Your followers
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={followingPriceInput}
                onChange={(e) => setFollowingPriceInput(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#34F080]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-gray-500 text-xs shrink-0">
                {followingPriceInput === "0.00" ||
                followingPriceInput === "0" ||
                followingPriceInput === ""
                  ? "free"
                  : "per msg"}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-gray-600 leading-relaxed">
            People who don't follow you pay per message to reach your inbox.
            Once you reply, messaging becomes free.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-[#34F080] text-black text-sm font-medium py-2 rounded-lg hover:bg-[#2dd06e] transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                // Reset inputs to current values
                if (isEnabled) {
                  setPriceInput((dmPriceUsdCents / 100).toFixed(2));
                }
                setFollowingPriceInput(
                  dmFollowingPriceUsdCents > 0
                    ? (dmFollowingPriceUsdCents / 100).toFixed(2)
                    : "0.00"
                );
              }}
              className="px-4 text-sm text-gray-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
