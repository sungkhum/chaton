import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { MessageSquare, ExternalLink } from "lucide-react";
import { useStore } from "../store";
import { getProfileURL } from "../utils/helpers";
import { shortenLongWord } from "../utils/search-helpers";

const MENU_WIDTH = 200;
const MENU_GAP = 8;

export function UserActionMenu({
  onMessage,
}: {
  onMessage: (publicKey: string) => void;
}) {
  const { menu, close, appUser } = useStore(
    useShallow((s) => ({
      menu: s.userActionMenu,
      close: s.closeUserActionMenu,
      appUser: s.appUser,
    }))
  );

  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!menu) {
      setPos(null);
      return;
    }
    const rect = menu.anchorRect;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const menuEl = menuRef.current;
    const measuredHeight = menuEl?.offsetHeight ?? 110;
    const measuredWidth = menuEl?.offsetWidth ?? MENU_WIDTH;

    let top = rect.bottom + MENU_GAP;
    if (top + measuredHeight > viewportH - 8) {
      top = Math.max(8, rect.top - measuredHeight - MENU_GAP);
    }

    let left = rect.left;
    if (left + measuredWidth > viewportW - 8) {
      left = Math.max(8, viewportW - measuredWidth - 8);
    }

    setPos({ top, left });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, close]);

  if (!menu) return null;

  const isSelf = !!appUser && appUser.PublicKeyBase58Check === menu.publicKey;
  const label =
    menu.username || shortenLongWord(menu.publicKey, 6, 4) || menu.publicKey;

  const handleMessage = () => {
    onMessage(menu.publicKey);
    close();
  };

  const handleViewProfile = () => {
    const url = menu.username ? getProfileURL(menu.username) : null;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    close();
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70]"
        onClick={close}
        onTouchStart={(e) => {
          e.preventDefault();
          close();
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        aria-label={`Actions for ${label}`}
        className="fixed z-[71] min-w-[200px] rounded-xl bg-[#141c2b] border border-white/10 shadow-2xl overflow-hidden py-1"
        style={{
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          visibility: pos ? "visible" : "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 pt-2 pb-1.5 text-[11px] uppercase tracking-wide text-white/40 font-semibold truncate">
          {label}
        </div>
        {!isSelf && (
          <button
            role="menuitem"
            onClick={handleMessage}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-[14px] text-white hover:bg-white/5 transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-[#34F080]" />
            Message
          </button>
        )}
        {menu.username && (
          <button
            role="menuitem"
            onClick={handleViewProfile}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-[14px] text-white hover:bg-white/5 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-white/60" />
            View profile
          </button>
        )}
      </div>
    </>,
    document.body
  );
}
