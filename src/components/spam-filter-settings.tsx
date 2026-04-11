import { useCallback, useState } from "react";
import { Filter, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { setSpamFilterOnChain } from "../services/conversations.service";
import type { SpamFilterConfig } from "../utils/spam-filter";
import { DEFAULT_SPAM_FILTER } from "../utils/spam-filter";

/** Convert DeSo nanos to a display number (e.g. 1e9 nanos = 1 DESO). */
function nanosToDisplay(nanos: number): string {
  if (nanos === 0) return "0";
  return (nanos / 1e9).toFixed(4).replace(/\.?0+$/, "");
}

function displayToNanos(display: string): number {
  const val = parseFloat(display);
  if (isNaN(val) || val < 0) return 0;
  return Math.round(val * 1e9);
}

export function SpamFilterSettings() {
  const { appUser, spamFilter, spamFilterAssociationId, setSpamFilter } =
    useStore(
      useShallow((s) => ({
        appUser: s.appUser,
        spamFilter: s.spamFilter,
        spamFilterAssociationId: s.spamFilterAssociationId,
        setSpamFilter: s.setSpamFilter,
      }))
    );

  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  // Local form state
  const [minBalance, setMinBalance] = useState(() =>
    nanosToDisplay(spamFilter.minBalanceNanos)
  );
  const [minCoinPrice, setMinCoinPrice] = useState(() =>
    nanosToDisplay(spamFilter.minCoinPriceNanos)
  );
  const [requireProfile, setRequireProfile] = useState(
    spamFilter.requireProfile
  );
  const [minCoinHolders, setMinCoinHolders] = useState(() =>
    String(spamFilter.minCoinHolders || "")
  );

  const syncFormFromConfig = useCallback((config: SpamFilterConfig) => {
    setMinBalance(nanosToDisplay(config.minBalanceNanos));
    setMinCoinPrice(nanosToDisplay(config.minCoinPriceNanos));
    setRequireProfile(config.requireProfile);
    setMinCoinHolders(
      config.minCoinHolders > 0 ? String(config.minCoinHolders) : ""
    );
  }, []);

  const handleToggle = useCallback(() => {
    if (loading) return;
    if (spamFilter.enabled) {
      // Disable — save immediately
      handleDisable();
    } else {
      // Enable — open the editor with defaults
      syncFormFromConfig(DEFAULT_SPAM_FILTER);
      setRequireProfile(true); // sensible default when enabling
      setEditing(true);
    }
  }, [spamFilter.enabled, loading]);

  const handleDisable = useCallback(async () => {
    if (!appUser || loading) return;
    const prev = spamFilter;
    const prevAssocId = spamFilterAssociationId;

    setSpamFilter(DEFAULT_SPAM_FILTER, null);
    setEditing(false);
    setLoading(true);

    try {
      await setSpamFilterOnChain(
        appUser.PublicKeyBase58Check,
        DEFAULT_SPAM_FILTER,
        prevAssocId
      );
      toast.success("Message filter disabled");
    } catch {
      setSpamFilter(prev, prevAssocId);
      toast.error("Failed to disable message filter");
    } finally {
      setLoading(false);
    }
  }, [appUser, loading, spamFilter, spamFilterAssociationId, setSpamFilter]);

  const handleSave = useCallback(async () => {
    if (!appUser || loading) return;

    const config: SpamFilterConfig = {
      enabled: true,
      minBalanceNanos: displayToNanos(minBalance),
      minCoinPriceNanos: displayToNanos(minCoinPrice),
      requireProfile,
      minCoinHolders: parseInt(minCoinHolders, 10) || 0,
    };

    const prev = spamFilter;
    const prevAssocId = spamFilterAssociationId;

    setSpamFilter(config);
    setLoading(true);

    try {
      const newAssocId = await setSpamFilterOnChain(
        appUser.PublicKeyBase58Check,
        config,
        prevAssocId
      );
      setSpamFilter(config, newAssocId || null);
      setEditing(false);
      toast.success("Message filter saved");
    } catch {
      setSpamFilter(prev, prevAssocId);
      toast.error("Failed to save message filter");
    } finally {
      setLoading(false);
    }
  }, [
    appUser,
    loading,
    minBalance,
    minCoinPrice,
    requireProfile,
    minCoinHolders,
    spamFilter,
    spamFilterAssociationId,
    setSpamFilter,
  ]);

  if (!appUser) return null;

  const isEnabled = spamFilter.enabled;

  return (
    <div>
      {/* Header row with toggle */}
      <button
        onClick={handleToggle}
        disabled={loading}
        className="flex items-center justify-between w-full py-3 px-3 rounded-lg transition-colors disabled:opacity-50 text-gray-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
      >
        <div className="flex items-center">
          <Filter
            className={`mr-3 w-[18px] h-[18px] ${
              isEnabled ? "text-[#34F080]" : ""
            }`}
          />
          <div className="flex flex-col items-start">
            <span className="text-[14px]">Message Filter</span>
            {isEnabled && !editing && (
              <span className="text-[11px] text-[#34F080]/70">
                Auto-filtering unknown senders
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

      {/* Edit button when enabled and not editing */}
      {isEnabled && !editing && (
        <div className="px-3 pb-2">
          <button
            onClick={() => {
              syncFormFromConfig(spamFilter);
              setEditing(true);
            }}
            className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-white transition-colors"
          >
            Edit thresholds
          </button>
        </div>
      )}

      {/* Settings form */}
      {editing && (
        <div className="px-3 pb-3 space-y-3">
          {/* Require profile */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[13px] text-gray-300">
              Require DeSo profile
            </span>
            <button
              type="button"
              onClick={() => setRequireProfile((p) => !p)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                requireProfile ? "bg-[#34F080]" : "bg-white/20"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  requireProfile ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>

          {/* Min DESO balance */}
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
              Min DESO balance
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
                placeholder="0"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#34F080]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-gray-500 text-xs shrink-0">DESO</span>
            </div>
          </div>

          {/* Min coin price */}
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
              Min creator coin price
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.001"
                min="0"
                value={minCoinPrice}
                onChange={(e) => setMinCoinPrice(e.target.value)}
                placeholder="0"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#34F080]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-gray-500 text-xs shrink-0">DESO</span>
            </div>
          </div>

          {/* Min coin holders */}
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
              Min coin holders
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                min="0"
                value={minCoinHolders}
                onChange={(e) => setMinCoinHolders(e.target.value)}
                placeholder="0"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#34F080]/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-gray-500 text-xs shrink-0">holders</span>
            </div>
          </div>

          <p className="text-[11px] text-gray-600 leading-relaxed">
            Unknown senders who meet these thresholds skip your Requests tab and
            appear directly in Chats. Others still go to Requests.
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
                syncFormFromConfig(spamFilter);
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
