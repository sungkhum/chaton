import { test, expect } from "../fixtures";

/**
 * Light/dark theme toggle. ChatOn defaults to dark; users can opt into a light
 * theme from Settings. The preference is applied as a `light`/`dark` class on
 * <html> and persisted to localStorage (chaton:theme). Only the in-app shell
 * honors it — public/marketing routes always render dark.
 *
 * Uses the dev-only store bridge (__CHATON_STORE__) to simulate a logged-in user.
 */
test.describe("Theme toggle", () => {
  test.setTimeout(60_000);

  const MOCK_USER = {
    PublicKeyBase58Check: "BC1YLTestUserFakePublicKey000000000000000000000000000",
    ProfileEntryResponse: {
      Username: "test_user",
      PublicKeyBase58Check:
        "BC1YLTestUserFakePublicKey000000000000000000000000000",
    },
    messagingPublicKeyBase58Check:
      "BC1YLTestUserFakeMessagingKey0000000000000000000000",
    accessGroupsOwned: [],
  };

  async function injectUser(page: import("@playwright/test").Page) {
    await page.evaluate((user) => {
      const store = (window as any).__CHATON_STORE__;
      if (!store) throw new Error("Store not exposed — is this a dev build?");
      store.setState({ appUser: user, isLoadingUser: false });
    }, MOCK_USER);
  }

  async function openSettings(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: "User menu" }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Settings" })
    ).toBeVisible();
  }

  test("defaults to dark and switches to light from settings", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);
    await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });

    // Default: dark.
    await expect(page.locator("html")).toHaveClass(/dark/);

    await openSettings(page);

    const toggle = page.getByRole("switch", { name: "Light Mode" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    // Switch to light.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Persisted to localStorage.
    const stored = await page.evaluate(() =>
      localStorage.getItem("chaton:theme")
    );
    expect(stored).toBe("light");

    // The page background actually flips to a light color (not the dark base).
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor
    );
    // Dark base is ~rgb(4,6,9); light base is much brighter.
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    expect(r + g + b).toBeGreaterThan(300);
  });

  test("preference persists across reload", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);
    await openSettings(page);
    await page.getByRole("switch", { name: "Light Mode" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);

    // Re-inject the user after reload (the dev bridge has no real auth) and
    // confirm the stored light preference is re-applied to <html>.
    await page.reload();
    await waitForAppReady();
    await injectUser(page);
    await expect(page.locator("html")).toHaveClass(/light/);
  });

  test("logged-out landing page stays dark even with a light preference", async ({
    page,
    waitForAppReady,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("chaton:theme", "light");
    });
    await page.goto("/");
    await waitForAppReady();

    // No user injected → logged-out landing. Must stay dark (brand site).
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("html")).not.toHaveClass(/light/);
  });
});
