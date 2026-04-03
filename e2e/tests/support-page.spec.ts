import { test, expect } from "../fixtures";

test.describe("Support page", () => {
  test("loads with donation content", async ({ page, waitForAppReady }) => {
    await page.goto("/donate");
    await waitForAppReady();

    await expect(
      page.getByRole("heading", { level: 1, name: /messaging alive/i })
    ).toBeVisible();

    // Logged-out CTA card
    await expect(page.getByText(/send a tip with \$deso/i)).toBeVisible();

    await expect(
      page.getByRole("button", { name: /log in to support chaton/i })
    ).toBeVisible();

    // Nav LAUNCH APP button
    await expect(
      page.getByRole("button", { name: /launch app/i })
    ).toBeVisible();
  });

  test("has no unexpected console errors", async ({
    page,
    waitForAppReady,
    consoleErrors,
  }) => {
    await page.goto("/donate");
    await waitForAppReady();

    await page.waitForTimeout(2000);

    expect(consoleErrors).toEqual([]);
  });
});
