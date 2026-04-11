import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Copy, Wallet, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "../store";
import { formatDisplayName, getProfileURL } from "../utils/helpers";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { SaveToClipboard } from "./shared/save-to-clipboard";
import { PrivacyToggle } from "./privacy-toggle";
import { TipCurrencyToggle } from "./tip-currency-toggle";
import { LanguageSelector } from "./language-selector";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal = ({ onClose }: SettingsModalProps) => {
  const appUser = useStore((s) => s.appUser);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useFocusTrap<HTMLDivElement>(closeButtonRef);

  // advanced-event-handler-refs: stable listener, no re-subscription when onClose changes
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  if (!appUser) return null;

  const profileUrl = appUser.ProfileEntryResponse
    ? getProfileURL(appUser.ProfileEntryResponse.Username)
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 modal-backdrop-enter"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-[#050e1d] text-blue-100 border border-blue-900/60 w-full sm:w-[92%] max-w-[460px] rounded-t-2xl sm:rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden max-h-[90vh] sm:max-h-[80vh] flex flex-col modal-card-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient bar */}
        <div className="h-1 bg-gradient-to-r from-[#34F080] via-[#20E0AA] to-[#40B8E0] shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-white">Settings</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50 rounded"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pb-6 custom-scrollbar">
          {/* ── Account ── */}
          <SectionHeader label="Account" />

          {/* Profile card */}
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden mb-1.5">
            {profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-3 py-3 hover:bg-white/[0.04] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
              >
                <MessagingDisplayAvatar
                  publicKey={appUser.PublicKeyBase58Check}
                  diameter={38}
                  classNames="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-white truncate">
                    {formatDisplayName(appUser)}
                  </div>
                  {appUser.ProfileEntryResponse?.Username && (
                    <div className="text-[12px] text-gray-500 truncate">
                      @{appUser.ProfileEntryResponse.Username}
                    </div>
                  )}
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-600 shrink-0" />
              </a>
            ) : (
              <div className="flex items-center gap-3 px-3 py-3">
                <MessagingDisplayAvatar
                  publicKey={appUser.PublicKeyBase58Check}
                  diameter={38}
                  classNames="shrink-0"
                />
                <div className="text-[14px] font-semibold text-white truncate">
                  {formatDisplayName(appUser)}
                </div>
              </div>
            )}

            <div className="border-t border-white/[0.06]" />

            {/* Copy Public Key */}
            <div className="flex items-center py-3 px-3 text-gray-400 hover:text-white hover:bg-white/[0.04] cursor-pointer transition-colors">
              <SaveToClipboard
                text={appUser.PublicKeyBase58Check}
                copyIcon={<Copy className="w-[18px] h-[18px] mr-3" />}
                copiedIcon={
                  <Copy className="w-[18px] h-[18px] mr-3 text-[#34F080]" />
                }
              >
                <span className="text-[14px]">Copy Public Key</span>
              </SaveToClipboard>
            </div>
          </div>

          {/* ── Chat ── */}
          <SectionHeader label="Chat" />

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden mb-1.5">
            <PrivacyToggle />
            <div className="border-t border-white/[0.06]" />
            <TipCurrencyToggle />
          </div>

          {/* ── Language ── */}
          <SectionHeader label="Language" />

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden mb-1.5">
            <LanguageSelector />
          </div>

          {/* ── Links ── */}
          <SectionHeader label="More" />

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden mb-1.5">
            <a
              href="https://wallet.deso.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between py-3 px-3 text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
            >
              <div className="flex items-center">
                <Wallet className="mr-3 w-[18px] h-[18px]" />
                <span className="text-[14px]">DeSo Wallet</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-600" />
            </a>

            <div className="border-t border-white/[0.06]" />

            <button
              className="flex items-center w-full py-3 px-3 text-gray-400 hover:text-white hover:bg-white/[0.04] cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
              onClick={async () => {
                const shareData = {
                  title: "ChatOn",
                  text: "Chat with me on ChatOn \u2014 decentralized, end-to-end encrypted messaging on the blockchain. No censorship, no middlemen.",
                  url: "https://getchaton.com",
                };
                if (navigator.share) {
                  try {
                    await navigator.share(shareData);
                  } catch {
                    /* cancelled */
                  }
                } else {
                  navigator.clipboard.writeText(
                    `${shareData.text}\n${shareData.url}`
                  );
                  toast.success("Invite link copied!");
                }
              }}
            >
              <Share2 className="mr-3 w-[18px] h-[18px]" />
              <span className="text-[14px]">Invite Friends</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-1 pt-4 pb-1.5">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
