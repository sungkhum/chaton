import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useStore } from "../store";
import { safeLogin } from "../utils/safe-login";

const NAV_LINKS = [
  { href: "/community", label: "Community" },
  { href: "/blog", label: "Blog" },
  { href: "/compare", label: "Compare" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/donate", label: "Donate" },
];

export const PublicNav = ({
  variant = "launch",
  onSignUp,
}: {
  /** "launch" shows LAUNCH APP button; "auth" shows Log in / Sign up */
  variant?: "launch" | "auth";
  /** Called when Sign up is clicked (auth variant only) */
  onSignUp?: () => void;
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const linksRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const path = window.location.pathname;

  const handleLaunchApp = () => {
    if (useStore.getState().appUser) {
      window.location.href = "/";
    } else {
      safeLogin();
    }
  };

  // Measure whether the inline links fit — if not, switch to hamburger
  const measure = useCallback(() => {
    const nav = navRef.current;
    const links = linksRef.current;
    if (!nav || !links) return;
    // Temporarily show links to measure, even if currently hidden
    const wasHidden = links.style.display;
    links.style.display = "flex";
    links.style.visibility = "hidden";
    const navWidth = nav.clientWidth;
    // Logo (~140) + CTA button (~130) + gaps/padding (~48)
    const reserved = 318;
    const linksWidth = links.scrollWidth;
    links.style.display = wasHidden;
    links.style.visibility = "";
    setOverflowing(linksWidth > navWidth - reserved);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [mobileOpen]);

  const linkClass = (href: string) =>
    `hover:text-[#34F080] transition-colors ${
      path.startsWith(href) ? "text-[#34F080]" : ""
    }`;

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0F1520]/90 backdrop-blur-2xl border-b border-white/5">
      <div
        ref={navRef}
        className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between"
      >
        {/* Logo */}
        <a
          href="/"
          className="flex items-center gap-2.5 sm:gap-3 hover:opacity-80 transition-opacity shrink-0"
        >
          <img
            src="/ChatOn-Logo-Small.png"
            alt="ChatOn"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl"
          />
          <span className="text-lg sm:text-xl font-black tracking-tighter">
            ChatOn
          </span>
        </a>

        {/* Desktop inline links — hidden when overflowing */}
        <div
          ref={linksRef}
          className="items-center gap-7 text-xs font-bold tracking-[0.15em] uppercase text-gray-500"
          style={{ display: overflowing ? "none" : "flex" }}
        >
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className={linkClass(href)}>
              {label}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {variant === "auth" ? (
            <>
              <button
                onClick={() => safeLogin()}
                className="px-3 sm:px-5 py-2 sm:py-2.5 text-gray-400 hover:text-white text-[11px] sm:text-xs font-bold sm:font-black tracking-wide transition-colors cursor-pointer"
              >
                Log in
              </button>
              <button
                onClick={onSignUp}
                className="px-4 sm:px-6 py-2 sm:py-2.5 landing-btn-vivid text-white text-[11px] sm:text-xs font-black rounded-full transition-all cursor-pointer"
              >
                Sign up
              </button>
            </>
          ) : (
            <button
              onClick={handleLaunchApp}
              className="px-4 sm:px-6 py-2 landing-btn-vivid text-white text-[10px] sm:text-xs font-black rounded-full transition-all cursor-pointer"
            >
              LAUNCH APP
            </button>
          )}

          {/* Hamburger — only when overflowing */}
          {overflowing && (
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {overflowing && mobileOpen && (
        <div className="border-t border-white/5 bg-[#0F1520]/95 backdrop-blur-2xl">
          <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className={`py-3 text-sm font-bold transition-colors ${
                  path.startsWith(href)
                    ? "text-[#34F080]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export const PublicFooter = () => (
  <footer className="border-t border-white/5 bg-[#0F1520]">
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-xs text-gray-600">
        &copy; {new Date().getFullYear()} ChatOn
      </p>
      <div className="flex items-center gap-6 text-xs text-gray-600">
        <a href="/about" className="hover:text-gray-400 transition-colors">
          About
        </a>
        <a href="/faq" className="hover:text-gray-400 transition-colors">
          FAQ
        </a>
        <a href="/compare" className="hover:text-gray-400 transition-colors">
          Compare
        </a>
        <a href="/privacy" className="hover:text-gray-400 transition-colors">
          Privacy
        </a>
        <a href="/terms" className="hover:text-gray-400 transition-colors">
          Terms
        </a>
        <a href="/donate" className="hover:text-gray-400 transition-colors">
          Donate
        </a>
      </div>
    </div>
  </footer>
);
