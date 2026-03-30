import { test, expect } from "../fixtures";

test.describe("Legal pages", () => {
  test("privacy policy loads with content", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/privacy");
    await waitForAppReady();

    await expect(
      page.getByRole("heading", { level: 1, name: /privacy policy/i })
    ).toBeVisible();

    await expect(
      page.getByText(/^last updated: /i)
    ).toBeVisible();

    // Key sections rendered
    await expect(
      page.getByRole("heading", { name: /what chaton is/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /data we do not collect/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /authentication/i })
    ).toBeVisible();
  });

  test("terms of service loads with content", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/terms");
    await waitForAppReady();

    await expect(
      page.getByRole("heading", { level: 1, name: /terms of service/i })
    ).toBeVisible();

    await expect(
      page.getByText(/^last updated: /i)
    ).toBeVisible();

    // Key sections rendered
    await expect(
      page.getByRole("heading", { name: /agreement/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /your account/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /blockchain permanence/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /acceptable use/i })
    ).toBeVisible();
  });

  test("footer cross-links between legal pages", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/privacy");
    await waitForAppReady();

    const footer = page.locator("footer");
    await footer.getByRole("link", { name: /terms/i }).click();

    await page.waitForURL("**/terms");

    await expect(
      page.getByRole("heading", { level: 1, name: /terms of service/i })
    ).toBeVisible();
  });
});
