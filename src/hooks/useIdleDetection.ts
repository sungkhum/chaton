import { useEffect, useRef, useState } from "react";
import { IDLE_TIMEOUT_MS } from "../utils/constants";

/**
 * Detects user inactivity. Returns true when the user hasn't interacted
 * (mouse, keyboard, touch, scroll) for the configured timeout period.
 */
export function useIdleDetection(timeoutMs = IDLE_TIMEOUT_MS): boolean {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const resetTimer = () => {
      const now = Date.now();
      // Throttle: skip if last reset was < 1s ago and not currently idle
      if (now - lastActivityRef.current < 1000 && !isIdle) return;
      lastActivityRef.current = now;

      if (timerRef.current) clearTimeout(timerRef.current);
      setIsIdle(false);
      timerRef.current = setTimeout(() => setIsIdle(true), timeoutMs);
    };

    const events = [
      "mousemove",
      "keydown",
      "touchstart",
      "scroll",
      "pointerdown",
    ] as const;

    resetTimer();

    for (const event of events) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of events) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [timeoutMs, isIdle]);

  return isIdle;
}
