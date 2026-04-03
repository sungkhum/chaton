import { test, expect } from "../fixtures";

/**
 * Simulate a logged-in user by injecting a mock user into the Zustand store.
 * This catches regressions where routing or animation changes cause a blank
 * screen for authenticated users (e.g. the showLanding / contentReady bug).
 *
 * Only works against the dev server (store is exposed via __CHATON_STORE__).
 */
test.describe("Logged-in app shell", () => {
  test.setTimeout(60_000);

  const MOCK_USER = {
    PublicKeyBase58Check: "BC1YLTestUserFakePublicKey000000000000000000000000000",
    ProfileEntryResponse: {
      Username: "test_user",
      PublicKeyBase58Check: "BC1YLTestUserFakePublicKey000000000000000000000000000",
    },
    messagingPublicKeyBase58Check: "BC1YLTestUserFakeMessagingKey0000000000000000000000",
    accessGroupsOwned: [],
  };

  test("renders app shell after injecting mock user (no black screen)", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();

    // Inject a mock logged-in user via the Zustand store
    await page.evaluate((user) => {
      const store = (window as any).__CHATON_STORE__;
      if (!store) throw new Error("Store not exposed — is this a dev build?");
      store.setState({ appUser: user, isLoadingUser: false });
    }, MOCK_USER);

    // The app should transition to the messaging shell — the header must be
    // visible. A blank/black screen means the routing pipeline broke.
    await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });

    // Verify we're NOT still showing the landing page
    await expect(
      page.getByRole("heading", { name: /messaging that no one can shut down/i })
    ).not.toBeVisible();
  });

  test("loading state shows indicator, not blank screen", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();

    // Simulate the "identity is still loading" state that happens on app open
    // for logged-in users (isLoadingUser: true, appUser: null on "/").
    await page.evaluate(() => {
      const store = (window as any).__CHATON_STORE__;
      if (!store) throw new Error("Store not exposed — is this a dev build?");
      store.setState({ appUser: null, isLoadingUser: true });
    });

    // Must show the loading spinner, NOT the landing page
    // (which starts elements at autoAlpha:0 = black screen), and NOT a blank div.
    await expect(
      page.locator(".animate-spin")
    ).toBeVisible({ timeout: 5_000 });

    // Landing page hero must NOT be rendered during loading
    await expect(
      page.getByRole("heading", { name: /messaging that no one can shut down/i })
    ).not.toBeVisible();
  });
});
