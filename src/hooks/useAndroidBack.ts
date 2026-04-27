import { useEffect, useRef } from "react";

/**
 * Intercept the browser/system back button (most visible on Android PWA, where
 * pressing Back would otherwise close the app) and turn it into "go back to the
 * conversation list".
 *
 * Pushes a synthetic history entry while `active` is true so the back button
 * has something to pop. When that entry pops (popstate), `onBack` is called.
 * When `active` flips back to false via an in-app affordance (chevron, swipe),
 * the synthetic entry is removed via `history.back()` to keep the stack in sync.
 */
const SYNTHETIC_STATE_KEY = "back";

function isOurSyntheticEntry() {
  return (
    typeof window !== "undefined" &&
    (window.history.state as { chaton?: string } | null)?.chaton ===
      SYNTHETIC_STATE_KEY
  );
}

export function useAndroidBack(active: boolean, onBack: () => void) {
  const didPushRef = useRef(false);
  // advanced-event-handler-refs: keep latest onBack in a ref so the popstate
  // listener doesn't need to re-register every render.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (active && !didPushRef.current) {
      window.history.pushState({ chaton: SYNTHETIC_STATE_KEY }, "");
      didPushRef.current = true;
    } else if (!active && didPushRef.current) {
      didPushRef.current = false;
      // Only pop the entry if it's still our synthetic one. Guards against
      // unrelated navigation (resize flipping isMobile, route changes, other
      // history.pushState callers) accidentally popping a real prior entry.
      if (isOurSyntheticEntry()) {
        window.history.back();
      }
    }
  }, [active]);

  useEffect(() => {
    const handler = () => {
      if (!didPushRef.current) return;
      // If our synthetic entry is still the top of the stack, this popstate
      // came from some other navigation — don't treat it as a back press.
      if (isOurSyntheticEntry()) return;
      didPushRef.current = false;
      onBackRef.current();
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (didPushRef.current && isOurSyntheticEntry()) {
        didPushRef.current = false;
        window.history.back();
      } else {
        didPushRef.current = false;
      }
    };
  }, []);
}
