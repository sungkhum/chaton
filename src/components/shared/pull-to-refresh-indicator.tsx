import { forwardRef, useImperativeHandle, useRef } from "react";
import type { PullToRefreshPhase } from "../../hooks/usePullToRefresh";

const RADIUS = 10;
const CIRC = 2 * Math.PI * RADIUS;
const SPIN_ARC = CIRC * 0.28;

export type PtrIndicatorHandle = {
  setPull: (px: number, progress: number) => void;
};

interface Props {
  phase: PullToRefreshPhase;
}

/**
 * Glass pill indicator that fills a progress ring as the user pulls, then
 * spins while the refresh promise is in-flight. Transient pull updates arrive
 * via the imperative handle so dragging never re-renders React. Phase changes
 * (idle / pulling / refreshing) do re-render — that flip drives the CSS
 * transition between the committed progress and the idle resting state.
 */
export const PullToRefreshIndicator = forwardRef<PtrIndicatorHandle, Props>(
  function PullToRefreshIndicator({ phase }, ref) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<SVGCircleElement>(null);

    useImperativeHandle(ref, () => ({
      setPull(px, progress) {
        const w = wrapperRef.current;
        if (w) {
          const ringProgress = Math.min(1, progress);
          const overpull = Math.min(0.06, Math.max(0, progress - 1) * 0.12);
          const scale = progress >= 1 ? 1 + overpull : 0.55 + 0.45 * progress;
          const opacity = Math.min(1, ringProgress * 1.25);
          const drop = Math.min(px * 0.4, 28);
          w.style.transform = `translate3d(-50%, ${drop}px, 0) scale(${scale})`;
          w.style.opacity = String(opacity);
        }
        const r = ringRef.current;
        if (r) {
          const clamped = Math.min(1, progress);
          r.style.strokeDashoffset = String(CIRC * (1 - clamped));
        }
      },
    }));

    const refreshing = phase === "refreshing";
    const idle = phase === "idle";

    return (
      <div
        ref={wrapperRef}
        aria-hidden={idle}
        role={refreshing ? "status" : undefined}
        aria-label={refreshing ? "Refreshing conversations" : undefined}
        data-phase={phase}
        className="pull-to-refresh-indicator pointer-events-none absolute left-1/2 top-3 z-20 flex h-12 w-12 items-center justify-center rounded-full text-[#34F080]"
        style={{
          transform: idle
            ? "translate3d(-50%, 0px, 0) scale(0.55)"
            : refreshing
            ? "translate3d(-50%, 28px, 0) scale(1)"
            : undefined,
          opacity: idle ? 0 : refreshing ? 1 : undefined,
          transition: idle
            ? "transform 420ms cubic-bezier(0.2, 0, 0, 1), opacity 280ms ease-out"
            : refreshing
            ? "transform 340ms cubic-bezier(0.2, 0, 0, 1), opacity 220ms ease-out"
            : "none",
          background: "rgba(10, 14, 18, 0.72)",
          WebkitBackdropFilter: "blur(18px) saturate(1.4)",
          backdropFilter: "blur(18px) saturate(1.4)",
          boxShadow:
            "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 6px 18px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(255, 255, 255, 0.08), 0 0 22px rgba(52, 240, 128, 0.18)",
          willChange: "transform, opacity",
        }}
      >
        <svg
          viewBox="0 0 28 28"
          className={`h-7 w-7 ${refreshing ? "ptr-spin" : ""}`}
        >
          <circle
            cx="14"
            cy="14"
            r={RADIUS}
            fill="none"
            stroke="rgba(255, 255, 255, 0.10)"
            strokeWidth="3"
          />
          <circle
            ref={ringRef}
            cx="14"
            cy="14"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            transform="rotate(-90 14 14)"
            style={{
              strokeDasharray: refreshing
                ? `${SPIN_ARC} ${CIRC - SPIN_ARC}`
                : `${CIRC}`,
              strokeDashoffset: refreshing ? 0 : CIRC,
              transition: idle
                ? "stroke-dashoffset 360ms cubic-bezier(0.2, 0, 0, 1)"
                : refreshing
                ? "stroke-dasharray 320ms cubic-bezier(0.2, 0, 0, 1), stroke-dashoffset 320ms cubic-bezier(0.2, 0, 0, 1)"
                : "none",
            }}
          />
        </svg>
      </div>
    );
  }
);
