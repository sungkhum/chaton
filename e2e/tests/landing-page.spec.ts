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

    // Hero CTA buttons
    await expect(
      page.getByRole("button", { name: /start messaging/i }).first()
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /explore communities/i })
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

  test("Log in button calls identity login", async ({
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

    // Landing page uses variant="auth" nav — click "Log in" button
    await page
      .getByRole("button", { name: /log in/i })
      .first()
      .dispatchEvent("click");

    // Give the SDK a moment to call window.open
    await page.waitForTimeout(3000);

    expect(openedUrls.some((u) => u.includes("identity.deso.org"))).toBe(true);
  });

  test("footer has navigation links", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();

    // Scroll to the bottom so the footer is in view
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Landing page has its own footer (class="landing-footer")
    const footer = page.locator("footer.landing-footer");

    await expect(
      footer.getByRole("link", { name: /github/i })
    ).toHaveAttribute("href", "https://github.com/sungkhum/chaton");

    await expect(
      footer.getByRole("link", { name: /donate/i })
    ).toHaveAttribute("href", "/donate");

    await expect(
      footer.getByRole("link", { name: /privacy/i })
    ).toHaveAttribute("href", "/privacy");

    await expect(
      footer.getByRole("link", { name: /terms/i })
    ).toHaveAttribute("href", "/terms");
  });

  test("nav has main navigation links", async ({
    page,
    waitForAppReady,
  }, testInfo) => {
    // Nav links collapse into hamburger on mobile
    test.skip(testInfo.project.name === "mobile", "Desktop-only: nav links collapse on mobile");
    await page.goto("/");
    await waitForAppReady();

    const nav = page.locator("nav");

    await expect(
      nav.getByRole("link", { name: /community/i })
    ).toHaveAttribute("href", "/community");

    await expect(
      nav.getByRole("link", { name: /blog/i })
    ).toHaveAttribute("href", "/blog");

    await expect(
      nav.getByRole("link", { name: /about/i })
    ).toHaveAttribute("href", "/about");
  });
});
