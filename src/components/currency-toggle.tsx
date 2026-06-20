import type { TipCurrency } from "../utils/extra-data";

interface CurrencyToggleProps {
  value: TipCurrency;
  onChange: (currency: TipCurrency) => void;
}

export const CurrencyToggle = ({ value, onChange }: CurrencyToggleProps) => {
  return (
    <div
      role="radiogroup"
      aria-label="Select tip currency"
      className="flex bg-ink/5 border border-ink/10 rounded-full p-0.5 mb-4"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "DESO"}
        onClick={() => onChange("DESO")}
        className={`flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer truncate ${
          value === "DESO"
            ? "bg-[#2775ca] text-ink shadow-[0_0_12px_rgba(39,117,202,0.3)]"
            : "text-fg-500 hover:text-fg-300"
        }`}
      >
        DESO
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "USDC"}
        onClick={() => onChange("USDC")}
        className={`flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer truncate ${
          value === "USDC"
            ? "bg-[#34F080] text-black shadow-[0_0_12px_rgba(52,240,128,0.2)]"
            : "text-fg-500 hover:text-fg-300"
        }`}
      >
        USDC
      </button>
    </div>
  );
};
