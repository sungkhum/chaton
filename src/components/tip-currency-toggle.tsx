import { useCallback, useState } from "react";
import { Coins } from "lucide-react";
import { useStore } from "../store";
import {
  cacheTipCurrency,
  getCachedTipCurrency,
} from "../services/cache.service";
import type { TipCurrency } from "../utils/extra-data";

export function TipCurrencyToggle() {
  const appUser = useStore((s) => s.appUser);
  const [currency, setCurrency] = useState<TipCurrency>(() => {
    if (!appUser) return "DESO";
    return (
      (getCachedTipCurrency(appUser.PublicKeyBase58Check) as TipCurrency) ||
      "DESO"
    );
  });

  const toggle = useCallback(() => {
    if (!appUser) return;
    const next: TipCurrency = currency === "DESO" ? "USDC" : "DESO";
    setCurrency(next);
    cacheTipCurrency(appUser.PublicKeyBase58Check, next);
  }, [appUser, currency]);

  if (!appUser) return null;

  const isDeso = currency === "DESO";

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-between w-full py-2.5 px-3 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
    >
      <div className="flex items-center">
        <Coins className="mr-3 w-[18px] h-[18px]" />
        <span className="text-[14px]">Tip Currency</span>
      </div>

      <div className="flex bg-white/5 border border-white/10 rounded-full p-0.5 text-[11px] font-semibold">
        <span
          className={`px-2 py-0.5 rounded-full transition-all ${
            isDeso
              ? "bg-[#2775ca] text-white shadow-[0_0_8px_rgba(39,117,202,0.3)]"
              : "text-gray-500"
          }`}
        >
          DESO
        </span>
        <span
          className={`px-2 py-0.5 rounded-full transition-all ${
            !isDeso
              ? "bg-[#34F080] text-black shadow-[0_0_8px_rgba(52,240,128,0.2)]"
              : "text-gray-500"
          }`}
        >
          USDC
        </span>
      </div>
    </button>
  );
}
