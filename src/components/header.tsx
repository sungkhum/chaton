import { identity } from "deso-protocol";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import {
  Copy,
  Check,
  LogOut,
  SmilePlus,
  Wallet,
  GitFork,
} from "lucide-react";
import { NotificationToggle } from "./notification-toggle";
import { toast } from "sonner";
import { formatDisplayName, getProfileURL } from "../utils/helpers";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { SaveToClipboard } from "./shared/save-to-clipboard";
import { UserAccountList } from "./user-account-list";

export const Header = () => {
  const { appUser, setLockRefresh } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [menuOpen]);

  return (
    <header className="flex justify-between items-center px-4 h-14 fixed top-0 z-50 w-full bg-[#080d16]/95 backdrop-blur-xl border-b border-white/5">
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

          <div className="relative" ref={menuRef}>
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

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-[230px] bg-[#141c2b] border border-white/10 rounded-lg shadow-xl z-50 p-2">
                <div className="px-2 pt-1 pb-2 flex justify-between items-center border-b border-white/10">
                  <span className="font-bold text-lg md:text-base text-white">
                    Profiles
                  </span>
                  <button
                    className="bg-transparent hover:bg-[#34F080]/10 text-[#34F080] font-semibold md:text-sm border py-1 px-2 border-[#34F080]/50 hover:border-[#34F080] rounded outline-none transition-colors"
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

                {appUser?.ProfileEntryResponse && (
                  <a
                    href={getProfileURL(appUser.ProfileEntryResponse.Username)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center pt-[9px] pb-2 px-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-md cursor-pointer transition-colors"
                  >
                    <SmilePlus className="mr-3 w-5 h-5" />
                    <span className="text-base">My profile</span>
                  </a>
                )}

                {appUser && (
                  <div className="flex items-center pt-[9px] pb-2 text-gray-300 hover:text-white px-3 hover:bg-white/5 rounded-md cursor-pointer transition-colors">
                    <SaveToClipboard
                      text={appUser.PublicKeyBase58Check}
                      copyIcon={<Copy className="w-5 h-5 mr-2" />}
                      copiedIcon={<Check className="w-5 h-5 mr-2" />}
                    >
                      <span className="text-base">Copy Public Key</span>
                    </SaveToClipboard>
                  </div>
                )}

                <NotificationToggle />

                <div className="border-t border-white/10 my-1" />

                <a
                  href="https://wallet.deso.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center pt-[9px] pb-2 px-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-md cursor-pointer transition-colors"
                >
                  <Wallet className="mr-3 w-5 h-5" />
                  <span className="text-base">DeSo Wallet</span>
                </a>

                <a
                  href="https://github.com/sungkhum/chaton"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center pt-[9px] pb-2 px-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-md cursor-pointer transition-colors"
                >
                  <GitFork className="mr-3 w-5 h-5" />
                  <span className="text-base">Fork This Project</span>
                </a>

                <button
                  className="flex items-center w-full pt-[9px] pb-2 px-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-md cursor-pointer transition-colors"
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
                  <LogOut className="mr-3 w-5 h-5" />
                  <span className="text-base">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
