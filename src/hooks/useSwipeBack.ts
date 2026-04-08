import { useRef, useCallback } from "react";

const SWIPE_THRESHOLD = 50; // minimum px to trigger
const EDGE_ZONE = 80; // px from left edge to start tracking
const MAX_VERTICAL = 75; // ignore if vertical component is too large

/**
 * Detects a right-swipe starting from the left edge of the element.
 * Returns touch handlers to spread onto the container div.
 */
export function useSwipeBack(onSwipeBack: () => void) {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]!;
    // Only track swipes that start near the left edge
    if (touch.clientX <= EDGE_ZONE) {
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      tracking.current = true;
    } else {
      tracking.current = false;
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!tracking.current) return;
      tracking.current = false;

      const touch = e.changedTouches[0]!;
      const dx = touch.clientX - startX.current;
      const dy = Math.abs(touch.clientY - startY.current);

      if (dx > SWIPE_THRESHOLD && dy < MAX_VERTICAL) {
        onSwipeBack();
      }
    },
    [onSwipeBack]
  );

  return { onTouchStart, onTouchEnd };
}
