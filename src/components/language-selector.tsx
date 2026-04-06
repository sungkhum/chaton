import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Languages, ChevronDown } from "lucide-react";
import { useStore } from "../store";
import {
  cachePreferredLanguage,
  getCachedPreferredLanguage,
  cacheAutoTranslate,
  getCachedAutoTranslate,
} from "../services/cache.service";

/** Common languages — covers the vast majority of internet users. */
const LANGUAGES = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "it",
  "nl",
  "ru",
  "zh",
  "ja",
  "ko",
  "ar",
  "hi",
  "bn",
  "tr",
  "pl",
  "uk",
  "vi",
  "th",
  "sv",
  "da",
  "no",
  "fi",
  "cs",
  "ro",
  "hu",
  "el",
  "he",
  "id",
  "ms",
  "tl",
  "ca",
  "hr",
  "sr",
  "bg",
  "sk",
  "sl",
  "lt",
  "lv",
  "et",
  "ka",
  "ur",
  "fa",
  "ta",
  "te",
  "sw",
  "af",
] as const;

// js-cache-function-results: Intl.DisplayNames constructor is expensive —
// cache results at module level so they're computed once.
const langNameCache = new Map<string, string>();

function getLanguageName(code: string): string {
  const cached = langNameCache.get(code);
  if (cached) return cached;
  try {
    const name =
      new Intl.DisplayNames([code, "en"], { type: "language" }).of(code) ||
      code;
    langNameCache.set(code, name);
    return name;
  } catch {
    langNameCache.set(code, code);
    return code;
  }
}

export function LanguageSelector() {
  const appUser = useStore((s) => s.appUser);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [lang, setLang] = useState<string>(() => {
    if (!appUser) return navigator.language?.split("-")[0] || "en";
    return (
      getCachedPreferredLanguage(appUser.PublicKeyBase58Check) ||
      navigator.language?.split("-")[0] ||
      "en"
    );
  });

  const [autoTranslate, setAutoTranslateState] = useState<boolean>(() => {
    if (!appUser) return false;
    return getCachedAutoTranslate(appUser.PublicKeyBase58Check);
  });

  const selectLanguage = useCallback(
    (code: string) => {
      if (!appUser) return;
      setLang(code);
      cachePreferredLanguage(appUser.PublicKeyBase58Check, code);
      setOpen(false);
    },
    [appUser]
  );

  const toggleAutoTranslate = useCallback(() => {
    if (!appUser) return;
    const next = !autoTranslate;
    setAutoTranslateState(next);
    cacheAutoTranslate(appUser.PublicKeyBase58Check, next);
  }, [appUser, autoTranslate]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (!appUser) return null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Language selector row */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2.5 px-3 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
      >
        <div className="flex items-center">
          <Globe className="mr-3 w-[18px] h-[18px]" />
          <span className="text-[14px]">Language</span>
        </div>
        <div className="flex items-center gap-1 text-[12px] text-gray-400">
          <span>{getLanguageName(lang)}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Language dropdown */}
      {open && (
        <div className="absolute right-0 mt-1 w-56 max-h-64 overflow-y-auto bg-[#0d1520] border border-white/10 rounded-xl shadow-xl z-50 py-1">
          {LANGUAGES.map((code) => (
            <button
              key={code}
              onClick={() => selectLanguage(code)}
              className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors cursor-pointer ${
                code === lang
                  ? "text-[#34F080] bg-[#34F080]/10"
                  : "text-gray-300 hover:bg-white/[0.06]"
              }`}
            >
              {getLanguageName(code)}
            </button>
          ))}
        </div>
      )}

      {/* Auto-translate toggle */}
      <button
        onClick={toggleAutoTranslate}
        className="flex items-center justify-between w-full py-2.5 px-3 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
      >
        <div className="flex items-center">
          <Languages className="mr-3 w-[18px] h-[18px]" />
          <span className="text-[14px]">Auto-translate</span>
        </div>
        <div
          className={`relative w-9 h-5 rounded-full transition-colors ${
            autoTranslate ? "bg-[#34F080]" : "bg-white/15"
          }`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              autoTranslate ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </div>
      </button>
    </div>
  );
}

/** Re-export for use by other components */
export { getLanguageName };
