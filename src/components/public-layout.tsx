import { identity } from "deso-protocol";
import { useStore } from "../store";

const NAV_LINKS = [
  { href: "/community", label: "Community" },
  { href: "/blog", label: "Blog" },
  { href: "/compare", label: "Compare" },
];

export const PublicNav = () => {
  const path = window.location.pathname;

  const handleLaunchApp = () => {
    if (useStore.getState().appUser) {
      window.location.href = "/";
    } else {
      identity.login();
    }
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0F1520]/90 backdrop-blur-2xl border-b border-white/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a
          href="/"
          className="flex items-center gap-2.5 sm:gap-3 hover:opacity-80 transition-opacity"
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

        {/* Nav links — always visible */}
        <div className="flex items-center gap-5 sm:gap-7 text-[10px] sm:text-xs font-bold tracking-[0.15em] uppercase text-gray-500">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className={`hover:text-[#34F080] transition-colors ${
                path.startsWith(href) ? "text-[#34F080]" : ""
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Launch / Login */}
        <button
          onClick={handleLaunchApp}
          className="px-4 sm:px-6 py-2 landing-btn-vivid text-white text-[10px] sm:text-xs font-black rounded-full transition-all cursor-pointer"
        >
          LAUNCH APP
        </button>
      </div>
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
