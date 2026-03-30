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

1. Group chats → always Chats
2. `chaton:chat-blocked` association exists → hidden
3. Mutual DeSo follow → Chats
4. `chaton:chat-approved` association exists → Chats
5. User initiated the conversation (via search) → Chats
6. Current user sent the first message → Chats
7. Everything else → Requests

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
- `chat:group-archived` / value `<AccessGroupKeyName>` — user left/archived a group chat
  (generic `chat:` prefix — any DeSo messaging app can query this to check if a user
  has left a group. Target = group owner's public key, Value = group key name.)

## ExtraData conventions

All rich message metadata uses generic `msg:` namespaced keys in DeSo's `ExtraData`
field. This is a shared convention any DeSo messaging app can adopt:

- `msg:type` — message type: `text`, `image`, `gif`, `video`, `file`, `reaction`
- `msg:replyTo` — `TimestampNanosString` of the message being replied to or reacted to
- `msg:emoji` — emoji character for reactions
- `msg:action` — `"add"` or `"remove"` for reaction toggling
- `msg:imageUrl`, `msg:gifUrl`, `msg:videoUrl` — media URLs
- `msg:duration`, `msg:mediaWidth`, `msg:mediaHeight` — media dimensions
- `msg:fileName`, `msg:fileSize`, `msg:fileType` — file attachments
- `msg:replyPreview` — truncated preview text of the replied-to message
- `msg:gifTitle` — title of a GIF from Giphy

### Access Group ExtraData

Group metadata uses `group:` namespaced keys in the access group's `ExtraData` field.
Stored via `createAccessGroup` / `updateAccessGroup`. Any DeSo messaging app can read these:

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

<!-- VITE-AGENTS-MD-START -->
[Vite Docs Index]|root: ./.vite-docs|version: ^6.3.5 (package.json:vite)|STOP. What you remember about Vite is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx github:sungkhum/vite-agent-index agents-md --output CLAUDE.md|sections:{root(5),blog(10),changes(5),config(7),guide(23)}|full_index: ./.vite-docs-index/full.index.txt
<!-- VITE-AGENTS-MD-END -->
