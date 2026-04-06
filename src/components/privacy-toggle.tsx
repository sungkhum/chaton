import { useCallback, useState } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { setPrivacyModeOnChain } from "../services/conversations.service";
import type { PrivacyMode } from "../utils/extra-data";

export function PrivacyToggle() {
  const { appUser, privacyMode, privacyModeAssociationId, setPrivacyMode } =
    useStore(
      useShallow((s) => ({
        appUser: s.appUser,
        privacyMode: s.privacyMode,
        privacyModeAssociationId: s.privacyModeAssociationId,
        setPrivacyMode: s.setPrivacyMode,
      }))
    );
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
      className="flex items-center justify-between w-full py-2.5 px-3 rounded-lg transition-colors disabled:opacity-50 text-gray-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
    >
      <div className="flex items-center">
        {isFull ? (
          <ShieldCheck className="mr-3 w-[18px] h-[18px] text-[#34F080]" />
        ) : (
          <Shield className="mr-3 w-[18px] h-[18px]" />
        )}
        <span className="text-[14px]">Encrypt Media</span>
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
