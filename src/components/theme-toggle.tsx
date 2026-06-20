import { useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";

/**
 * Switches the app between the default dark theme and an opt-in light theme.
 * The change is local and instant (no blockchain round-trip) — the whole UI
 * re-tinting is the feedback — and the preference is persisted per-device in
 * the store. See src/utils/theme.ts.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useStore(
    useShallow((s) => ({ theme: s.theme, setTheme: s.setTheme }))
  );

  const isLight = theme === "light";

  const toggle = useCallback(() => {
    setTheme(isLight ? "dark" : "light");
  }, [isLight, setTheme]);

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isLight}
      className="flex items-center justify-between w-full py-3 px-3 rounded-lg transition-colors text-fg-400 hover:text-ink hover:bg-ink/[0.06] cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#34F080]/50"
    >
      <div className="flex items-center">
        {isLight ? (
          <Sun className="mr-3 w-[18px] h-[18px] text-brand" />
        ) : (
          <Moon className="mr-3 w-[18px] h-[18px]" />
        )}
        <span className="text-[14px]">Light Mode</span>
      </div>

      <div
        className={`w-9 h-5 rounded-full transition-colors relative ${
          isLight ? "bg-[#34F080]" : "bg-ink/20"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            isLight ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  );
}
