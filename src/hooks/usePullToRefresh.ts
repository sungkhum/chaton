import { RefObject, useEffect, useRef, useState } from "react";

export type PullToRefreshPhase = "idle" | "pulling" | "refreshing";

const THRESHOLD = 64;
const MAX_PULL = 140;
const MIN_ACTIVATION = 4;
const HORIZONTAL_TOLERANCE = 1.5;

interface Options {
  scrollRef: RefObject<HTMLElement | null>;
  onRefresh: () => void | Promise<unknown>;
  enabled?: boolean;
  /**
   * Per-frame callback with the current indicator travel in px and the
   * normalized progress toward the trigger threshold (0–1, uncapped above 1
   * during overpull). Wire this to an imperative ref on the indicator so the
   * parent component does not re-render every touchmove.
   */
  onProgress?: (px: number, progress: number) => void;
  threshold?: number;
}

export function usePullToRefresh({
  scrollRef,
  onRefresh,
  enabled = true,
  onProgress,
  threshold = THRESHOLD,
}: Options) {
  const [phase, setPhase] = useState<PullToRefreshPhase>("idle");
  const phaseRef = useRef<PullToRefreshPhase>("idle");
  const mountedRef = useRef(true);

  const onRefreshRef = useRef(onRefresh);
  const onProgressRef = useRef(onProgress);
  onRefreshRef.current = onRefresh;
  onProgressRef.current = onProgress;

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;

    let tracking = false;
    let locked = false;
    let startX = 0;
    let startY = 0;
    let activeTouch: number | null = null;
    let currentPx = 0;
    let rafId = 0;
    let armed = false;

    const setPhaseBoth = (p: PullToRefreshPhase) => {
      phaseRef.current = p;
      if (mountedRef.current) setPhase(p);
    };

    const emit = (px: number) => {
      currentPx = px;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (mountedRef.current) onProgressRef.current?.(px, px / threshold);
      });
    };

    const onTouchStart = (e: TouchEvent) => {
      if (phaseRef.current === "refreshing") return;
      if (el.scrollTop > 0) return;
      if (e.touches.length !== 1) return;
      const t = e.touches[0]!;
      startX = t.clientX;
      startY = t.clientY;
      activeTouch = t.identifier;
      tracking = true;
      locked = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      let t: Touch | undefined;
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i]!;
        if (touch.identifier === activeTouch) {
          t = touch;
          break;
        }
      }
      if (!t) return;

      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!locked) {
        if (dy < MIN_ACTIVATION) return;
        if (Math.abs(dx) * HORIZONTAL_TOLERANCE > dy) {
          tracking = false;
          return;
        }
        if (el.scrollTop > 0) {
          tracking = false;
          return;
        }
        locked = true;
        setPhaseBoth("pulling");
      }

      if (e.cancelable) e.preventDefault();
      const resisted = MAX_PULL * (1 - Math.exp(-dy / MAX_PULL));
      if (!armed && resisted >= threshold) {
        armed = true;
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(6);
        }
      } else if (armed && resisted < threshold) {
        armed = false;
      }
      emit(resisted);
    };

    const finishTouch = () => {
      tracking = false;
      locked = false;
      activeTouch = null;
      armed = false;
    };

    const onTouchEnd = () => {
      if (!locked) {
        finishTouch();
        return;
      }
      const finalPx = currentPx;
      finishTouch();
      if (finalPx >= threshold) {
        setPhaseBoth("refreshing");
        emit(threshold);
        Promise.resolve()
          .then(() => onRefreshRef.current())
          .catch(() => {})
          .finally(() => {
            emit(0);
            setPhaseBoth("idle");
          });
      } else {
        emit(0);
        setPhaseBoth("idle");
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [enabled, scrollRef, threshold]);

  return { phase };
}
