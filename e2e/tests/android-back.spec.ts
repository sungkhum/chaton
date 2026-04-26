import { test, expect } from "../fixtures";

/**
 * Verify that the browser/system back button (Android PWA's hardware Back) closes
 * the open conversation and returns to the list, instead of falling through to
 * the OS and closing the app. Implemented via useAndroidBack — pushes a
 * synthetic history entry while a conversation is open and listens for popstate.
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

function makeMessage(text: string, isSender: boolean, timestampNanos: number) {
  const senderKey = isSender ? MOCK_USER_KEY : OTHER_USER_KEY;
  return {
    ChatType: "DM",
    SenderInfo: {
      OwnerPublicKeyBase58Check: senderKey,
      AccessGroupPublicKeyBase58Check: senderKey,
      AccessGroupKeyName: "default-key",
    },
    RecipientInfo: {
      OwnerPublicKeyBase58Check: OTHER_USER_KEY,
      AccessGroupPublicKeyBase58Check: OTHER_USER_KEY,
      AccessGroupKeyName: "default-key",
    },
    MessageInfo: {
      EncryptedText: "",
      TimestampNanos: timestampNanos,
      TimestampNanosString: String(timestampNanos),
      ExtraData: {},
    },
    DecryptedMessage: text,
    IsSender: isSender,
    error: "",
  };
}

const NOW = Date.now() * 1e6;

async function setupConversation(page: any) {
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

  await page.evaluate(
    ({ key, message }: any) => {
      const msg = (window as any).__CHATON_MSG__;
      if (!msg)
        throw new Error("__CHATON_MSG__ not exposed — is this a dev build?");
      msg.setConversations((prev: any) => ({
        ...prev,
        [key]: {
          firstMessagePublicKey: key,
          ChatType: "DM",
          messages: [message],
        },
      }));
      msg.setSelectedConversationPublicKey(key);
    },
    {
      key: OTHER_USER_KEY,
      message: makeMessage("Hello from a friend", false, NOW),
    }
  );

  // Wait for the conversation detail to render
  const messages = page.locator("#scrollableArea");
  await expect(messages.getByText("Hello from a friend")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("System back button (Android PWA)", () => {
  test.setTimeout(60_000);

  test("system back closes open conversation instead of leaving the app", async ({
    page,
    waitForAppReady,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "Mobile-only: back button only intercepts on mobile viewport"
    );

    await page.goto("/");
    await waitForAppReady();
    await setupConversation(page);

    // While a conversation is open on mobile, the conversation list (and its
    // search input) should be hidden.
    await expect(
      page.getByPlaceholder("Search conversations...")
    ).not.toBeVisible();

    // Simulate the Android system back button by firing popstate via history.back().
    await page.evaluate(() => window.history.back());

    // Conversation list should be visible again — this is the regression:
    // previously the PWA would close, now we stay in-app.
    await expect(
      page.getByPlaceholder("Search conversations...")
    ).toBeVisible({ timeout: 5_000 });

    // Conversation detail is gone
    await expect(page.locator("#scrollableArea")).not.toBeVisible();
  });

  test("opening a conversation pushes exactly one synthetic history entry", async ({
    page,
    waitForAppReady,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile",
      "Mobile-only: hook only activates on mobile viewport"
    );

    await page.goto("/");
    await waitForAppReady();

    // Inject the user but don't open a conversation yet
    await page.evaluate((user: any) => {
      localStorage.setItem(
        `chaton:onboarded:${user.PublicKeyBase58Check}`,
        "1"
      );
      const store = (window as any).__CHATON_STORE__;
      if (!store)
        throw new Error("Store not exposed — is this a dev build?");
      store.setState({
        appUser: user,
        isLoadingUser: false,
        allAccessGroups: user.accessGroupsOwned || [],
      });
    }, MOCK_USER);

    await expect(
      page.getByPlaceholder("Search conversations...")
    ).toBeVisible({ timeout: 10_000 });

    const lengthBefore = await page.evaluate(() => window.history.length);

    // Open a conversation — this should push exactly one synthetic entry
    await page.evaluate(
      ({ key, message }: any) => {
        const msg = (window as any).__CHATON_MSG__;
        msg.setConversations((prev: any) => ({
          ...prev,
          [key]: {
            firstMessagePublicKey: key,
            ChatType: "DM",
            messages: [message],
          },
        }));
        msg.setSelectedConversationPublicKey(key);
      },
      {
        key: OTHER_USER_KEY,
        message: makeMessage("Hello from a friend", false, NOW),
      }
    );

    await expect(
      page.locator("#scrollableArea").getByText("Hello from a friend")
    ).toBeVisible({ timeout: 10_000 });

    // Give the effect a tick to push the entry
    await page.waitForTimeout(100);

    const lengthAfter = await page.evaluate(() => window.history.length);
    expect(lengthAfter).toBe(lengthBefore + 1);

    // Switching conversations should NOT push another entry — guards against
    // history piling up when the user taps multiple chats in a row.
    await page.evaluate(
      ({ key, message }: any) => {
        const msg = (window as any).__CHATON_MSG__;
        msg.setConversations((prev: any) => ({
          ...prev,
          [key]: {
            firstMessagePublicKey: key,
            ChatType: "DM",
            messages: [message],
          },
        }));
        msg.setSelectedConversationPublicKey(key);
      },
      {
        key: "BC1YLAnotherKey0000000000000000000000000000000000000",
        message: makeMessage("Different chat", false, NOW),
      }
    );

    await page.waitForTimeout(100);
    const lengthFinal = await page.evaluate(() => window.history.length);
    expect(lengthFinal).toBe(lengthBefore + 1);
  });
});
