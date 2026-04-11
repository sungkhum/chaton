import { test, expect } from "../fixtures";

/**
 * Tests for the spam filter settings UI in the settings modal.
 * Uses the dev-mode Zustand store injection to simulate a logged-in user.
 */
test.describe("Spam filter settings", () => {
  test.setTimeout(60_000);

  const MOCK_USER = {
    PublicKeyBase58Check:
      "BC1YLTestUserFakePublicKey000000000000000000000000000",
    ProfileEntryResponse: {
      Username: "test_user",
      PublicKeyBase58Check:
        "BC1YLTestUserFakePublicKey000000000000000000000000000",
    },
    messagingPublicKeyBase58Check:
      "BC1YLTestUserFakeMessagingKey0000000000000000000000",
    accessGroupsOwned: [],
    BalanceNanos: 1e9,
  };

  async function injectMockUser(page: any) {
    await page.evaluate((user: any) => {
      const store = (window as any).__CHATON_STORE__;
      if (!store) throw new Error("Store not exposed — is this a dev build?");
      store.setState({ appUser: user, isLoadingUser: false });
    }, MOCK_USER);
  }

  async function openSettingsModal(page: any) {
    // Open the user menu dropdown (header avatar/button)
    await page.getByLabel("User menu").click();
    // Click "Settings" menuitem inside the dropdown
    await page.getByRole("menuitem", { name: "Settings" }).click();
    // Wait for the modal to appear
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
      timeout: 5_000,
    });
  }

  test("message filter toggle appears in settings modal", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectMockUser(page);

    await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });
    await openSettingsModal(page);

    await expect(page.getByText("Message Filter")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("enabling filter shows threshold form", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectMockUser(page);

    await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });
    await openSettingsModal(page);

    // Click the Message Filter toggle to enable
    await page.getByText("Message Filter").click();

    // Should show the threshold form
    await expect(page.getByText("Require DeSo profile")).toBeVisible({
      timeout: 3_000,
    });
    await expect(page.getByText("Min DESO balance")).toBeVisible();
    await expect(page.getByText("Min creator coin price")).toBeVisible();
    await expect(page.getByText("Min coin holders")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("cancel button closes form without saving", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectMockUser(page);

    await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });
    await openSettingsModal(page);

    // Enable the filter
    await page.getByText("Message Filter").click();

    // Form should be visible
    await expect(page.getByText("Require DeSo profile")).toBeVisible({
      timeout: 3_000,
    });

    // Click Cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Form should be gone, and the filter should still be disabled
    await expect(page.getByText("Require DeSo profile")).not.toBeVisible();
    await expect(
      page.getByText("Auto-filtering unknown senders")
    ).not.toBeVisible();
  });

  test("spam filter store state matches defaults", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectMockUser(page);

    const filterState = await page.evaluate(() => {
      const store = (window as any).__CHATON_STORE__;
      const state = store.getState();
      return {
        enabled: state.spamFilter.enabled,
        minBalanceNanos: state.spamFilter.minBalanceNanos,
        requireProfile: state.spamFilter.requireProfile,
        associationId: state.spamFilterAssociationId,
      };
    });

    expect(filterState.enabled).toBe(false);
    expect(filterState.minBalanceNanos).toBe(0);
    expect(filterState.requireProfile).toBe(false);
    expect(filterState.associationId).toBeNull();
  });
});
