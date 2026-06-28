import { MOBILE_WIDTH_BREAKPOINT } from "../utils/constants";
import { useEffect, useState } from "react";

export function useMobile() {
  const [width, setWidth] = useState<number>(window.innerWidth);

  function handleWindowSizeChange() {
    setWidth(window.innerWidth);
  }

  useEffect(() => {
    window.addEventListener("resize", handleWindowSizeChange);
    return () => {
      window.removeEventListener("resize", handleWindowSizeChange);
    };
  }, []);

  return {
    isMobile: width <= MOBILE_WIDTH_BREAKPOINT,
    // "Primary input is touch" — true for phones/tablets, false for
    // touchscreen desktops and 2-in-1s (which still report hover + a fine
    // pointer). navigator.maxTouchPoints > 0 is also true on touch-capable
    // desktops, which wrongly disabled Enter-to-send for them.
    isTouchDevice:
      typeof window.matchMedia === "function"
        ? window.matchMedia("(hover: none) and (pointer: coarse)").matches
        : navigator.maxTouchPoints > 0,
  };
}
