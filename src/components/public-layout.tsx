import { useEffect, useRef, useState } from "react";
import { identity } from "deso-protocol";
import { ChevronDown, Menu, X } from "lucide-react";

/** Links shown directly in the desktop nav bar (highest priority). */
const PRIMARY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/compare", label: "Compare" },
  { href: "/community", label: "Community" },
];

/** Links inside the desktop "More" dropdown. */
const MORE_LINKS = [
  { href: "/faq", label: "FAQ" },
  { href: "/support", label: "Support" },
];

/** All links shown in the mobile hamburger menu. */
const ALL_LINKS = [...PRIMARY_LINKS, ...MORE_LINKS];

export const PublicNav = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const path = window.location.pathname;

  // Close desktop "More" dropdown when clicking outside
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [moreOpen]);

  const linkClass = (href: string) =>
    `hover:text-[#34F080] transition-colors ${
      path === href ? "text-[#34F080]" : ""
    }`;

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0F1520]/90 backdrop-blur-2xl border-b border-white/5">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a
          href="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img
            src="/ChatOn-Logo-Small.png"
            alt="ChatOn"
            className="w-9 h-9 rounded-xl"
          />
          <span className="text-xl font-black tracking-tighter">ChatOn</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7 text-xs font-bold tracking-[0.15em] uppercase text-gray-500">
          {PRIMARY_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className={linkClass(href)}>
              {label}
            </a>
          ))}

          {/* "More" dropdown */}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center gap-1 hover:text-[#34F080] transition-colors cursor-pointer ${
                MORE_LINKS.some((l) => l.href === path) ? "text-[#34F080]" : ""
              }`}
              aria-expanded={moreOpen}
              aria-haspopup="true"
            >
              More
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${
                  moreOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {moreOpen && (
              <div className="absolute top-full right-0 mt-2 py-2 w-40 rounded-xl bg-[#131A28] border border-white/10 shadow-xl shadow-black/40">
                {MORE_LINKS.map(({ href, label }) => (
                  <a
                    key={href}
                    href={href}
                    className={`block px-4 py-2.5 text-xs font-bold tracking-[0.1em] uppercase transition-colors ${
                      path === href
                        ? "text-[#34F080]"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => identity.login()}
            className="hidden md:block px-6 py-2 landing-btn-vivid text-white text-xs font-black rounded-full transition-all cursor-pointer"
          >
            LAUNCH APP
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#0F1520]/95 backdrop-blur-2xl">
          <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col gap-1">
            {ALL_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className={`py-3 text-sm font-bold transition-colors ${
                  path === href
                    ? "text-[#34F080]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {label}
              </a>
            ))}
            <div className="pt-3 mt-2 border-t border-white/5">
              <button
                onClick={() => identity.login()}
                className="w-full py-3 landing-btn-vivid text-white text-sm font-black rounded-xl transition-all cursor-pointer"
              >
                LAUNCH APP
              </button>
            </div>
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
        <a href="/support" className="hover:text-gray-400 transition-colors">
          Support
        </a>
      </div>
    </div>
  </footer>
);
