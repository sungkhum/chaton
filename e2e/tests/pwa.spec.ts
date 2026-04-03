import { test, expect } from "../fixtures";

// PWA tests run against the preview server (built app with service worker).
// They need extra time because the DeSo SDK init + SW registration can be slow
// when running alongside other test projects.
test.describe("PWA", () => {
  test.setTimeout(60_000);

  test("service worker registers successfully", async ({
    page,
    context,
  }) => {
    // Use Playwright's context API to detect SW registration, which is more
    // reliable than evaluating navigator.serviceWorker.ready in-page.
    const swPromise = context.waitForEvent("serviceworker", {
      timeout: 30_000,
    });

    await page.goto("/");
    await page.waitForLoadState("load");

    const sw = await swPromise;
    expect(sw.url()).toContain("sw.js");
  });

  test("app shell loads when offline", async ({ page, context }) => {
    // Wait for SW to register and activate
    const swPromise = context.waitForEvent("serviceworker", {
      timeout: 30_000,
    });

    await page.goto("/");
    await page.waitForLoadState("load");

    await swPromise;

    // Give the SW time to complete precaching all assets
    await page.waitForTimeout(3000);

    await context.setOffline(true);

    // reload() can throw ERR_INTERNET_DISCONNECTED if the SW hasn't cached
    // all resources. Use try/catch — the assertion below is what matters.
    try {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 10_000 });
    } catch {
      // Page may still have rendered from SW cache despite the error
    }

    // The app shell should still render from cache
    await expect(page.locator("#root")).toBeAttached({ timeout: 10_000 });

    await context.setOffline(false);
  });

  test("renders visible content (no black screen)", async ({
    page,
    context,
    waitForAppReady,
  }) => {
    const swPromise = context.waitForEvent("serviceworker", {
      timeout: 30_000,
    });

    await page.goto("/");
    await swPromise;
    await waitForAppReady();

    // After splash removal the page must have visible content — either the
    // landing page hero or the loading indicator. A black screen means the
    // routing/animation pipeline broke.
    await expect(
      page.getByRole("heading", { level: 1, name: /messaging that no one can shut down/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("manifest.json is valid", async ({ page }) => {
    const response = await page.goto("/manifest.json");
    expect(response?.status()).toBe(200);

    const manifest = await response?.json();
    expect(manifest.name).toBe("ChatOn — Encrypted Messaging on DeSo");
    expect(manifest.short_name).toBe("ChatOn");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThan(0);
    expect(manifest.start_url).toBe("/");
    expect(manifest.id).toBe("/");

    // Android installability requires a 192x192 icon
    const has192 = manifest.icons.some(
      (icon: { sizes?: string }) => icon.sizes === "192x192"
    );
    expect(has192).toBe(true);
  });

  test("offline fallback page is accessible", async ({ page }) => {
    const response = await page.goto("/offline.html");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
  });
});
