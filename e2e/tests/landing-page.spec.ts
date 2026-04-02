import { test, expect } from "../fixtures";

// Landing page requires DeSo SDK initialization + splash screen removal.
// The first load on a cold Vite server can be slow due to module compilation.
test.describe("Landing page", () => {
  test.setTimeout(60_000);
  test("renders visible content after splash (no black screen)", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();

    // Root must have visible content — catches blank/black screen regressions
    // from routing or animation changes.
    await expect(
      page.getByRole("heading", { level: 1, name: /messaging that no one can shut down/i })
    ).toBeVisible();
  });

  test("displays hero content", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /messaging that no one can shut down/i,
      })
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /launch app/i })
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /start messaging for free/i }).first()
    ).toBeVisible();
  });

  test("has no unexpected console errors", async ({
    page,
    waitForAppReady,
    consoleErrors,
  }) => {
    await page.goto("/");
    await waitForAppReady();

    // Allow time for deferred scripts / async init
    await page.waitForTimeout(2000);

    expect(consoleErrors).toEqual([]);
  });

  test("LAUNCH APP button calls identity login", async ({
    page,
    waitForAppReady,
  }, testInfo) => {
    // Mobile uses redirect flow (not window.open), so this is desktop-only
    test.skip(testInfo.project.name === "mobile", "Desktop-only: mobile uses redirect flow");
    await page.goto("/");
    await waitForAppReady();

    // Intercept window.open to verify identity.login() targets DeSo Identity.
    // The DeSo SDK opens the identity popup after an async call, which can:
    // 1. Get blocked by the browser popup blocker
    // 2. Steal focus and prevent Playwright's click() from resolving
    // We intercept window.open and use dispatchEvent to avoid Playwright's
    // post-click waiting logic.
    const openedUrls: string[] = [];
    await page.exposeFunction("__pw_captureOpen", (url: string) => {
      openedUrls.push(url);
    });
    await page.evaluate(() => {
      const origOpen = window.open;
      window.open = function (...args: Parameters<typeof window.open>) {
        const url =
          typeof args[0] === "string"
            ? args[0]
            : args[0]?.toString() ?? "";
        (window as any).__pw_captureOpen(url);
        // Return null to prevent the popup from actually opening and stealing focus
        return null;
      };
    });

    // Use dispatchEvent to avoid Playwright's post-click navigation checks
    await page
      .getByRole("button", { name: /launch app/i })
      .first()
      .dispatchEvent("click");

    // Give the SDK a moment to call window.open
    await page.waitForTimeout(3000);

    expect(openedUrls.some((u) => u.includes("identity.deso.org"))).toBe(true);
  });

  test("footer has navigation links", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();

    const footer = page.locator("footer");

    await expect(
      footer.getByRole("link", { name: /github/i })
    ).toHaveAttribute("href", "https://github.com/sungkhum/chaton");

    await expect(
      footer.getByRole("link", { name: /support/i })
    ).toHaveAttribute("href", "/support");

    await expect(
      footer.getByRole("link", { name: /privacy/i })
    ).toHaveAttribute("href", "/privacy");

    await expect(
      footer.getByRole("link", { name: /terms/i })
    ).toHaveAttribute("href", "/terms");
  });

  test("nav has Features and Technology section links", async ({
    page,
    waitForAppReady,
  }, testInfo) => {
    // These nav links are hidden on mobile (hidden md:flex)
    test.skip(testInfo.project.name === "mobile", "Desktop-only: nav links hidden on mobile");
    await page.goto("/");
    await waitForAppReady();

    const nav = page.locator("nav");

    await expect(
      nav.getByRole("link", { name: /features/i })
    ).toHaveAttribute("href", "#features");

    await expect(
      nav.getByRole("link", { name: /technology/i })
    ).toHaveAttribute("href", "#technology");
  });
});
