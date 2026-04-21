import { identity } from "deso-protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import {
  LogOut,
  Pencil,
  Heart,
  MessageSquareText,
  Settings,
  ArrowLeftRight,
} from "lucide-react";
import { NotificationToggle } from "./notification-toggle";
import { toast } from "sonner";
import { formatDisplayName, getProfileURL } from "../utils/helpers";
import { MessagingDisplayAvatar } from "./messaging-display-avatar";
import { EditProfileDialog } from "./edit-profile-dialog";
import { SupportChatOnDialog } from "./support-chaton-dialog";
import { UserAccountList } from "./user-account-list";
import { SettingsModal } from "./settings-modal";
import { Identity } from "deso-protocol/src/identity/identity";

const MENU_ITEM_SELECTOR =
  'button[role="menuitem"], a[role="menuitem"]' as const;

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
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Check if user has multiple accounts — memoized to avoid snapshot() on every render
  const hasMultipleAccounts = useMemo(() => {
    try {
      const snapshot = (identity as Identity<Storage>).snapshot();
      const alternateUsers = Object.keys(snapshot.alternateUsers || {});
      return alternateUsers.length > 0;
    } catch {
      return false;
    }
  }, [appUser]);

  const profileUrl = appUser?.ProfileEntryResponse?.Username
    ? getProfileURL(appUser.ProfileEntryResponse.Username)
    : null;

  // Stable onClose callbacks
  const closeEditProfile = useCallback(() => setShowEditProfile(false), []);
  const closeSupport = useCallback(() => setShowSupport(false), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setShowAccountSwitcher(false);
    // Return focus to trigger
    triggerRef.current?.focus();
  }, []);

  // Focus trap + arrow key navigation for dropdown menu
  useEffect(() => {
    if (!menuOpen) return;

    // Auto-focus first menu item on open
    requestAnimationFrame(() => {
      const first =
        menuRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR);
      first?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!menuRef.current) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu();
        return;
      }

      // Arrow key navigation + Tab focus trap
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Tab") {
        const items =
          menuRef.current.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR);
        if (items.length === 0) return;

        const currentIndex = Array.from(items).findIndex(
          (item) => item === document.activeElement
        );

        let nextIndex: number;
        if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
          e.preventDefault();
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
          e.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }

        items[nextIndex]?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, closeMenu]);

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
            <button
              ref={triggerRef}
              className="cursor-pointer bg-transparent border-none p-0"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="User menu"
            >
              <MessagingDisplayAvatar
                publicKey={appUser?.PublicKeyBase58Check}
                extraDataPicUrl={
                  appUser?.ProfileEntryResponse?.ExtraData?.[
                    "NFTProfilePictureUrl"
                  ] ||
                  appUser?.ProfileEntryResponse?.ExtraData?.[
                    "LargeProfilePicURL"
                  ]
                }
                diameter={35}
                classNames="ml-1 md:ml-3"
              />
            </button>

            {menuOpen &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[61]"
                    onClick={closeMenu}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  />
                  <div
                    ref={menuRef}
                    role="menu"
                    className="fixed z-[62] w-[min(280px,calc(100vw-2rem))] glass-menu rounded-2xl p-2.5"
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
                    {/* Profile header */}
                    {appUser &&
                      (profileUrl ? (
                        <a
                          href={profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          role="menuitem"
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
                        >
                          <MessagingDisplayAvatar
                            publicKey={appUser.PublicKeyBase58Check}
                            extraDataPicUrl={
                              appUser.ProfileEntryResponse?.ExtraData?.[
                                "NFTProfilePictureUrl"
                              ] ||
                              appUser.ProfileEntryResponse?.ExtraData?.[
                                "LargeProfilePicURL"
                              ]
                            }
                            diameter={36}
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
                        </a>
                      ) : (
                        <div className="flex items-center gap-2.5 px-3 py-2.5">
                          <MessagingDisplayAvatar
                            publicKey={appUser.PublicKeyBase58Check}
                            extraDataPicUrl={
                              appUser.ProfileEntryResponse?.ExtraData?.[
                                "NFTProfilePictureUrl"
                              ] ||
                              appUser.ProfileEntryResponse?.ExtraData?.[
                                "LargeProfilePicURL"
                              ]
                            }
                            diameter={36}
                            classNames="shrink-0"
                          />
                          <div className="text-[14px] font-semibold text-white truncate">
                            {formatDisplayName(appUser)}
                          </div>
                        </div>
                      ))}

                    <div className="border-t border-white/[0.06] my-1.5" />

                    {/* Edit Profile */}
                    {appUser && (
                      <button
                        role="menuitem"
                        className="flex items-center w-full py-3 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
                        onClick={() => {
                          closeMenu();
                          setShowEditProfile(true);
                        }}
                      >
                        <Pencil className="mr-3 w-[18px] h-[18px]" />
                        <span className="text-[14px]">Edit Profile</span>
                      </button>
                    )}

                    {/* Notifications */}
                    <NotificationToggle menuItemRole />

                    <div className="border-t border-white/[0.06] my-1.5" />

                    {/* Send Feedback */}
                    <button
                      role="menuitem"
                      className="flex items-center w-full py-3 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
                      onClick={() => {
                        closeMenu();
                        useStore.getState().openFeedbackModal();
                      }}
                    >
                      <MessageSquareText className="mr-3 w-[18px] h-[18px]" />
                      <span className="text-[14px]">Send Feedback</span>
                    </button>

                    {/* Donate */}
                    <button
                      role="menuitem"
                      className="flex items-center w-full py-3 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
                      onClick={() => {
                        closeMenu();
                        setShowSupport(true);
                      }}
                    >
                      <Heart className="mr-3 w-[18px] h-[18px] text-[#34F080]" />
                      <span className="text-[14px]">Donate</span>
                    </button>

                    <div className="border-t border-white/[0.06] my-1.5" />

                    {/* Settings */}
                    <button
                      role="menuitem"
                      className="flex items-center w-full py-3 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
                      onClick={() => {
                        closeMenu();
                        setShowSettings(true);
                      }}
                    >
                      <Settings className="mr-3 w-[18px] h-[18px]" />
                      <span className="text-[14px]">Settings</span>
                    </button>

                    <div className="border-t border-white/[0.06] my-1.5" />

                    {/* Switch Account — only if multiple accounts */}
                    {hasMultipleAccounts &&
                      (showAccountSwitcher ? (
                        <div className="menu-expand">
                          <div className="overflow-hidden">
                            <UserAccountList onSwitch={() => closeMenu()} />
                            <button
                              role="menuitem"
                              className="flex items-center w-full py-3 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
                              onClick={async () => {
                                setLockRefresh(true);
                                try {
                                  await identity.login();
                                } catch (e) {
                                  toast.error(`Error logging in: ${e}`);
                                  console.error(e);
                                }
                                setLockRefresh(false);
                                closeMenu();
                              }}
                            >
                              <span className="mr-3 w-[18px] h-[18px] flex items-center justify-center text-[#34F080] text-lg font-bold">
                                +
                              </span>
                              <span className="text-[14px]">Add Account</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          role="menuitem"
                          className="flex items-center w-full py-3 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
                          onClick={() => setShowAccountSwitcher(true)}
                        >
                          <ArrowLeftRight className="mr-3 w-[18px] h-[18px]" />
                          <span className="text-[14px]">Switch Account</span>
                        </button>
                      ))}

                    {/* Logout */}
                    <button
                      role="menuitem"
                      className="flex items-center w-full py-3 px-3 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
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
                        closeMenu();
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
        <EditProfileDialog appUser={appUser} onClose={closeEditProfile} />
      )}
      {showSupport && appUser && (
        <SupportChatOnDialog appUser={appUser} onClose={closeSupport} />
      )}
      {showSettings && <SettingsModal onClose={closeSettings} />}
    </header>
  );
};
