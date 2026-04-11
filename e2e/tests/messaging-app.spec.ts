import { test, expect } from "../fixtures";

/**
 * Mock data factories for testing the authenticated messaging UI.
 *
 * Uses two dev-only hooks:
 * - __CHATON_STORE__: Zustand store (user, access groups)
 * - __CHATON_MSG__: Component-level setters (conversations, selected key, members)
 */

const MOCK_USER_KEY = "BC1YLTestUserFakePublicKey000000000000000000000000000";
const OTHER_USER_KEY = "BC1YLOtherUserFakePublicKey00000000000000000000000000";
const GROUP_OWNER_KEY = MOCK_USER_KEY; // current user owns the group
const GROUP_KEY_NAME = "test-group-chat";
const GROUP_ACCESS_KEY = "BC1YLGroupAccessPublicKey0000000000000000000000000000";

const MOCK_USER = {
  PublicKeyBase58Check: MOCK_USER_KEY,
  ProfileEntryResponse: {
    Username: "test_user",
    PublicKeyBase58Check: MOCK_USER_KEY,
  },
  messagingPublicKeyBase58Check:
    "BC1YLTestUserFakeMessagingKey0000000000000000000000",
  // Must include default-key so hasSetupMessaging() returns true
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

// --- Message factories ---

function makeMessage(
  text: string,
  isSender: boolean,
  timestampNanos: number,
  opts: {
    senderKey?: string;
    recipientOwnerKey?: string;
    recipientKeyName?: string;
    chatType?: string;
    extraData?: Record<string, string>;
  } = {}
) {
  const chatType = opts.chatType || "DM";
  const senderKey = opts.senderKey || (isSender ? MOCK_USER_KEY : OTHER_USER_KEY);
  return {
    ChatType: chatType,
    SenderInfo: {
      OwnerPublicKeyBase58Check: senderKey,
      AccessGroupPublicKeyBase58Check: senderKey,
      AccessGroupKeyName: "default-key",
    },
    RecipientInfo: {
      OwnerPublicKeyBase58Check: opts.recipientOwnerKey || OTHER_USER_KEY,
      AccessGroupPublicKeyBase58Check: opts.recipientOwnerKey || OTHER_USER_KEY,
      AccessGroupKeyName: opts.recipientKeyName || "default-key",
    },
    MessageInfo: {
      EncryptedText: "",
      TimestampNanos: timestampNanos,
      TimestampNanosString: String(timestampNanos),
      ExtraData: opts.extraData || {},
    },
    DecryptedMessage: text,
    IsSender: isSender,
    error: "",
  };
}

const NOW = Date.now() * 1e6; // current time in nanos

function makeDmConversation() {
  return {
    key: OTHER_USER_KEY,
    conversation: {
      firstMessagePublicKey: OTHER_USER_KEY,
      ChatType: "DM",
      messages: [
        makeMessage("Hey, how are you?", false, NOW - 2e12),
        makeMessage("I'm good, thanks!", true, NOW - 1e12),
        makeMessage("What are you working on?", false, NOW),
      ],
    },
    usernames: { [OTHER_USER_KEY]: "alice" },
  };
}

function makeGroupConversation() {
  const thirdUser = "BC1YLThirdUserFakePublicKey000000000000000000000000000";
  return {
    key: GROUP_OWNER_KEY + GROUP_KEY_NAME,
    conversation: {
      firstMessagePublicKey: GROUP_OWNER_KEY,
      ChatType: "GroupChat",
      messages: [
        makeMessage("Welcome to the group!", true, NOW - 3e12, {
          recipientOwnerKey: GROUP_OWNER_KEY,
          recipientKeyName: GROUP_KEY_NAME,
          chatType: "GroupChat",
        }),
        makeMessage("Thanks for adding me!", false, NOW - 2e12, {
          senderKey: OTHER_USER_KEY,
          recipientOwnerKey: GROUP_OWNER_KEY,
          recipientKeyName: GROUP_KEY_NAME,
          chatType: "GroupChat",
        }),
        makeMessage("Happy to be here", false, NOW - 1e12, {
          senderKey: thirdUser,
          recipientOwnerKey: GROUP_OWNER_KEY,
          recipientKeyName: GROUP_KEY_NAME,
          chatType: "GroupChat",
        }),
        makeMessage("Check out this pinned info", true, NOW, {
          recipientOwnerKey: GROUP_OWNER_KEY,
          recipientKeyName: GROUP_KEY_NAME,
          chatType: "GroupChat",
        }),
      ],
    },
    usernames: {
      [GROUP_OWNER_KEY]: "test_user",
      [OTHER_USER_KEY]: "alice",
      [thirdUser]: "bob",
    },
    members: {
      [GROUP_OWNER_KEY]: { Username: "test_user" },
      [OTHER_USER_KEY]: { Username: "alice" },
      [thirdUser]: { Username: "bob" },
    },
    accessGroup: {
      AccessGroupOwnerPublicKeyBase58Check: GROUP_OWNER_KEY,
      AccessGroupPublicKeyBase58Check: GROUP_ACCESS_KEY,
      AccessGroupKeyName: GROUP_KEY_NAME,
      AccessGroupMemberEntryResponse: null,
      ExtraData: {
        "group:displayName": "Test Group",
      },
    },
  };
}

// --- Inject helpers ---

async function injectUser(page: any) {
  await page.evaluate((user: any) => {
    // Mark onboarding complete so the wizard doesn't show
    localStorage.setItem(`chaton:onboarded:${user.PublicKeyBase58Check}`, "1");
    const store = (window as any).__CHATON_STORE__;
    if (!store) throw new Error("Store not exposed — is this a dev build?");
    store.setState({
      appUser: user,
      isLoadingUser: false,
      allAccessGroups: user.accessGroupsOwned || [],
    });
  }, MOCK_USER);
  // Wait for the messaging shell to render — look for the conversation list
  // search input which only exists in the authenticated messaging UI
  await expect(
    page.getByPlaceholder("Search conversations...")
  ).toBeVisible({ timeout: 10_000 });
}

async function injectConversation(
  page: any,
  data: {
    key: string;
    conversation: any;
    usernames: Record<string, string>;
    members?: any;
    accessGroup?: any;
  }
) {
  await page.evaluate(
    ({ key, conversation, usernames, members, accessGroup }: any) => {
      const msg = (window as any).__CHATON_MSG__;
      if (!msg) throw new Error("__CHATON_MSG__ not exposed — is this a dev build?");

      // Inject conversation
      msg.setConversations((prev: any) => ({ ...prev, [key]: conversation }));
      msg.setSelectedConversationPublicKey(key);

      // Inject members if group chat
      if (members) {
        msg.setMembersByGroupKey((prev: any) => ({ ...prev, [key]: members }));
      }

      // Inject access group and username map into Zustand store
      const store = (window as any).__CHATON_STORE__;
      if (accessGroup) {
        const current = store.getState().allAccessGroups;
        store.setState({ allAccessGroups: [accessGroup, ...current] });
      }

      // Update username map (used by usernameByPublicKeyBase58Check)
      // The store doesn't have a direct setter for this — it's derived from
      // conversations. We'll rely on the component deriving it from the
      // conversation data.
    },
    data
  );
}

// =============================================================================
// Tests
// =============================================================================

test.describe("Messaging app (authenticated)", () => {
  test.setTimeout(60_000);

  test("shows messaging shell with empty state", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    // Should show the messaging UI, not the landing page
    await expect(
      page.getByRole("heading", { name: /messaging that no one can shut down/i })
    ).not.toBeVisible();
  });

  test("renders DM conversation with messages", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    const dm = makeDmConversation();
    await injectConversation(page, dm);

    // Messages should be visible in the message area (not the sidebar preview)
    const messages = page.locator("#scrollableArea");
    await expect(messages.getByText("Hey, how are you?")).toBeVisible({
      timeout: 5_000,
    });
    await expect(messages.getByText("I'm good, thanks!")).toBeVisible();
    await expect(messages.getByText("What are you working on?")).toBeVisible();
  });

  test("renders group chat with member count", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    const group = makeGroupConversation();
    await injectConversation(page, group);

    // Group messages should be visible in the message area
    const messages = page.locator("#scrollableArea");
    await expect(messages.getByText("Welcome to the group!")).toBeVisible({
      timeout: 10_000,
    });
    await expect(messages.getByText("Thanks for adding me!")).toBeVisible();

    // Member count renders in both mobile and desktop header variants.
    // Check that at least one instance is attached (visible depends on viewport).
    await expect(page.getByText("3 members").first()).toBeAttached();
  });
});

test.describe("Pinned message", () => {
  test.setTimeout(60_000);

  test("pinned message bar appears when group has a pinned message", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    const group = makeGroupConversation();
    // Pin the last message
    const pinnedTs = String(NOW);
    group.accessGroup.ExtraData["group:pinnedMessage"] = pinnedTs;
    await injectConversation(page, group);

    // Pinned message bar should be visible with the "Pinned Message" label
    const pinBar = page.getByText("Pinned Message");
    await expect(pinBar).toBeVisible({ timeout: 5_000 });

    // The pin bar preview text should show the pinned message content
    // (scoped to the pin bar's parent to avoid matching the message bubble)
    await expect(
      pinBar.locator("..").getByText("Check out this pinned info")
    ).toBeVisible();
  });

  test("pinned message bar does NOT appear without a pin", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    const group = makeGroupConversation();
    // No pin set
    await injectConversation(page, group);

    // Messages render but no pin bar
    const messages = page.locator("#scrollableArea");
    await expect(messages.getByText("Welcome to the group!")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText("Pinned Message")).not.toBeVisible();
  });

  test("group owner sees unpin X button on pinned bar", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    const group = makeGroupConversation();
    group.accessGroup.ExtraData["group:pinnedMessage"] = String(NOW);
    await injectConversation(page, group);

    await expect(page.getByText("Pinned Message")).toBeVisible({
      timeout: 5_000,
    });

    // The unpin button should exist (visible on mobile, hover-reveal on desktop)
    await expect(
      page.getByRole("button", { name: /unpin message/i })
    ).toBeAttached();
  });

  test("context menu shows Pin Message for group owner", async ({
    page,
    waitForAppReady,
  }, testInfo) => {
    // Context menu is triggered differently on mobile (long-press) vs desktop (right-click)
    test.skip(
      testInfo.project.name === "mobile",
      "Desktop-only: mobile uses long-press which is harder to simulate"
    );
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    const group = makeGroupConversation();
    await injectConversation(page, group);

    // Wait for messages to render
    const messages = page.locator("#scrollableArea");
    await expect(messages.getByText("Welcome to the group!")).toBeVisible({
      timeout: 5_000,
    });

    // Right-click on a message to trigger context menu
    await messages.getByText("Welcome to the group!").click({ button: "right" });

    // Pin Message option should appear in the context menu
    await expect(page.getByText("Pin Message")).toBeVisible({ timeout: 3_000 });
  });
});

test.describe("Long message expand/collapse", () => {
  test.setTimeout(60_000);

  test("long messages show 'Show more' button and can expand", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    // Generate a message long enough to exceed 300px collapsed height
    const longText = Array.from({ length: 40 }, (_, i) =>
      `Line ${i + 1}: This is a really long message that should cause the expand button to appear.`
    ).join("\n");
    const dm = makeDmConversation();
    dm.conversation.messages.push(
      makeMessage(longText, false, NOW + 1e12)
    );
    await injectConversation(page, dm);

    const messages = page.locator("#scrollableArea");
    // Wait for short messages to render first
    await expect(messages.getByText("Hey, how are you?")).toBeVisible({
      timeout: 10_000,
    });

    // The "Show more" button should appear for the long message
    const showMore = messages.getByRole("button", { name: "Show more" });
    await expect(showMore).toBeVisible({ timeout: 10_000 });

    // Click to expand
    await showMore.click();

    // After expanding, button text changes to "Show less"
    await expect(
      messages.getByRole("button", { name: "Show less" })
    ).toBeVisible();

    // "Show more" should no longer be present
    await expect(showMore).not.toBeVisible();
  });

  test("short messages do not show expand button", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    const dm = makeDmConversation();
    await injectConversation(page, dm);

    const messages = page.locator("#scrollableArea");
    await expect(messages.getByText("Hey, how are you?")).toBeVisible({
      timeout: 5_000,
    });

    // No expand button for short messages
    await expect(
      messages.getByRole("button", { name: "Show more" })
    ).not.toBeVisible();
  });
});
