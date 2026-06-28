import { test, expect } from "../fixtures";

/**
 * Regression guard for the bug-report feedback flow.
 *
 * "What were you trying to do?" is labelled (optional) and the Continue button
 * only gates on "What went wrong?". Submitting with the optional field left
 * blank must succeed: the required backend field (userDescription) has to be
 * fed by the required UI field (whatWentWrong), not the optional one. A swap
 * here sends an empty userDescription and the worker rejects it with
 * "Missing: userDescription".
 *
 * Only works against the dev server (store is exposed via __CHATON_STORE__ and
 * the deso-protocol identity singleton can be stubbed via the Vite dep URL).
 */
test.describe("Bug report submission", () => {
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

  test("maps the required field correctly when the optional field is blank", async ({
    page,
    waitForAppReady,
  }) => {
    // Capture the outgoing /tickets/submit payload and stub a success response
    // so the test never touches the real relay.
    let submittedBody: Record<string, unknown> | null = null;
    await page.route("**/tickets/submit", async (route) => {
      submittedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, id: 1 }),
      });
    });

    await page.goto("/");
    await waitForAppReady();

    // Simulate a logged-in user, stub identity.jwt() (the mock user has no real
    // derived key to sign with), and open the feedback modal — all together so
    // the shell switch and modal mount happen in one render pass.
    const stubbed = await page.evaluate(async (user) => {
      const store = (window as any).__CHATON_STORE__;
      if (!store) throw new Error("Store not exposed — is this a dev build?");
      store.setState({ appUser: user, isLoadingUser: false });

      // The app and this import share the same Vite-cached module instance, so
      // patching jwt() here patches the singleton ticket.service.ts uses.
      const url = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((n) => /deso-protocol/i.test(n));
      if (!url) return false;
      const mod: any = await import(/* @vite-ignore */ url);
      if (!mod?.identity) return false;
      mod.identity.jwt = async () => "stubbed.jwt.token";

      store.getState().openFeedbackModal();
      return true;
    }, MOCK_USER);
    expect(stubbed).toBe(true);

    // Choose the bug path.
    await page.getByRole("button", { name: /Report a Bug/i }).click();

    // Fill only the required field; leave the optional one blank.
    const problem = "Messages aren't loading, the screen goes blank";
    await page.getByLabel("What went wrong?").fill(problem);

    await page.getByRole("button", { name: /^Continue$/ }).click();
    await page.getByRole("radio", { name: /Every single time/i }).click();
    await page.getByRole("button", { name: /^Submit$/ }).click();

    // The success step renders only when the submission resolved (no
    // "Missing: userDescription" rejection).
    await expect(page.getByText(/Thanks for reporting this!/i)).toBeVisible({
      timeout: 15_000,
    });

    // The required backend field must carry the required UI field's text, and
    // the optional context must be empty since we left it blank.
    expect(submittedBody).not.toBeNull();
    expect(submittedBody!.userDescription).toBe(problem);
    expect(submittedBody!.additionalContext ?? null).toBeNull();
  });
});
