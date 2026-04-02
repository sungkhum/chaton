<p align="center">
  <img src="public/ChatOn-Logo-Small.png" width="80" height="80" alt="ChatOn" style="border-radius: 16px;" />
</p>

<h1 align="center">ChatOn</h1>

<p align="center">
  <strong>Encrypted messaging that no one can shut down.</strong><br/>
  DMs and group chats on the DeSo blockchain — cross-chain, open source, zero infrastructure cost.
</p>

<p align="center">
  <a href="https://getchaton.com">Live App</a> &nbsp;·&nbsp;
  <a href="https://github.com/sungkhum/chaton">GitHub</a> &nbsp;·&nbsp;
  <a href="https://getchaton.com/support">Support ChatOn</a> &nbsp;·&nbsp;
  <a href="https://focus.xyz/nathanwells">Built by @nathanwells</a>
</p>

---

## What is ChatOn?

ChatOn is a fully decentralized messaging app forked from the DeSo core team's [deso-chat-protocol](https://github.com/deso-protocol/deso-chat-protocol) and extended with AI-assisted development using [Claude](https://claude.ai). Every message is stored on-chain with end-to-end encryption. No backend servers. No database. No monthly infrastructure bill.

Sign in with a DeSo identity or an Ethereum wallet (MetaMask), and message anyone across both chains.

## Features

### Messaging
- **End-to-end encrypted DMs** — private conversations between any two DeSo or Ethereum users
- **Full metadata encryption** — media URLs, reactions, file names, and reply previews are encrypted by default, not just message text
- **Encrypted group chats** — create named groups, add members, manage access, rename groups
- **Cross-chain messaging** — message DeSo usernames, public keys, ETH addresses, or ENS names
- **Optimistic UI** — messages appear instantly; blockchain confirmation happens in the background
- **Message replies** — reply to specific messages with quoted preview
- **Emoji reactions** — react to any message with the full emoji set
- **Animated emoji** — emoji-only messages display as animated Noto Emoji via Google CDN
- **Formatted messages** — markdown support for bold, italic, links, and code

### Rich Media
- **Image sharing** — upload and send images with lightbox preview
- **GIF & sticker picker** — search and send GIFs and stickers via Klipy integration
- **Image captions** — add text captions to images and GIFs
- **Link attachments** — share URLs with descriptions, Open Graph previews, and branded cards for 44+ services (Google Drive, GitHub, Figma, YouTube, Dropbox, etc.)
- **Rich media rendering** — video and file messages sent from other DeSo apps render with inline playback, download links, and file type icons

### Real-Time
- **WebSocket relay** — instant message delivery via Cloudflare Durable Objects
- **Typing indicators** — see when someone is typing in real-time
- **Push notifications** — two-layer system: instant relay push when sender is online, plus 60-second blockchain polling that catches messages from any DeSo app
- **Subscription hygiene** — expired endpoints auto-deactivated on 410/404, failure counter removes broken subscriptions after 5 consecutive errors
- **Unread badges** — per-conversation unread counts with visual indicators

### Chat Requests
- **Request inbox** — messages from strangers go to a separate "Requests" tab
- **Smart classification** — mutual DeSo follows, approved contacts, and self-initiated chats go straight to your inbox
- **Accept / Block / Dismiss** — on-chain associations for permanent, portable decisions
- **DM archiving** — hide DM conversations with on-chain associations
- **No spam** — blocked users are filtered out completely

### Design
- **Telegram-style mobile UX** — two-line conversation rows with timestamps, unread pills, and compact layout
- **Speed-dial FAB** — floating action button for new messages and group creation
- **Dark theme** — purpose-built dark interface with green accent system
- **PWA support** — installable as a native app on mobile and desktop
- **Responsive** — full-width mobile view with slide transitions, sidebar + chat pane on desktop

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Blockchain | [deso-protocol](https://www.npmjs.com/package/deso-protocol) SDK |
| Real-time | Cloudflare Workers + Durable Objects (WebSocket relay) |
| Push | Cloudflare Cron Triggers + D1 + Queues (blockchain polling) |
| GIFs & Stickers | [Klipy](https://klipy.co) (GIF and sticker search API) |
| Emoji Picker | [frimousse](https://github.com/liveblocks/frimousse) (React 19 native) |
| Animated Emoji | [Noto Emoji Animation](https://fonts.google.com/noto/emoji) (Google CDN, WebP) |
| Markdown | [Marked](https://github.com/markedjs/marked) (formatted messages) |
| Icons | Lucide React |
| Toasts | Sonner |
| PWA | Serwist (service worker + caching) |
| Animations | GSAP + ScrollTrigger |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/sungkhum/chaton.git
cd chaton
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_NODE_URL=https://node.deso.org
VITE_IDENTITY_URL=https://identity.deso.org
VITE_PROFILE_URL=https://focus.xyz
VITE_IS_TESTNET=false
VITE_KLIPY_API_KEY=your_klipy_api_key
VITE_RELAY_URL=wss://your-relay-worker.workers.dev
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

| Variable | Description |
|----------|-------------|
| `VITE_NODE_URL` | DeSo node endpoint |
| `VITE_IDENTITY_URL` | DeSo Identity service URL |
| `VITE_PROFILE_URL` | Base URL for user profile links |
| `VITE_IS_TESTNET` | Set to `true` for testnet |
| `VITE_KLIPY_API_KEY` | Klipy API key for GIF and sticker search |
| `VITE_RELAY_URL` | WebSocket relay URL (Cloudflare Worker) |
| `VITE_VAPID_PUBLIC_KEY` | VAPID key for push notifications |

### Development

```bash
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173).

### Worker (Push Notifications + Relay)

```bash
cd worker
npm install

# Create the D1 database (first time only)
npx wrangler d1 create chaton-push
# Copy the database_id into wrangler.toml

# Run the D1 migration (remote)
npx wrangler d1 migrations apply chaton-push --remote

# Create the push queue (first time only)
npx wrangler queues create chaton-push-events

# Set secrets
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT

# Deploy
npx wrangler deploy
```

### Production Build

```bash
npm run build
npm run preview
```

## Architecture

ChatOn follows a **DeSo-first** architecture. The blockchain is the database.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  React PWA  │────▶│  DeSo Node   │────▶│  DeSo Blockchain│
│  (Frontend) │     │  (API layer) │     │  (Data layer)   │
└──────┬──────┘     └──────┬───────┘     └─────────────────┘
       │                   │
       │ WebSocket         │ Cron poll (every 60s)
       ▼                   ▼
┌──────────────────────────────────────┐
│  Cloudflare Worker                   │
│  ├─ Durable Object (WebSocket relay) │
│  ├─ D1 (subscriptions + thread state)│
│  ├─ Cron Trigger (DeSo poller)       │
│  ├─ Queue (push delivery)            │
│  └─ /og endpoint (OG metadata fetch) │
└──────────────────────────────────────┘
```

- **All messages and metadata** (media URLs, reactions, file names) are encrypted and stored on the DeSo blockchain
- **All identity** (usernames, keys, follows) comes from DeSo
- **The relay** forwards real-time WebSocket events and sends push notifications
- **D1** stores push subscriptions and per-user thread timestamps for polling
- **Cron + Queue** detect new messages from any DeSo app and deliver Web Push
- **Target cost**: near-$0/month infrastructure (Cloudflare paid plan for Queues)

### Push Notification Architecture

Push notifications work in two layers:

1. **Instant (relay)** — when a ChatOn user sends a message, the WebSocket relay pushes to recipients immediately. Sub-second delivery, but only works for messages sent from ChatOn.

2. **Polling (cron)** — every 60 seconds, a Cloudflare Cron Trigger polls the DeSo `get-all-user-message-threads` endpoint for each opted-in user. It compares nanosecond-precision timestamps against stored state in D1. New messages are enqueued to a Cloudflare Queue, which delivers Web Push notifications to all active subscriptions.

The service worker deduplicates: if the app is visible, push notifications are suppressed (the WebSocket already updated the UI). Both layers use matching notification tags so the browser collapses duplicate notifications for the same conversation.

## Project Structure

```
src/
├── components/          # React components
│   ├── compose/         # Message composer (emoji, GIF, reply)
│   ├── messages/        # Message type renderers (image, video, file, etc.)
│   ├── shared/          # Reusable UI primitives
│   └── form/            # Form components
├── hooks/               # Custom hooks (mobile, intervals, WebSocket, typing)
├── services/            # Business logic (conversations, media, Giphy)
├── store/               # Zustand store (auth, access groups, classification)
└── utils/               # Helpers, constants, types, ExtraData conventions

worker/
├── src/
│   ├── index.ts         # Fetch handler, cron scheduler, queue consumer
│   ├── chat-relay.ts    # Durable Object: WebSocket relay + real-time push
│   ├── web-push.ts      # RFC 8291/8292 VAPID encryption (Web Crypto only)
│   ├── poll.ts          # DeSo thread polling + new message detection
│   ├── og.ts            # Open Graph metadata fetcher (SSRF-safe, cached)
│   └── db.ts            # D1 helpers (users, subscriptions, thread state)
├── migrations/          # D1 schema migrations
└── wrangler.toml        # Worker config (D1, Queue, Cron, Durable Object)
```

## DeSo Rich Messaging Protocol

ChatOn extends the core DeSo messaging protocol with rich features — reactions, replies, media, mentions, and more — using DeSo's `ExtraData` field on message transactions. Everything below uses generic `msg:` namespaced keys that **any DeSo messaging app can adopt** for cross-app compatibility.

> **Why this matters:** Standard DeSo messaging apps only handle plain text in `EncryptedMessageText`. ChatOn layers structured metadata on top via `ExtraData`, enabling rich media, reactions, replies, edit/delete, and user mentions — all stored on the same blockchain. If your app reads these keys, your users can participate in the same conversations with full fidelity.

### How It Works

Every DeSo message transaction has two data channels:

1. **`EncryptedMessageText`** — the message body, encrypted with the recipient's access group key
2. **`ExtraData`** — a `Record<string, string>` of metadata, stored on-chain

ChatOn uses `ExtraData` to carry structured metadata alongside the encrypted body. The message body contains human-readable text (so apps without rich message support still display something useful), while `ExtraData` carries the machine-readable details.

### Message ExtraData Keys

All keys use the `msg:` namespace. Set only the keys relevant to your message type.

| Key | Value | Description |
|-----|-------|-------------|
| `msg:type` | `text` \| `image` \| `gif` \| `sticker` \| `video` \| `file` \| `reaction` \| `system` | Message type. Omit for plain text. |
| `msg:replyTo` | `TimestampNanosString` | Timestamp of the message being replied to or reacted to |
| `msg:replyPreview` | `string` | Truncated preview of the replied-to message (for display without lookup) |
| `msg:emoji` | emoji character | The emoji for a reaction (encrypted — see below) |
| `msg:action` | `add` \| `remove` | Reaction toggle (encrypted — see below). Omit for `add`. |
| `msg:imageUrl` | URL | Image attachment URL |
| `msg:gifUrl` | URL | GIF or sticker URL |
| `msg:gifTitle` | `string` | Title/alt text for the GIF or sticker (from Klipy) |
| `msg:videoUrl` | URL | Video attachment URL |
| `msg:duration` | `string` (seconds) | Media duration |
| `msg:mediaWidth` | `string` (pixels) | Media width for aspect ratio |
| `msg:mediaHeight` | `string` (pixels) | Media height for aspect ratio |
| `msg:fileName` | `string` | File attachment name |
| `msg:fileSize` | `string` (bytes) | File size |
| `msg:fileType` | MIME type | File MIME type |
| `msg:fileUrl` | URL | Shared link URL (for link attachments) |
| `msg:fileDescription` | `string` | User-provided description for a shared link |
| `msg:ogTitle` | `string` | Open Graph title fetched from the URL (max 100 chars) |
| `msg:ogDescription` | `string` | Open Graph description fetched from the URL (max 200 chars) |
| `msg:ogImage` | URL | Open Graph image URL fetched from the URL |
| `msg:edited` | `"true"` | Message has been edited |
| `msg:deleted` | `"true"` | Message has been soft-deleted |
| `msg:mentions` | JSON array | User mentions: `[{"pk":"BC1Y...","un":"alice"}]` |
| `msg:encrypted` | `"true"` | Flag indicating some ExtraData values are encrypted |
| `msg:systemAction` | `member-joined` \| `member-left` | System event type (for `msg:type: "system"` messages) |
| `msg:systemMembers` | JSON array | Users involved: `[{"pk":"BC1Y...","un":"alice"}]` |

### Captions

Images and GIFs support user-written captions. The caption is stored in `EncryptedMessageText` (the message body), not in a separate ExtraData key. When the message body differs from the filename (for images) or the GIF title (for GIFs), it's treated as a caption and rendered below the media.

```
# Image with caption
ExtraData:
  msg:type        = "image"
  msg:imageUrl    = "https://images.deso.org/..."
  msg:mediaWidth  = "1200"
  msg:mediaHeight = "800"

EncryptedMessageText: <encrypted "Check out this view">  # ← caption (not the filename)
```

To detect a caption: if `msg:type` is `image` and the decrypted message text differs from the original filename, display it as a caption. For GIFs, compare against `msg:gifTitle`.

### Stickers

Stickers use the same ExtraData structure as GIFs but with `msg:type: "sticker"`. The URL in `msg:gifUrl` points to the sticker animation. Stickers are sent immediately without a caption preview (unlike GIFs which show a preview/caption screen before sending).

```
ExtraData:
  msg:type        = "sticker"
  msg:gifUrl      = "https://media.klipy.co/..."
  msg:gifTitle    = "thumbs up"
  msg:mediaWidth  = "320"
  msg:mediaHeight = "320"

EncryptedMessageText: <encrypted "thumbs up">
```

### Encrypted ExtraData

ExtraData is normally stored as plaintext on the blockchain. For sensitive values, ChatOn encrypts individual ExtraData values using the same key used for the message body.

ChatOn supports two privacy modes, controlled by a toggle in the user menu:

| Mode | What's encrypted in ExtraData | Default? |
|------|-------------------------------|----------|
| **Full** | All media URLs, file metadata, reply previews, mentions, reactions | Yes |
| **Standard** | `msg:emoji`, `msg:action` (reaction privacy only) | No |

**Full mode encrypts these keys:**

```
msg:emoji, msg:action, msg:imageUrl, msg:gifUrl, msg:gifTitle,
msg:videoUrl, msg:duration, msg:mediaWidth, msg:mediaHeight,
msg:fileName, msg:fileSize, msg:fileType, msg:fileUrl, msg:fileDescription,
msg:ogTitle, msg:ogDescription, msg:ogImage, msg:replyPreview, msg:mentions
```

**Standard mode encrypts only:** `msg:emoji`, `msg:action`

**How it works:**

1. Before sending, encrypt the relevant ExtraData values with `identity.encryptMessage(recipientAccessGroupPublicKey, value)` — the same function and key used for the message body.
2. Set `msg:encrypted: "true"` to signal that some values need decryption.
3. On the receiving side, always attempt to decrypt all potentially-encrypted keys (the sender may use full mode even if the receiver doesn't). The same DM-vs-group key resolution applies.

**Backward compatibility:** Apps that don't handle `msg:encrypted` will see encrypted hex strings instead of plaintext values. They can safely ignore these — the encrypted message body still contains a human-readable fallback. In Full mode (the default), media URLs, file names, and other metadata are unreadable to other DeSo apps that haven't implemented decryption. Users can switch to Standard mode if cross-app compatibility for media metadata is more important than privacy.

**Note on media URLs:** Images, videos, and files are uploaded to DeSo's public image hosting, so the media itself is accessible to anyone with the URL. What Full encryption protects is the *link* — without decrypting the ExtraData, no one can discover which URLs belong to your conversation. This is a DeSo platform limitation, not a ChatOn limitation.

The user's privacy mode preference is stored as an on-chain self-association (see [On-Chain Associations](#on-chain-associations) below) and cached locally for instant access.

### Reactions

Reactions are sent as separate messages with `msg:type: "reaction"`.

```
ExtraData:
  msg:type      = "reaction"
  msg:replyTo   = "1234567890000000000"   # TimestampNanos of target message
  msg:emoji     = <encrypted emoji>        # e.g. "👍" after decryption
  msg:encrypted = "true"

EncryptedMessageText: <encrypted fallback, e.g. 'Reacted 👍 to "hey"'>
```

To aggregate reactions, collect all messages where `msg:type === "reaction"`, group by `msg:replyTo` + decrypted `msg:emoji`, and filter out any with `msg:action === "remove"`.

### Replies

Replies reference the original message by timestamp and include a preview for quick rendering.

```
ExtraData:
  msg:replyTo      = "1234567890000000000"   # TimestampNanos of original
  msg:replyPreview = "Sure, let's meet at..."  # First ~100 chars

EncryptedMessageText: <encrypted reply body>
```

### Media Messages

Set `msg:type` to the media type, include the URL, and include dimensions for layout.

```
# Image example
ExtraData:
  msg:type        = "image"
  msg:imageUrl    = "https://images.deso.org/..."
  msg:mediaWidth  = "1200"
  msg:mediaHeight = "800"
```

The encrypted message body should contain a text fallback (e.g., the image URL, a caption, or a description) for apps that don't render media inline.

### Link Attachments

Users can share URLs with optional descriptions and automatically fetched Open Graph metadata. The URL, description, and OG data are stored in ExtraData while the message body carries a human-readable fallback for other DeSo apps.

```
ExtraData:
  msg:type            = "file"
  msg:fileUrl         = "https://github.com/sungkhum/chaton"
  msg:fileDescription = "ChatOn source code"
  msg:fileName        = "github.com"
  msg:ogTitle         = "sungkhum/chaton"
  msg:ogDescription   = "Encrypted messaging on the DeSo blockchain"
  msg:ogImage         = "https://opengraph.githubassets.com/..."

EncryptedMessageText: <encrypted "📎 ChatOn source code\nhttps://github.com/sungkhum/chaton">
```

**Backward compatibility:** The encrypted message body contains `📎 Description\nURL`, so apps that don't understand the ExtraData keys still display a readable message with the link.

**Open Graph fetching:** OG metadata is fetched once by the sender's client via a Cloudflare Worker endpoint (`/og`). The worker fetches the first 50KB of the target page, extracts `og:title`, `og:description`, and `og:image` (with `<title>` and `<meta name="description">` fallbacks), and caches results for 1 hour. The OG data is embedded in ExtraData at send time — receivers never need to fetch it, which preserves recipient privacy (no IP leakage to the target site).

**Service detection:** ChatOn recognizes 44+ services (Google Drive, Dropbox, GitHub, Figma, YouTube, Notion, etc.) by URL pattern and renders branded cards with service-specific colors and badges. This is purely cosmetic — no special ExtraData is stored; detection happens at render time from `msg:fileUrl`.

**Encryption:** In full privacy mode, `msg:fileUrl`, `msg:fileDescription`, `msg:ogTitle`, `msg:ogDescription`, and `msg:ogImage` are all encrypted alongside the other ExtraData values. Other DeSo apps that haven't implemented decryption will only see the encrypted message body fallback.

### Edit and Delete

Edits and deletes use DeSo's `updateDMMessage` / `updateGroupChatMessage` with the original `TimestampNanosString`. Set `msg:edited: "true"` or `msg:deleted: "true"` in ExtraData.

### System Messages

System messages are group chat events (member joins, leaves, etc.) sent as regular encrypted messages with `msg:type: "system"`. No special blockchain primitives — they use the same `sendGroupChatMessage` call as any other message, with structured metadata in ExtraData.

**Current actions:**

| `msg:systemAction` | When sent | Sender |
|---------------------|-----------|--------|
| `member-joined` | Owner adds members or approves a join request | Group owner |
| `member-left` | A member leaves the group | The leaving member (sent before the leave) |

**ExtraData format:**

```
msg:type          = "system"
msg:systemAction  = "member-joined"
msg:systemMembers = [{"pk":"BC1Y...","un":"alice"},{"pk":"BC1Y...","un":"bob"}]
```

The `msg:systemMembers` value is a JSON-encoded array of `{"pk": "<publicKey>", "un": "<username>"}` objects — the same shape used by `msg:mentions`.

**Encrypted message body** contains a human-readable fallback, e.g. `"alice and bob joined the group"`. Apps that don't understand `msg:type: "system"` will display this as a normal text message — still readable, just not styled as a system event.

**Rendering:** System messages should render as centered, un-bubbled text (like Telegram). They are not attributed to a sender and don't show avatars, timestamps, or action bars. Example:

```
                     ┌──────────────────────────┐
                     │ alice joined the group    │
                     └──────────────────────────┘
```

**Extensibility:** New `msg:systemAction` values can be added for future events (e.g. `group-renamed`, `group-image-changed`) without changing the message structure. Unknown actions should fall back to displaying the message body text.

### Access Group ExtraData

Group metadata uses the `group:` namespace, stored via `createAccessGroup` / `updateAccessGroup`:

| Key | Value | Description |
|-----|-------|-------------|
| `group:displayName` | `string` | Human-readable group name. The `AccessGroupKeyName` is immutable on-chain, so this allows owners to rename groups after creation. Falls back to `AccessGroupKeyName` if unset. |
| `group:imageUrl` | URL | Group profile image |

### On-Chain Associations

ChatOn uses DeSo User Associations for chat request classification, DM archiving, and user preferences. These are portable across apps — any DeSo messaging app can query for them.

| Association Type | Value | Target | Meaning |
|-----------------|-------|--------|---------|
| `chaton:chat-approved` | `"approved"` | Other user | User accepted a chat request from the target user |
| `chaton:chat-blocked` | `"blocked"` | Other user | User blocked the target user |
| `chaton:chat-dismissed` | `"dismissed"` | Other user | User dismissed a chat request without blocking (can be undone by deleting the association) |
| `chaton:chat-archived` | `"archived"` | Other user | User archived/hid a DM conversation |
| `chat:group-archived` | `<AccessGroupKeyName>` | Group owner | User left/archived a group chat. Generic `chat:` prefix so any DeSo app can query it. Composite key: `TargetUserPublicKey + AssociationValue` reconstructs the conversation key. |
| `chaton:privacy-mode` | `"standard"` \| `"full"` | Self | User's ExtraData encryption preference. Self-referencing (transactor = target). Absent = `"full"` (the default). DeSo doesn't support updating association values, so changing modes requires delete + recreate. |

**Namespace convention:** `chaton:` prefixed types are ChatOn-specific. `chat:` prefixed types (like `chat:group-archived`) are generic conventions that any DeSo messaging app should adopt for cross-app interoperability.

### Chat Request Classification

ChatOn classifies DM conversations as **chat** (inbox), **request** (pending), **blocked**, **archived**, or **dismissed** using on-chain data. This is a pure function — no backend needed.

**Inputs:**
- The conversation's messages and metadata
- Mutual DeSo follows (bidirectional follow check)
- On-chain associations (approved, blocked, dismissed, archived)
- Whether the current user initiated the conversation

**Classification order (first match wins):**

```
1. Group chats:
   a. If group is in archivedGroups → "archived"
   b. Otherwise → "chat" (always in inbox)

2. DM chats — check the other party's public key:
   a. blockedUsers.has(otherKey)     → "blocked"
   b. dismissedUsers.has(otherKey)   → "dismissed"
   c. archivedChats.has(otherKey)    → "archived"
   d. mutualFollows.has(otherKey)    → "chat"
   e. approvedUsers.has(otherKey)    → "chat"
   f. initiatedChats.has(otherKey)   → "chat"
   g. Current user sent first msg    → "chat"
   h. Otherwise                      → "request"
```

**Data fetching:** On first load, `fetchMutualFollows()` and `fetchChatAssociations()` run in `Promise.all` alongside `getConversations()`. Mutual follows are computed by intersecting the user's following list with their followers list (paginated, 500 per page). Associations are fetched by type with pagination (100 per page). Results are cached in the Zustand store for the session.

### Derived Key Permissions

To avoid repeated authorization prompts, request a derived key with broad permissions up front. Here's the full set of permissions ChatOn requests:

**TransactionCountLimitMap:**

| Transaction Type | Limit | Purpose |
|-----------------|-------|---------|
| `AUTHORIZE_DERIVED_KEY` | `1` | The derived key authorization itself |
| `NEW_MESSAGE` | `UNLIMITED` | Send, edit, and delete DMs and group messages |
| `ACCESS_GROUP` | `UNLIMITED` | Create/update access groups (default-key setup, new group chats, group images) |
| `ACCESS_GROUP_MEMBERS` | `UNLIMITED` | Add/remove members from group chats |
| `UPDATE_PROFILE` | `5` | Profile updates during the key's lifetime |
| `FOLLOW` | `UNLIMITED` | Follow/unfollow users |
| `CREATE_USER_ASSOCIATION` | `UNLIMITED` | Create associations (approve, block, dismiss, archive, privacy mode) |
| `DELETE_USER_ASSOCIATION` | `UNLIMITED` | Delete associations (unblock, unarchive, update privacy mode) |
| `BASIC_TRANSFER` | `UNLIMITED` | Send DESO (tips/donations) |

**AccessGroupLimitMap:** Single wildcard entry — `ScopeType: "Any"`, `OperationType: "Any"`, scoped to the user's own public key.

**AccessGroupMemberLimitMap:** Single wildcard entry — `ScopeType: "Any"`, `OperationType: "Any"`, scoped to the user's own public key.

**AssociationLimitMap:** Single wildcard entry — `AssociationType: ""` (empty string acts as wildcard for all types), `AssociationOperation: "Any"`, `AppScopeType: "Any"`. This future-proofs the app — no need to update the limit map when adding new association types.

**GlobalDESOLimit:** `5 * 1e9` nanos (5 DESO) — covers transaction fees for all operations.

### Implementation Reference

The full implementation lives in these files:

- **[`src/utils/extra-data.ts`](src/utils/extra-data.ts)** — all `msg:` and `group:` constants, types, `parseMessageType()`, `buildExtraData()`, and encryption key lists
- **[`src/utils/constants.ts`](src/utils/constants.ts)** — association type/value constants and `getTransactionSpendingLimits()` (derived key permissions)
- **[`src/services/conversations.service.tsx`](src/services/conversations.service.tsx)** — encryption/decryption pipeline, send/update messages, all association CRUD, `classifyConversation()`, mutual follow detection
- **[`src/utils/link-services.ts`](src/utils/link-services.ts)** — URL-to-service detection for 44+ services (renders branded link cards)
- **[`src/services/og.service.ts`](src/services/og.service.ts)** — client-side Open Graph fetch service (calls the worker `/og` endpoint)
- **[`worker/src/og.ts`](worker/src/og.ts)** — server-side OG metadata extraction with SSRF protection and Cloudflare cache

## Contributing

Contributions are welcome. Fork the repo, create a branch, and open a PR.

```bash
git checkout -b feature/your-feature
npm run lint:fix
git commit -m "Add your feature"
git push origin feature/your-feature
```

## Support ChatOn

ChatOn is free, open-source, and runs at $0/month. No ads, no tracking, no VC funding — just a developer building messaging that belongs to its users.

If ChatOn is useful to you, consider sending a tip in $DESO:

**[Support ChatOn with $DESO &rarr;](https://getchaton.com/support)**

All tips go directly on-chain to [@GetChatOn](https://focus.xyz/GetChatOn). Transparent and verifiable by anyone.

## License

Open source. Built by [@nathanwells](https://focus.xyz/nathanwells).
