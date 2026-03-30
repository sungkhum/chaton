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
- **Encrypted group chats** — create named groups, add members, manage access
- **Cross-chain messaging** — message DeSo usernames, public keys, ETH addresses, or ENS names
- **Optimistic UI** — messages appear instantly; blockchain confirmation happens in the background
- **Message replies** — reply to specific messages with quoted preview
- **Emoji reactions** — react to any message with the full emoji set
- **Animated emoji** — emoji-only messages display as animated Noto Emoji via Google CDN
- **Formatted messages** — markdown support for bold, italic, links, and code

### Rich Media
- **Image sharing** — upload and send images with lightbox preview
- **GIF picker** — search and send GIFs via Giphy integration
- **Video messages** — send video with inline playback
- **File attachments** — share files of any type with download links

### Real-Time
- **WebSocket relay** — instant message delivery via Cloudflare Durable Objects
- **Typing indicators** — see when someone is typing in real-time
- **Push notifications** — two-layer system: instant relay push when sender is online, plus 60-second blockchain polling that catches messages from any DeSo app
- **Subscription hygiene** — expired endpoints auto-deactivated on 410/404, failure counter removes broken subscriptions after 5 consecutive errors
- **Unread badges** — per-conversation unread counts with visual indicators

### Chat Requests
- **Request inbox** — messages from strangers go to a separate "Requests" tab
- **Smart classification** — mutual DeSo follows, approved contacts, and self-initiated chats go straight to your inbox
- **Accept / Block** — on-chain associations for permanent, portable decisions
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
VITE_GIPHY_API_KEY=your_giphy_api_key
VITE_RELAY_URL=wss://your-relay-worker.workers.dev
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

| Variable | Description |
|----------|-------------|
| `VITE_NODE_URL` | DeSo node endpoint |
| `VITE_IDENTITY_URL` | DeSo Identity service URL |
| `VITE_PROFILE_URL` | Base URL for user profile links |
| `VITE_IS_TESTNET` | Set to `true` for testnet |
| `VITE_GIPHY_API_KEY` | Giphy API key for GIF search |
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
│  └─ Queue (push delivery)            │
└──────────────────────────────────────┘
```

- **All messages** are encrypted and stored on the DeSo blockchain
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
│   └── db.ts            # D1 helpers (users, subscriptions, thread state)
├── migrations/          # D1 schema migrations
└── wrangler.toml        # Worker config (D1, Queue, Cron, Durable Object)
```

## DeSo Rich Messaging Protocol

ChatOn extends the core DeSo messaging protocol with rich features — reactions, replies, media, mentions, and more — using DeSo's `ExtraData` field on message transactions. Everything below uses generic `msg:` namespaced keys that any DeSo messaging app can adopt for cross-app compatibility.

### How It Works

Every DeSo message transaction has two data channels:

1. **`EncryptedMessageText`** — the message body, encrypted with the recipient's access group key
2. **`ExtraData`** — a `Record<string, string>` of metadata, stored on-chain

ChatOn uses `ExtraData` to carry structured metadata alongside the encrypted body. The message body contains human-readable text (so apps without rich message support still display something useful), while `ExtraData` carries the machine-readable details.

### Message ExtraData Keys

All keys use the `msg:` namespace. Set only the keys relevant to your message type.

| Key | Value | Description |
|-----|-------|-------------|
| `msg:type` | `text` \| `image` \| `gif` \| `video` \| `file` \| `reaction` | Message type. Omit for plain text. |
| `msg:replyTo` | `TimestampNanosString` | Timestamp of the message being replied to or reacted to |
| `msg:replyPreview` | `string` | Truncated preview of the replied-to message (for display without lookup) |
| `msg:emoji` | emoji character | The emoji for a reaction (encrypted — see below) |
| `msg:action` | `add` \| `remove` | Reaction toggle (encrypted — see below). Omit for `add`. |
| `msg:imageUrl` | URL | Image attachment URL |
| `msg:gifUrl` | URL | GIF URL (from Giphy or similar) |
| `msg:gifTitle` | `string` | Title/alt text for the GIF |
| `msg:videoUrl` | URL | Video attachment URL |
| `msg:duration` | `string` (seconds) | Media duration |
| `msg:mediaWidth` | `string` (pixels) | Media width for aspect ratio |
| `msg:mediaHeight` | `string` (pixels) | Media height for aspect ratio |
| `msg:fileName` | `string` | File attachment name |
| `msg:fileSize` | `string` (bytes) | File size |
| `msg:fileType` | MIME type | File MIME type |
| `msg:edited` | `"true"` | Message has been edited |
| `msg:deleted` | `"true"` | Message has been soft-deleted |
| `msg:mentions` | JSON array | User mentions: `[{"pk":"BC1Y...","un":"alice"}]` |
| `msg:encrypted` | `"true"` | Flag indicating some ExtraData values are encrypted |

### Encrypted ExtraData

ExtraData is normally stored as plaintext on the blockchain. For sensitive values (like which emoji someone reacted with), ChatOn encrypts individual ExtraData values using the same key used for the message body.

**How it works:**

1. Before sending, encrypt the values of `msg:emoji` and `msg:action` with `identity.encryptMessage(recipientAccessGroupPublicKey, value)` — the same function and key used for the message body.
2. Set `msg:encrypted: "true"` to signal that some values need decryption.
3. On the receiving side, decrypt those values after decrypting the message body. The same DM-vs-group key resolution applies.

**Backward compatibility:** Apps that don't handle `msg:encrypted` will see encrypted hex strings in `msg:emoji` instead of an emoji character. They can safely ignore this — the encrypted message body still contains a human-readable fallback like `Reacted 👍 to "hey"`.

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

The encrypted message body should contain a text fallback (e.g., the image URL or a description) for apps that don't render media inline.

### Edit and Delete

Edits and deletes use DeSo's `updateDMMessage` / `updateGroupChatMessage` with the original `TimestampNanosString`. Set `msg:edited: "true"` or `msg:deleted: "true"` in ExtraData.

### Access Group ExtraData

Group metadata uses the `group:` namespace, stored via `createAccessGroup` / `updateAccessGroup`:

| Key | Value | Description |
|-----|-------|-------------|
| `group:imageUrl` | URL | Group profile image |

### On-Chain Associations

ChatOn uses DeSo User Associations for chat request classification. These are portable across apps.

| Association Type | Value | Meaning |
|-----------------|-------|---------|
| `chaton:chat-approved` | `"approved"` | User accepted a chat request from the target user |
| `chaton:chat-blocked` | `"blocked"` | User blocked the target user |
| `chat:group-archived` | `<AccessGroupKeyName>` | User left/archived a group chat. Target = group owner's public key. Generic `chat:` prefix so any DeSo app can query it. |

### Implementation Reference

The full implementation lives in two files:

- **[`src/utils/extra-data.ts`](src/utils/extra-data.ts)** — constants, types, `parseMessageType()`, and `buildExtraData()`
- **[`src/services/conversations.service.tsx`](src/services/conversations.service.tsx)** — encryption/decryption, send/update, and the ExtraData encryption pipeline

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
