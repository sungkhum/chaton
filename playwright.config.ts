import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
const PWA = !!process.env.PLAYWRIGHT_PWA;

// When PLAYWRIGHT_PWA is set (via test:e2e:ci), all projects use the preview
// server on port 4173. This avoids conflicts between the dev server's Serwist
// plugin and the dist/ directory.
const baseURL = PWA ? "http://localhost:4173" : "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? "50%" : undefined,
  reporter: CI ? [["html", { open: "never" }]] : "list",

  use: {
    actionTimeout: 15_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  expect: {
    timeout: 10_000,
  },

  projects: [
    {
      name: "desktop",
      testIgnore: PWA ? undefined : "**/pwa.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
        reducedMotion: "reduce",
      },
    },
    {
      name: "mobile",
      testIgnore: PWA ? undefined : "**/pwa.spec.ts",
      use: {
        ...devices["Pixel 7"],
        baseURL,
        reducedMotion: "reduce",
      },
    },
  ],

  webServer: PWA
    ? {
        command: "npm run preview -- --port 4173",
        url: "http://localhost:4173",
        reuseExistingServer: !CI,
      }
    : {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !CI,
      },
});
