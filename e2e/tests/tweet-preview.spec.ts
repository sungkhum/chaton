import { test, expect } from "../fixtures";

/**
 * Verify that an X (Twitter) status URL renders a rich tweet preview card and
 * that a long, multi-paragraph tweet's text stays clamped to a bounded height
 * — it must never spill over and overlap the media image below it.
 *
 * The reported bug: the tweet text div combined `line-clamp-4` with
 * `whitespace-pre-line`. The worker returns the raw tweet text including its
 * embedded "\n" newlines, and on WebKit those explicit breaks corrupt
 * -webkit-line-clamp's line-box counting, leaving a sliced partial line that
 * butts up against (and visually overlaps) the image. The fix collapses the
 * newlines and caps the container height, so the text is always cleanly
 * clamped above the image.
 *
 * Mocks the worker OG endpoint so tests don't depend on network access.
 */

const MOCK_USER_KEY = "BC1YLTestUserFakePublicKey000000000000000000000000000";
const OTHER_USER_KEY = "BC1YLOtherUserFakePublicKey00000000000000000000000000";

const TWEET_URL =
  "https://x.com/sakanaailabs/status/2068861630327443966?s=46&t=cytcyeeGSA";

// A real (1x1) PNG so the media <img> actually loads with non-zero dimensions.
// TweetPreview's image has no fixed height, so an unloaded URL would collapse
// to 0px (and trip its onError handler), hiding it from the layout assertions.
const MEDIA_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Real tweets carry hard "\n" breaks between paragraphs — the exact input that
// broke -webkit-line-clamp's line accounting.
const TWEET_TEXT =
  "Introducing Sakana Fugu: A full multi-agent orchestration system accessible via a single model API.\n\n" +
  "Check out our blog post and try the playground today — we think this changes how teams build with AI agents at scale.\n\n" +
  "Read more and get started with the docs linked below.";

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

test.describe("Tweet link preview", () => {
  test.setTimeout(60_000);

  test("clamps a long tweet's text so it never overlaps the media image", async ({
    page,
    waitForAppReady,
  }) => {
    await page.route("**/og", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "tweet",
          title: "Sakana AI",
          description: TWEET_TEXT,
          image: MEDIA_IMAGE,
          author: "Sakana AI",
          authorHandle: "SakanaAILabs",
          metrics: { replies: 891, retweets: 4700, likes: 29100 },
        }),
      });
    });

    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);
    await injectDm(page, TWEET_URL);

    const messages = page.locator("#scrollableArea");

    // The card renders: author, the start of the tweet text, and the media image.
    await expect(messages.getByText("Sakana AI").first()).toBeVisible({
      timeout: 10_000,
    });
    const description = messages.getByText(/Introducing Sakana Fugu/);
    await expect(description).toBeVisible();
    const media = messages.getByRole("img", { name: "Sakana AI" });
    await expect(media).toBeVisible();

    const descBox = await description.boundingBox();
    const mediaBox = await media.boundingBox();
    expect(descBox).not.toBeNull();
    expect(mediaBox).not.toBeNull();

    // The clamped text container must stay bounded (~4 lines of 13px text).
    // Without the clamp/cap a 5-paragraph tweet would render far taller.
    expect(descBox!.height).toBeLessThan(100);

    // And its bottom edge must sit above the image — no overlap. (1px tolerance
    // for sub-pixel rounding.)
    expect(descBox!.y + descBox!.height).toBeLessThanOrEqual(mediaBox!.y + 1);

    // Regression lock for the repeat report (#74's first attempt under-corrected).
    // The sliced partial-line is WebKit-only: -webkit-line-clamp miscounts there
    // and leaves a 5th line above the image, so the max-height backstop must land
    // on the 4-line boundary — 4 × 17.875px (13px × leading-snug 1.375) + 6px
    // bottom padding ≈ 78px. The prior 88px allowed ~4.9 lines, leaving room for
    // the slice. Chromium clamps correctly, so the slice can't be reproduced in
    // this suite — assert the cap value directly instead.
    const maxHeight = await description.evaluate(
      (el) => getComputedStyle(el).maxHeight
    );
    expect(maxHeight).toBe("78px");
  });

  test("renders a short single-line tweet with no image cleanly", async ({
    page,
    waitForAppReady,
  }) => {
    await page.route("**/og", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          type: "tweet",
          title: "Sakana AI",
          description: "gm",
          author: "Sakana AI",
          authorHandle: "SakanaAILabs",
          metrics: { replies: 1, retweets: 2, likes: 3 },
        }),
      });
    });

    await page.goto("/");
    await waitForAppReady();
    await injectUser(page);
    await injectDm(page, TWEET_URL);

    const messages = page.locator("#scrollableArea");
    await expect(messages.getByText("Sakana AI").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(messages.getByText("gm", { exact: true })).toBeVisible();
  });
});
