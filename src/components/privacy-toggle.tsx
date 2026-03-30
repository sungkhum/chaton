import { useCallback, useState } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { setPrivacyModeOnChain } from "../services/conversations.service";
import type { PrivacyMode } from "../utils/extra-data";

export function PrivacyToggle() {
  const { appUser, privacyMode, privacyModeAssociationId, setPrivacyMode } =
    useStore();
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (!appUser || loading) return;
    const publicKey = appUser.PublicKeyBase58Check;
    const nextMode: PrivacyMode = privacyMode === "full" ? "standard" : "full";
    const prevMode = privacyMode;
    const prevAssocId = privacyModeAssociationId;

    // Optimistic update
    setPrivacyMode(nextMode);
    setLoading(true);

    try {
      const newAssocId = await setPrivacyModeOnChain(
        publicKey,
        nextMode,
        prevAssocId
      );
      setPrivacyMode(nextMode, newAssocId || null);
      toast.success(
        nextMode === "full"
          ? "Full encryption enabled"
          : "Standard encryption enabled"
      );
    } catch {
      // Rollback
      setPrivacyMode(prevMode, prevAssocId);
      toast.error("Failed to update encryption mode");
    } finally {
      setLoading(false);
    }
  }, [appUser, loading, privacyMode, privacyModeAssociationId, setPrivacyMode]);

  if (!appUser) return null;

  const isFull = privacyMode === "full";

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center justify-between w-full pt-[9px] pb-2 px-3 rounded-md transition-colors disabled:opacity-50 text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer"
    >
      <div className="flex items-center">
        {isFull ? (
          <ShieldCheck className="mr-3 w-5 h-5 text-[#34F080]" />
        ) : (
          <Shield className="mr-3 w-5 h-5" />
        )}
        <span className="text-base">Encrypt Media</span>
      </div>

      <div
        className={`w-9 h-5 rounded-full transition-colors relative ${
          isFull ? "bg-[#34F080]" : "bg-white/20"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            isFull ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}
