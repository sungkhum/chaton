import { test as base, expect } from "@playwright/test";

/**
 * Known console error patterns that are expected in the unauthenticated state.
 * These are filtered out when asserting "no console errors".
 */
const KNOWN_ERROR_PATTERNS = [
  // DeSo identity SDK fires this when no user is logged in
  /identity\.subscribe failed/i,
  // Expected 404s for resources that may not exist in dev
  /Failed to load resource/i,
  // React development-mode warnings
  /^Warning:/,
  // Vite HMR websocket noise
  /\[vite\]/i,
  // Service worker registration fails in dev mode (sw.js only built during vite build)
  /ServiceWorker/i,
  /serwist/i,
  /fetching the script/i,
  // WebSocket relay not running in local test environment
  /WebSocket connection/i,
];

function isKnownError(text: string): boolean {
  return KNOWN_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

type AppFixtures = {
  /** Waits for the splash screen to be removed from the DOM. */
  waitForAppReady: () => Promise<void>;
  /** Console error messages collected during the test (known patterns filtered). */
  consoleErrors: string[];
};

export const test = base.extend<AppFixtures>({
  waitForAppReady: async ({ page }, use) => {
    const waitFn = async () => {
      await page.waitForSelector("#splash", {
        state: "detached",
        timeout: 30_000,
      });
    };
    await use(waitFn);
  },

  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!isKnownError(text)) {
          errors.push(text);
        }
      }
    });

    await use(errors);
  },
});

export { expect };
