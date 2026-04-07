import { test, expect } from "../fixtures";

// These tests are only meaningful in the mobile project.
test.describe("Mobile viewport", () => {
  test("landing page renders at mobile size", async ({
    page,
    waitForAppReady,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only test");

    await page.goto("/");
    await waitForAppReady();

    // Hero title visible
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /messaging that no one can shut down/i,
      })
    ).toBeVisible();

    // Auth buttons accessible (landing page uses variant="auth")
    await expect(
      page.getByRole("button", { name: /sign up/i })
    ).toBeVisible();
  });

  test("legal page is readable at mobile width", async ({
    page,
    waitForAppReady,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only test");

    await page.goto("/privacy");
    await waitForAppReady();

    await expect(
      page.getByRole("heading", { level: 1, name: /privacy policy/i })
    ).toBeVisible();

    // Content sections are visible
    await expect(
      page.getByRole("heading", { name: /what chaton is/i })
    ).toBeVisible();

    // Scroll to the bottom to ensure the page is scrollable
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect(
      page.getByRole("heading", { name: /contact/i })
    ).toBeVisible();
  });
});
