import { test, expect } from "../fixtures";

/**
 * Returning to the ChatOn tab (e.g. after opening a link in a new tab) fires a
 * visibilitychange refresh that re-fetches the conversation thread. That refresh
 * used to overwrite the visible messages with just the latest tail, discarding
 * the older messages the user had paged in and snapping the view to the present
 * — losing their reading spot.
 *
 * The fix: when the user is scrolled away from the live tail, the merge skips
 * overwriting the visible thread (it only refreshes caches), preserving the
 * scroll position. When at the bottom, the merge applies as before.
 *
 * These tests drive the real merge handler via the dev-only __CHATON_MSG__ hook,
 * exactly the code path the visibility-resume refresh runs through.
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

const NOW = Date.now() * 1e6; // current time in nanos

/** A DM with enough messages to scroll. Ordered newest-first (index 0 = newest),
 *  matching how the app loads threads. */
function makeLongDm(count: number) {
  const messages = [];
  for (let n = count; n >= 1; n--) {
    messages.push(makeMessage(`Message ${n}`, n % 2 === 0, NOW - (count - n) * 1e9));
  }
  return {
    key: OTHER_USER_KEY,
    conversation: {
      firstMessagePublicKey: OTHER_USER_KEY,
      ChatType: "DM",
      messages,
    },
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

async function injectConversation(page: any, data: any) {
  await page.evaluate(({ key, conversation }: any) => {
    const msg = (window as any).__CHATON_MSG__;
    if (!msg)
      throw new Error("__CHATON_MSG__ not exposed — is this a dev build?");
    msg.setConversations((prev: any) => ({ ...prev, [key]: conversation }));
    msg.setSelectedConversationPublicKey(key);
  }, data);
  // Selecting a conversation navigates to its own URL (/chat/<key>). Wait for
  // that to settle so a later page.evaluate isn't torn down mid-navigation.
  await expect(page).toHaveURL(/\/chat\//, { timeout: 10_000 });
}

/** Simulate the visibility-resume refresh: a merge that carries only the latest
 *  tail of the thread (what getConversation returns). */
async function mergeLatestTail(page: any, data: any, tailSize: number) {
  await page.evaluate(
    ({ key, conversation, tailSize }: any) => {
      const msg = (window as any).__CHATON_MSG__;
      if (!msg?.mergeConversationUpdate)
        throw new Error("mergeConversationUpdate not exposed");
      const tail = conversation.messages.slice(0, tailSize);
      msg.mergeConversationUpdate(
        { [key]: { ...conversation, messages: tail } },
        key,
        tail
      );
    },
    { ...data, tailSize }
  );
}

test.describe("Scroll position on tab return", () => {
  test.setTimeout(60_000);

  test("keeps the reading spot when a refresh arrives while scrolled up", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    const dm = makeLongDm(60);
    await injectConversation(page, dm);

    const area = page.locator("#scrollableArea");
    // Newest message sits at the live tail; the oldest is rendered far above it.
    await expect(area.getByText("Message 60", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(area.getByText("Message 1", { exact: true })).toBeAttached();

    // Scroll up into the history (flex-col-reverse: scrollTop goes negative).
    await area.evaluate((el) => {
      el.scrollTop = (el.scrollHeight - el.clientHeight) * -0.4;
    });
    const scrolledTop = await area.evaluate((el) => el.scrollTop);
    expect(scrolledTop).toBeLessThan(-300);

    // A background refresh carrying only the latest 3 messages arrives.
    await mergeLatestTail(page, dm, 3);

    // The older messages must NOT be discarded and the view must NOT snap to the
    // present — the full thread is still rendered and the scroll spot is kept.
    await expect(area.getByText("Message 1", { exact: true })).toBeAttached();
    const afterTop = await area.evaluate((el) => el.scrollTop);
    expect(afterTop).toBeLessThan(-300);
  });

  test("still applies the refresh when sitting at the latest messages", async ({
    page,
    waitForAppReady,
  }) => {
    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);

    const dm = makeLongDm(60);
    await injectConversation(page, dm);

    const area = page.locator("#scrollableArea");
    await expect(area.getByText("Message 60", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(area.getByText("Message 1", { exact: true })).toBeAttached();

    // At the live tail (scrollTop ~0), not scrolled away.
    expect(await area.evaluate((el) => el.scrollTop)).toBeGreaterThan(-300);

    // The refresh applies normally, replacing the thread with the latest tail.
    await mergeLatestTail(page, dm, 3);

    await expect(
      area.getByText("Message 1", { exact: true })
    ).not.toBeAttached();
    await expect(area.getByText("Message 60", { exact: true })).toBeVisible();
  });
});
