# Chaton

## Architecture

DeSo-first. No custom backend or database. The DeSo blockchain is the data layer.
Cloudflare Worker (Durable Object) provides WebSocket relay for real-time notifications only — no state storage.
Target: $0/month infrastructure cost.

## Optimistic UI

Every user action that writes to the blockchain MUST feel instant. DeSo transactions
take 1-3 seconds to confirm, which is unacceptable for a chat app. We solve this with
optimistic updates everywhere.

### Pattern

1. **Immediately update local state** with the expected result before the blockchain call.
2. **Mark optimistic entries** with `_localId` (unique string) and `_status: "sending"`.
3. **Fire the blockchain transaction** in the background.
4. **On success**: update `_status` to `"sent"`. The next poll refresh will replace the
   optimistic entry with the real blockchain-confirmed one (`_status` absent = confirmed).
5. **On failure**: update `_status` to `"failed"`. Show a toast. Keep the entry visible
   so the user can retry.
6. **On refresh merge**: reconcile optimistic entries with blockchain data. Remove
   optimistic messages that now have a confirmed counterpart (matched by approximate
   timestamp + sender).

### Where optimistic updates are required

- **Sending messages**: Insert mock message immediately (already implemented).
- **Reactions**: Insert optimistic reaction into the aggregation map immediately.
  Don't wait for the blockchain to show the emoji pill.
- **Media uploads**: Show a placeholder/progress state in the message bubble while
  uploading, then swap in the real URL.

### Anti-patterns to avoid

- Never block the UI waiting for `encryptAndSendNewMessage` to return.
- Never force a full conversation refetch as the only way to see your own action.
- Never let `lockRefresh` stay true if the send promise rejects — always release in `finally`.

## Chat Requests

DM conversations from strangers go to a "Requests" tab. Classification uses DeSo's
on-chain follows and User Associations (no backend needed).

### Classification order (first match wins)

1. Group chats + `chat:group-archived` → Archived
2. Group chats → Chats
3. `chaton:chat-blocked` association exists → hidden (blocked)
4. `chaton:chat-dismissed` association exists → hidden (dismissed)
5. `chaton:chat-archived` association exists → Archived
6. Mutual DeSo follow → Chats
7. `chaton:chat-approved` association exists → Chats
8. User initiated the conversation (via search) → Chats
9. Current user sent the first message → Chats
10. Everything else → Requests

### Data flow

- On first load, `fetchMutualFollows` and `fetchChatAssociations` run in `Promise.all`
  alongside `getConversations`. Results cached in Zustand store for the session.
- `classifyConversation()` is a pure function. A `useMemo` in messaging-app.tsx derives
  `chatConversations` and `requestConversations` from the single `conversations` state
  plus the store Sets. This means all existing optimistic update code works unchanged.
- Accept/Block create on-chain associations (`createUserAssociation`) with optimistic
  Set updates and rollback on failure.

### Association types

- `chaton:chat-approved` / value `"approved"` — user accepted a chat request
- `chaton:chat-blocked` / value `"blocked"` — user blocked a sender
- `chaton:chat-archived` / value `"archived"` — user archived a DM conversation
  (Target = other user's public key. Stays archived on new messages — WhatsApp model.)
- `chaton:chat-dismissed` / value `"dismissed"` — user dismissed a chat request without
  blocking (Target = sender's public key. Stays dismissed permanently.)
- `chat:group-archived` / value `<AccessGroupKeyName>` — user left/archived a group chat
  (generic `chat:` prefix — any DeSo messaging app can query this to check if a user
  has left a group. Target = group owner's public key, Value = group key name.)
- `chaton:group-join-request` / value `<AccessGroupKeyName>` — user requests to join a
  group via invite link. Transactor = requesting user, Target = group owner. Stays
  on-chain as a receipt after approval; admin panel filters by current membership.
- `chaton:group-join-rejected` / value `<AccessGroupKeyName>` — owner rejects a join
  request. Transactor = group owner, Target = requester's public key. Used to filter
  rejected requests from the pending list on subsequent loads.
- `chaton:group-invite-code` / value `<short_code>` — maps an 8-char alphanumeric invite
  code to a group chat. Transactor = group owner, Target = `CHATON_DONATION_PUBLIC_KEY`
  (well-known registry key). `ExtraData["group:keyName"]` stores the AccessGroupKeyName.
  Resolve via `getUserAssociations` by target + type + value. Owner can delete to revoke.
- `chaton:community-listed` / value `<AccessGroupKeyName>` — opts a group into the
  public community directory. Transactor = group owner, Target = `CHATON_DONATION_PUBLIC_KEY`.
  `ExtraData["group:keyName"]` stores the AccessGroupKeyName,
  `ExtraData["community:description"]` stores an optional short description.
  Independent of invite codes — listing persists across invite link rotations.
  A group appears in the community directory only if BOTH a community-listed association
  AND an active invite code exist.

## ExtraData conventions

All rich message metadata uses generic `msg:` namespaced keys in DeSo's `ExtraData`
field. This is a shared convention any DeSo messaging app can adopt:

- `msg:type` — message type: `text`, `image`, `gif`, `sticker`, `video`, `file`, `reaction`, `system`
- `msg:replyTo` — `TimestampNanosString` of the message being replied to or reacted to
- `msg:emoji` — emoji character for reactions
- `msg:action` — `"add"` or `"remove"` for reaction toggling
- `msg:imageUrl`, `msg:gifUrl`, `msg:videoUrl` — media URLs
- `msg:duration`, `msg:mediaWidth`, `msg:mediaHeight` — media dimensions
- `msg:fileName`, `msg:fileSize`, `msg:fileType` — file attachments
- `msg:replyPreview` — truncated preview text of the replied-to message
- `msg:gifTitle` — title of a GIF or sticker from KLIPY
- `msg:systemAction` — system log action: `member-joined`, `member-left`
- `msg:systemMembers` — JSON array of `{pk, un}` entries for the users involved

### Access Group ExtraData

Group metadata uses `group:` namespaced keys in the access group's `ExtraData` field.
Stored via `createAccessGroup` / `updateAccessGroup`. Any DeSo messaging app can read these:

- `group:displayName` — human-readable display name for the group (owner can rename;
  `AccessGroupKeyName` remains the immutable on-chain identifier)
- `group:imageUrl` — URL of the group's profile image (uploaded via DeSo image upload)

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Zustand (global store for auth, access groups, chat request classification; conversations in component state)
- deso-protocol SDK for all blockchain interaction
- Sonner for toasts
- Cloudflare Workers + Durable Objects for WebSocket relay

## Testing

Playwright e2e tests live in `e2e/tests/`. Use the `/playwright-best-practices` skill
when writing or modifying tests.

### Workflow

- **New features must include Playwright tests** covering the added UI/behavior.
- **Before committing**, run tests covering the areas of code you touched:
  - Target specific spec files: `npx playwright test e2e/tests/landing-page.spec.ts`
  - Or grep by test name: `npx playwright test --grep "footer"`
  - Full suite when changes are broad: `npm run test:e2e`
- **PWA/offline changes** require a build first: `npm run test:e2e:ci`

### Critical: routing, loading, and splash screen changes

Any change to `App.tsx` routing logic (`contentReady`, `showLanding`, route guards),
splash screen removal, or the Zustand `isLoadingUser`/`appUser` state **must** pass
these tests before committing:

```
npx playwright test e2e/tests/logged-in-shell.spec.ts e2e/tests/landing-page.spec.ts
```

- `logged-in-shell.spec.ts` — injects a mock user via `__CHATON_STORE__` (exposed in
  dev mode) and verifies: (1) the messaging header renders, (2) the loading state
  (`isLoadingUser: true`) shows the spinner, not the landing page. The landing page
  starts all elements at GSAP `autoAlpha: 0`, so rendering it during loading = black
  screen.
- `landing-page.spec.ts` — verifies hero content is visible after splash removal for
  logged-out users.

For PWA builds, also run `npm run test:e2e:ci` which includes `pwa.spec.ts` with its
own visible-content smoke test.

### Running tests

```
npm run test:e2e          # desktop + mobile against dev server
npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:ci       # build + all projects including PWA/offline
npx playwright show-report # view last HTML report
```

### Writing tests

- Import `test` and `expect` from `../fixtures` (not `@playwright/test` directly)
  to get `waitForAppReady` and `consoleErrors` fixtures.
- Use role-based locators (`getByRole`, `getByText`, `getByLabel`) over CSS selectors.
- Use web-first assertions (`toBeVisible`, `toHaveText`) — they auto-retry.
- Landing page tests need `test.setTimeout(60_000)` due to DeSo SDK cold-start.
- Mark desktop-only tests with `test.skip(testInfo.project.name === "mobile", ...)`.
- PWA tests use `context.waitForEvent("serviceworker")` for SW detection.

## DeSo Identity and the blank-screen bug

We have had multiple regressions where the app renders a black/blank screen instead
of the landing page or the messaging UI. Every one traced back to mishandling the
DeSo identity boot sequence. Read this section before touching `App.tsx`, the Zustand
`isLoadingUser`/`appUser` state, or anything that gates what the user sees.

### How the boot flow works (App.tsx)

1. **`identity.snapshot()`** reads localStorage synchronously on mount. No iframe, no
   network, no callbacks. This is how we know if a user is logged in.
2. **Logged-in branch**: call `hydrateUser()` with the messaging key from the snapshot.
   - Cache hit → `setAppUser(cached)` + `setIsLoadingUser(false)` immediately, background
     refresh in a `.then()` chain.
   - Cache miss → keep `isLoadingUser=true`, block on `Promise.all([getUser, getGroups])`,
     then `.finally(() => setIsLoadingUser(false))`.
3. **Logged-out branch**: `setIsLoadingUser(false)` immediately → landing page renders.
4. **`identity.subscribe()`** is kept only for ongoing events (login, logout, account
   switch) — **never** for the initial boot.

### Key state and routing

| State                          | Meaning                                         |
|--------------------------------|-------------------------------------------------|
| `isLoadingUser=true, appUser=null`  | Still booting — show spinner, NOT landing page |
| `isLoadingUser=false, appUser=null` | Logged out — show landing page                 |
| `appUser !== null`                  | Logged in — show messaging UI                  |

`contentReady = !isLoadingUser || !!appUser` — controls when the splash screen is
removed. `showLanding = !appUser && !isLoadingUser` — controls when the landing page
renders. These two must stay in sync.

### Rules (each learned from a production regression)

1. **Never show the landing page while `isLoadingUser` is true.** The landing page
   uses GSAP `autoAlpha: 0` on all elements — rendering it before animations run = black
   screen. Gate on `!appUser && !isLoadingUser`, never on route alone.

2. **Use `identity.snapshot()` for boot, `identity.subscribe()` for events.** The old
   pattern of booting via subscribe required an iframe handshake that could hang for
   seconds or fail silently. Snapshot reads localStorage directly.

3. **Always use optional chaining on identity data.** `currentUser.primaryDerivedKey`
   can be null or corrupted. Destructuring without guards silently kills the boot
   callback, leaving `isLoadingUser=true` forever.

4. **Guard `handleRedirectURI()` calls.** Only call it when
   `window.location.search.includes("service=identity")`. Calling it on clean URLs
   with `URLSearchParams(undefined)` crashes WebKit (iOS Safari, PWA).

5. **Every `Promise.all` in the boot path needs try/catch.** If any API call fails,
   `isLoadingUser` must still be set to `false` — use `.finally()`. An unhandled
   rejection = permanent spinner.

6. **Reset `isLoadingUser` on cancelled auth popups.** `AUTHORIZE_DERIVED_KEY_START`
   sets `isLoadingUser=true`. If the user closes the popup, the END event never fires.
   Always reset in a `.finally()` block in `withAuth()`.

7. **Handle same-user re-authorization.** Permissions upgrades (e.g. requesting
   transfer permission for tipping) trigger `AUTHORIZE_DERIVED_KEY` for the same
   public key. The subscribe handler must detect this and clear `isLoadingUser` —
   don't only handle new-user logins.

8. **Fast-path logged-out users.** Check `localStorage.getItem("desoActivePublicKey")`
   synchronously. If absent, skip the identity SDK entirely and render the landing
   page immediately. This is already implemented — don't remove it.

### Before changing App.tsx routing

Run the required tests (also documented in the Testing section):

```
npx playwright test e2e/tests/logged-in-shell.spec.ts e2e/tests/landing-page.spec.ts
```

These catch the two most common regressions: (1) landing page shown during loading
(black screen for logged-in users) and (2) landing page not shown for logged-out users.

## Debugging push notifications (live data)

Push state lives in a Cloudflare D1 database (`chaton-push`) and the Durable Object's
in-memory SQLite. All wrangler commands must run from `worker/` and use `--remote`.

### Wrangler commands

```bash
# IMPORTANT: run from the worker directory, always use --remote for production data
cd worker

# List all users and their push subscriptions
npx wrangler d1 execute chaton-push --remote \
  --command "SELECT u.id, u.deso_public_key, u.push_enabled, ps.endpoint, ps.is_active, ps.failure_count FROM users u LEFT JOIN push_subscriptions ps ON ps.user_id = u.id"

# Check thread states for a specific user (find user_id from query above)
npx wrangler d1 execute chaton-push --remote \
  --command "SELECT * FROM thread_state WHERE user_id = <USER_ID> ORDER BY last_seen_timestamp DESC LIMIT 10"

# Tail live worker logs (Ctrl-C to stop)
npx wrangler tail chaton-relay --format json
```

### Look up DeSo public keys

Map usernames to public keys so you can match D1 records:

```bash
curl -s 'https://node.deso.org/api/v0/get-single-profile' \
  -H 'Content-Type: application/json' \
  -d '{"Username": "<USERNAME>"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['Profile']['PublicKeyBase58Check'])"
```

### Known user public keys

- nathanwells = `BC1YLh3xfZeXxLNnMaMwhvnTBWozbyoWbDzzyk5ydh6rikNdzPuYEY4`

### DeSo timestamps

DeSo uses nanoseconds since Unix epoch. Convert with:

```bash
python3 -c "from datetime import datetime,timezone; print(datetime.fromtimestamp(<NANOS>/1e9, tz=timezone.utc).isoformat())"
```

### Debugging checklist

1. **Is the user in D1 with `push_enabled=1`?** If not, they never subscribed.
2. **Is there an active subscription (`is_active=1`, `failure_count < 5`)?** If
   `is_active=0`, the subscription expired or was deactivated after failures.
3. **Does `thread_state` show a recent timestamp for the thread?** If yes, the cron
   detected the message and enqueued a push job.
4. **Was the app open on that conversation?** The service worker suppresses notifications
   when the app is visible+focused on the same conversation.
5. **Check device notification settings.** Safari/PWA notifications can be silently
   blocked at the OS level.

### Push notification architecture

Two delivery paths exist:

- **Real-time (Durable Object)**: sender's client calls `sendNotify` via WebSocket →
  DO sends push immediately from its in-memory subscription table.
- **Cron backup (D1 + Queue)**: every-minute cron polls DeSo threads → detects new
  messages → enqueues push jobs → queue consumer sends via D1 subscriptions.

The DO's in-memory `push_subscriptions` table is **volatile** — lost on DO eviction.
It's repopulated when users reconnect (via `refreshPushSubscription` on WS open).
D1 is the durable source of truth.

<!-- VITE-AGENTS-MD-START -->
[Vite Docs Index]|root: ./.vite-docs|version: ^6.3.5 (package.json:vite)|STOP. What you remember about Vite is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx github:sungkhum/vite-agent-index agents-md --output CLAUDE.md|sections:{root(5),blog(10),changes(5),config(7),guide(23)}|full_index: ./.vite-docs-index/full.index.txt
<!-- VITE-AGENTS-MD-END -->
