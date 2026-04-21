import { test, expect } from "../fixtures";

/**
 * Verify that YouTube URLs in chat messages render a rich preview card
 * (thumbnail, title, channel name, play-button overlay) and that bare
 * youtube.com URLs without a protocol still trigger the preview.
 *
 * Mocks the worker OG endpoint so tests don't depend on network access.
 */

const MOCK_USER_KEY = "BC1YLTestUserFakePublicKey000000000000000000000000000";
const OTHER_USER_KEY = "BC1YLOtherUserFakePublicKey00000000000000000000000000";

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
    ({ key, conversation, usernames }: any) => {
      const msg = (window as any).__CHATON_MSG__;
      if (!msg) throw new Error("__CHATON_MSG__ not exposed");
      msg.setConversations((prev: any) => ({ ...prev, [key]: conversation }));
      msg.setSelectedConversationPublicKey(key);
      void usernames;
    },
    data
  );
}

test.describe("YouTube link preview", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    // Mock the worker OG endpoint with a YouTube-shaped response
    await page.route("**/og", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "youtube",
          title: "Test YouTube Video Title",
          author: "Test Channel Name",
          image: "https://i.ytimg.com/vi/SLzzsAB3OgU/hqdefault.jpg",
          videoId: "SLzzsAB3OgU",
        }),
      });
    });
  });

  test("renders preview card for full https youtube.com/live URL", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);
    await injectDm(
      page,
      "https://youtube.com/live/SLzzsAB3OgU?si=RaaM84d8pdm_zcd2"
    );

    const messages = page.locator("#scrollableArea");
    await expect(messages.getByText("Test YouTube Video Title")).toBeVisible({
      timeout: 10_000,
    });
    await expect(messages.getByText("Test Channel Name")).toBeVisible();
    // YouTube branding label at the bottom of the card
    await expect(messages.getByText("YouTube").first()).toBeVisible();
  });

  test("renders preview for bare youtube.com URL without protocol", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);
    // Note: no "https://" prefix — this is the regression case from the ticket
    await injectDm(
      page,
      "youtube.com/live/SLzzsAB3OgU?si=RaaM84d8pdm_zcd2"
    );

    const messages = page.locator("#scrollableArea");
    await expect(messages.getByText("Test YouTube Video Title")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("renders preview for bare youtu.be short URL", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);
    await injectDm(page, "youtu.be/SLzzsAB3OgU");

    const messages = page.locator("#scrollableArea");
    await expect(messages.getByText("Test YouTube Video Title")).toBeVisible({
      timeout: 10_000,
    });
  });
});
