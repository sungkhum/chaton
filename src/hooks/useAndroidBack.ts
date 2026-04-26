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
export function useAndroidBack(active: boolean, onBack: () => void) {
  const didPushRef = useRef(false);
  // advanced-event-handler-refs: keep latest onBack in a ref so the popstate
  // listener doesn't need to re-register every render.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (active && !didPushRef.current) {
      window.history.pushState({ chaton: "back" }, "");
      didPushRef.current = true;
    } else if (!active && didPushRef.current) {
      didPushRef.current = false;
      window.history.back();
    }
  }, [active]);

  useEffect(() => {
    const handler = () => {
      if (!didPushRef.current) return;
      didPushRef.current = false;
      onBackRef.current();
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (didPushRef.current) {
        didPushRef.current = false;
        window.history.back();
      }
    };
  }, []);
}
