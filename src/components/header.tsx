import { identity } from "deso-protocol";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import {
  Copy,
  Check,
  LogOut,
  Pencil,
  SmilePlus,
  Wallet,
  Heart,
  Share2,
} from "lucide-react";
import { NotificationToggle } from "./notification-toggle";
import { PrivacyToggle } from "./privacy-toggle";
import { toast } from "sonner";
import { formatDisplayName, getProfileURL } from "../utils/helpers";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { SaveToClipboard } from "./shared/save-to-clipboard";
import { EditProfileDialog } from "./edit-profile-dialog";
import { SupportChatOnDialog } from "./support-chaton-dialog";
import { TipCurrencyToggle } from "./tip-currency-toggle";
import { UserAccountList } from "./user-account-list";

export const Header = () => {
  const { appUser, setLockRefresh } = useStore(
    useShallow((s) => ({
      appUser: s.appUser,
      setLockRefresh: s.setLockRefresh,
    }))
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  return (
    <header className="flex justify-between items-center px-4 h-14 fixed top-0 z-[60] w-full bg-[#080d16]/95 backdrop-blur-xl border-b border-white/5">
      <a href="/" className="flex items-center gap-2.5">
        <img
          src="/ChatOn-Logo-Small.png"
          width={40}
          height={40}
          alt="ChatOn logo"
          className="rounded-xl"
        />
        <span className="text-white font-bold text-lg">ChatOn</span>
      </a>

      <div className="flex items-center">
        <div className="flex items-center ml-2">
          {appUser && (
            <div className="flex items-center pr-1 md:pr-2">
              <span className="text-white text-sm font-semibold">
                {formatDisplayName(appUser)}
              </span>
            </div>
          )}

          <div ref={avatarRef}>
            <div
              className="cursor-pointer"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MessagingDisplayAvatar
                publicKey={appUser?.PublicKeyBase58Check}
                diameter={35}
                classNames="ml-1 md:ml-3"
              />
            </div>

            {menuOpen &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[61]"
                    onClick={() => setMenuOpen(false)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  />
                  <div
                    className="fixed z-[62] w-[min(280px,calc(100vw-2rem))] glass-menu rounded-2xl p-2.5 max-h-[calc(100dvh-4.5rem)] overflow-y-auto custom-scrollbar"
                    style={{
                      top:
                        (avatarRef.current?.getBoundingClientRect().bottom ??
                          56) + 8,
                      right:
                        window.innerWidth -
                        (avatarRef.current?.getBoundingClientRect().right ??
                          window.innerWidth),
                    }}
                  >
                    <div className="px-2 pt-1.5 pb-2.5 flex justify-between items-center border-b border-white/[0.06]">
                      <span className="font-bold text-[15px] text-white/90 tracking-tight">
                        Profiles
                      </span>
                      <button
                        className="glass-btn-primary text-[#34F080] font-semibold text-xs py-1 px-2.5 rounded-lg outline-none transition-colors"
                        onClick={async () => {
                          setLockRefresh(true);
                          try {
                            await identity.login();
                          } catch (e) {
                            toast.error(`Error logging in: ${e}`);
                            console.error(e);
                          }
                          setLockRefresh(false);
                        }}
                      >
                        Add
                      </button>
                    </div>

                    <UserAccountList onSwitch={() => setMenuOpen(false)} />

                    {appUser && (
                      <button
                        className="flex items-center w-full py-2.5 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors"
                        onClick={() => {
                          setMenuOpen(false);
                          setShowEditProfile(true);
                        }}
                      >
                        <Pencil className="mr-3 w-[18px] h-[18px]" />
                        <span className="text-[14px]">Edit Profile</span>
                      </button>
                    )}

                    {appUser?.ProfileEntryResponse && (
                      <a
                        href={getProfileURL(
                          appUser.ProfileEntryResponse.Username
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center py-2.5 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors"
                      >
                        <SmilePlus className="mr-3 w-[18px] h-[18px]" />
                        <span className="text-[14px]">View Profile</span>
                      </a>
                    )}

                    {appUser && (
                      <div className="flex items-center py-2.5 text-gray-400 hover:text-white px-3 hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors">
                        <SaveToClipboard
                          text={appUser.PublicKeyBase58Check}
                          copyIcon={<Copy className="w-[18px] h-[18px] mr-2" />}
                          copiedIcon={
                            <Check className="w-[18px] h-[18px] mr-2" />
                          }
                        >
                          <span className="text-[14px]">Copy Public Key</span>
                        </SaveToClipboard>
                      </div>
                    )}

                    <div className="border-t border-white/[0.06] my-1.5" />

                    <NotificationToggle />
                    <PrivacyToggle />
                    <TipCurrencyToggle />

                    <div className="border-t border-white/[0.06] my-1.5" />

                    <a
                      href="https://wallet.deso.com"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center py-2.5 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors"
                    >
                      <Wallet className="mr-3 w-[18px] h-[18px]" />
                      <span className="text-[14px]">DeSo Wallet</span>
                    </a>

                    <button
                      className="flex items-center w-full py-2.5 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors"
                      onClick={async () => {
                        setMenuOpen(false);
                        const shareData = {
                          title: "ChatOn",
                          text: "Chat with me on ChatOn — decentralized, end-to-end encrypted messaging on the blockchain. No censorship, no middlemen.",
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

                    <button
                      className="flex items-center w-full py-2.5 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors"
                      onClick={() => {
                        setMenuOpen(false);
                        setShowSupport(true);
                      }}
                    >
                      <Heart className="mr-3 w-[18px] h-[18px] text-[#34F080]" />
                      <span className="text-[14px]">Support ChatOn</span>
                    </button>

                    <div className="border-t border-white/[0.06] my-1.5" />

                    <button
                      className="flex items-center w-full py-2.5 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors"
                      onClick={async () => {
                        if (!appUser) return;
                        setLockRefresh(true);
                        try {
                          await identity.logout();
                        } catch (e) {
                          toast.error(`Error logging out: ${e}`);
                          console.error(e);
                        }
                        setLockRefresh(false);
                        setMenuOpen(false);
                      }}
                    >
                      <LogOut className="mr-3 w-[18px] h-[18px]" />
                      <span className="text-[14px]">Logout</span>
                    </button>
                  </div>
                </>,
                document.body
              )}
          </div>
        </div>
      </div>
      {showEditProfile && appUser && (
        <EditProfileDialog
          appUser={appUser}
          onClose={() => setShowEditProfile(false)}
        />
      )}
      {showSupport && appUser && (
        <SupportChatOnDialog
          appUser={appUser}
          onClose={() => setShowSupport(false)}
        />
      )}
    </header>
  );
};
