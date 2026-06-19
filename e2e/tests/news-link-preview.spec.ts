import { test, expect } from "../fixtures";

/**
 * Verify that a news article URL (e.g. Yahoo Finance) renders a WhatsApp-style
 * generic link preview card — hero image, title, description, and domain —
 * once the worker returns real Open Graph data.
 *
 * The reported bug: publishers like Yahoo Finance gate non-whitelisted bots
 * behind a GDPR consent interstitial, so the worker used to parse
 * og:title="Your privacy choices" and render a near-empty card. The worker now
 * crawls as facebookexternalhit (whitelisted) and drops any consent placeholder
 * it still receives, returning an empty object. This test covers both the
 * rich-card path and the graceful no-card fallback.
 *
 * Mocks the worker OG endpoint so tests don't depend on network access.
 */

const MOCK_USER_KEY = "BC1YLTestUserFakePublicKey000000000000000000000000000";
const OTHER_USER_KEY = "BC1YLOtherUserFakePublicKey00000000000000000000000000";

const ARTICLE_URL =
  "https://finance.yahoo.com/sectors/technology/articles/company-blew-500m-claude-ai-173519468.html";

const MOCK_USER = {
  PublicKeyBase58Check: MOCK_USER_KEY,
  ProfileEntryResponse: {
    Username: "test_user",
    PublicKeyBase58Check: MOCK_USER_KEY,
  },
  messagingPublicKeyBase58Check:
    "BC1YLTestUserFakeMessagingKey0000000000000000000000",
  accessGroupsOwned: [
    {
      AccessGroupOwnerPublicKeyBase58Check: MOCK_USER_KEY,
      AccessGroupPublicKeyBase58Check: MOCK_USER_KEY,
      AccessGroupKeyName: "default-key",
      AccessGroupMemberEntryResponse: null,
      ExtraData: {},
    },
  ],
};

function makeMessage(text: string, timestampNanos: number) {
  return {
    ChatType: "DM",
    SenderInfo: {
      OwnerPublicKeyBase58Check: OTHER_USER_KEY,
      AccessGroupPublicKeyBase58Check: OTHER_USER_KEY,
      AccessGroupKeyName: "default-key",
    },
    RecipientInfo: {
      OwnerPublicKeyBase58Check: MOCK_USER_KEY,
      AccessGroupPublicKeyBase58Check: MOCK_USER_KEY,
      AccessGroupKeyName: "default-key",
    },
    MessageInfo: {
      EncryptedText: "",
      TimestampNanos: timestampNanos,
      TimestampNanosString: String(timestampNanos),
      ExtraData: {},
    },
    DecryptedMessage: text,
    IsSender: false,
    error: "",
  };
}

function makeDm(text: string) {
  return {
    key: OTHER_USER_KEY,
    conversation: {
      firstMessagePublicKey: OTHER_USER_KEY,
      ChatType: "DM",
      messages: [makeMessage(text, Date.now() * 1e6)],
    },
    usernames: { [OTHER_USER_KEY]: "alice" },
  };
}

async function injectUser(page: any) {
  await page.evaluate((user: any) => {
    localStorage.setItem(`chaton:onboarded:${user.PublicKeyBase58Check}`, "1");
    const store = (window as any).__CHATON_STORE__;
    if (!store) throw new Error("Store not exposed — is this a dev build?");
    store.setState({
      appUser: user,
      isLoadingUser: false,
      allAccessGroups: user.accessGroupsOwned || [],
    });
  }, MOCK_USER);
  await expect(
    page.getByPlaceholder("Search conversations...")
  ).toBeVisible({ timeout: 10_000 });
}

async function injectDm(page: any, text: string) {
  const data = makeDm(text);
  await page.evaluate(
    ({ key, conversation }: any) => {
      const msg = (window as any).__CHATON_MSG__;
      if (!msg) throw new Error("__CHATON_MSG__ not exposed");
      msg.setConversations((prev: any) => ({ ...prev, [key]: conversation }));
      msg.setSelectedConversationPublicKey(key);
    },
    data
  );
}

test.describe("News article link preview", () => {
  test.setTimeout(60_000);

  test("renders title, description, image and domain for an article", async ({
    page,
    waitForAppReady,
  }) => {
    await page.route("**/og", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "A company blew $500M on a Claude AI deal",
          description:
            "Inside the half-billion-dollar bet on Anthropic's Claude and what it signals for the technology sector.",
          image: "https://s.yimg.com/uu/api/res/1.2/test-hero-image.jpg",
        }),
      });
    });

    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);
    await injectDm(page, ARTICLE_URL);

    const messages = page.locator("#scrollableArea");
    await expect(
      messages.getByText("A company blew $500M on a Claude AI deal")
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      messages.getByText(/Inside the half-billion-dollar bet/)
    ).toBeVisible();
    // The bare domain only appears on the preview card, never in the inline
    // (full-URL) message link.
    await expect(
      messages.getByText("finance.yahoo.com", { exact: true })
    ).toBeVisible();
    // Hero image uses the title as its alt text.
    await expect(
      messages.getByRole("img", {
        name: "A company blew $500M on a Claude AI deal",
      })
    ).toBeVisible();
  });

  test("shows no card when the worker drops a consent interstitial", async ({
    page,
    waitForAppReady,
  }) => {
    // The worker returns {} after filtering out a consent page like
    // "Your privacy choices" — the client must degrade to no card at all.
    await page.route("**/og", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);
    await injectDm(page, ARTICLE_URL);

    const messages = page.locator("#scrollableArea");
    // The message itself (with its inline link) still renders.
    await expect(messages.getByRole("link", { name: ARTICLE_URL })).toBeVisible({
      timeout: 10_000,
    });
    // No preview card: the bare-domain card label must be absent, and the junk
    // consent title must never appear.
    await expect(
      messages.getByText("finance.yahoo.com", { exact: true })
    ).toHaveCount(0);
    await expect(messages.getByText("Your privacy choices")).toHaveCount(0);
  });
});
