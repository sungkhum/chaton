import { RefreshCw, X } from "lucide-react";
import { useSwUpdate } from "../hooks/useSwUpdate";

/**
 * Non-intrusive toast shown when a new service worker is waiting to activate.
 * Gives the user control over when the update is applied, preventing
 * mid-conversation disruptions from silent force-updates.
 */
export function SwUpdatePrompt() {
  const { updateAvailable, applyUpdate, dismissUpdate } = useSwUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-2rem)] max-w-sm
                    flex items-center gap-3 px-4 py-3 rounded-xl
                    bg-[rgba(15,21,32,0.85)] backdrop-blur-[24px]
                    border border-white/10
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_40px_rgba(0,0,0,0.5),0_0_0_0.5px_rgba(255,255,255,0.04)]
                    animate-[slideUp_300ms_cubic-bezier(0.16,1,0.3,1)]">
      <RefreshCw className="h-5 w-5 text-[#34F080] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">Update available</p>
        <p className="text-xs text-white/55">Tap refresh to get the latest version.</p>
      </div>
      <button
        onClick={applyUpdate}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#34F080]
                   bg-[rgba(52,240,128,0.15)] border border-[rgba(52,240,128,0.30)]
                   backdrop-blur-[12px]
                   hover:bg-[rgba(52,240,128,0.25)] hover:shadow-[0_0_12px_rgba(52,240,128,0.15)]
                   active:scale-[0.96] transition-all flex-shrink-0"
      >
        Refresh
      </button>
      <button
        onClick={dismissUpdate}
        className="p-1 rounded-full bg-white/6 border border-white/10
                   hover:bg-white/12 text-white/50 hover:text-white/80
                   transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
