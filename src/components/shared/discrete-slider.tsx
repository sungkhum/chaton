interface DiscreteSliderProps {
  /** Ordered array of raw numeric values the slider snaps to. */
  stops: number[];
  /** Current index into the stops array. */
  index: number;
  /** Called with the new index on change. */
  onChange: (index: number) => void;
  /** Formats a stop value for the label displayed beneath the track. */
  formatLabel: (value: number) => string;
  /** Indices of stops whose labels should be shown (all others hidden). */
  visibleLabels?: number[];
  /** Optional aria-label for accessibility. */
  ariaLabel?: string;
  /** Whether the slider is disabled. */
  disabled?: boolean;
}

/** Find the index of the stop closest to the given value. */
export function findClosestStopIndex(stops: number[], value: number): number {
  let best = 0;
  let bestDist = Math.abs(stops[0]! - value);
  for (let i = 1; i < stops.length; i++) {
    const dist = Math.abs(stops[i]! - value);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}

export function DiscreteSlider({
  stops,
  index,
  onChange,
  formatLabel,
  visibleLabels,
  ariaLabel,
  disabled,
}: DiscreteSliderProps) {
  const fillPercent = stops.length > 1 ? (index / (stops.length - 1)) * 100 : 0;
  const value = stops[index] ?? 0;

  return (
    <div className="w-full">
      <input
        type="range"
        min={0}
        max={stops.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={stops[0]}
        aria-valuemax={stops[stops.length - 1]}
        aria-valuenow={value}
        aria-valuetext={formatLabel(value)}
        className="discrete-slider w-full"
        style={{
          background: `linear-gradient(to right, #34F080 0%, #34F080 ${fillPercent}%, rgba(255,255,255,0.1) ${fillPercent}%, rgba(255,255,255,0.1) 100%)`,
        }}
      />
      <div className="flex justify-between mt-1 px-0.5">
        {stops.map((stop, i) => {
          const show = !visibleLabels || visibleLabels.includes(i);
          return (
            <span
              key={i}
              className={`text-[10px] leading-none select-none ${
                i === index ? "text-[#34F080]" : "text-gray-500"
              } ${show ? "" : "invisible"}`}
            >
              {formatLabel(stop)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
