<p align="center">
  <img src="public/ChatOn-Logo-Small.png" width="80" height="80" alt="ChatOn" style="border-radius: 16px;" />
</p>

<h1 align="center">ChatOn</h1>

<p align="center">
  <strong>Encrypted messaging that no one can shut down.</strong><br/>
  DMs and group chats on the DeSo blockchain — cross-chain, open source, zero infrastructure cost.
</p>

<p align="center">
  <a href="https://chaton.social">Live App</a> &nbsp;·&nbsp;
  <a href="https://github.com/sungkhum/chaton">GitHub</a> &nbsp;·&nbsp;
  <a href="https://focus.xyz/nathanwells">Built by @nathanwells</a>
</p>

---

## What is ChatOn?

ChatOn is a fully decentralized messaging app built on the [DeSo blockchain](https://deso.com). Every message is stored on-chain with end-to-end encryption, at a cost of ~$0.000002 per message. No backend servers. No database. No monthly infrastructure bill.

Sign in with a DeSo identity or an Ethereum wallet (MetaMask), and message anyone across both chains.

## Features

### Messaging
- **End-to-end encrypted DMs** — private conversations between any two DeSo or Ethereum users
- **Encrypted group chats** — create named groups, add members, manage access
- **Cross-chain messaging** — message DeSo usernames, public keys, ETH addresses, or ENS names
- **Optimistic UI** — messages appear instantly; blockchain confirmation happens in the background
- **Message replies** — reply to specific messages with quoted preview
- **Emoji reactions** — react to any message with the full emoji set

### Rich Media
- **Image sharing** — upload and send images with lightbox preview
- **GIF picker** — search and send GIFs via Giphy integration
- **Voice notes** — record, preview, and send audio messages with waveform visualization
- **Video messages** — send video with inline playback
- **File attachments** — share files of any type with download links

### Real-Time
- **WebSocket relay** — instant message delivery via Cloudflare Durable Objects
- **Typing indicators** — see when someone is typing in real-time
- **Push notifications** — browser push notifications for new messages (with VAPID)
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
| Emoji | [frimousse](https://github.com/liveblocks/frimousse) (React 19 native) |
| Icons | Lucide React |
| Toasts | Sonner |
| PWA | Serwist (service worker + caching) |
| Animations | GSAP (landing page) |

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

Opens at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm run preview
```

## Architecture

ChatOn follows a **DeSo-first** architecture. There is no custom backend or database.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  React App  │────▶│  DeSo Node   │────▶│  DeSo Blockchain│
│  (Frontend) │     │  (API layer) │     │  (Data layer)   │
└─────┬───────┘     └──────────────┘     └─────────────────┘
      │
      │  WebSocket
      ▼
┌─────────────────────┐
│  Cloudflare Worker   │
│  (Durable Object)    │
│  Real-time relay only│
└─────────────────────┘
```

- **All messages** are encrypted and stored on the DeSo blockchain
- **All identity** (usernames, keys, follows) comes from DeSo
- **The relay** only forwards real-time notifications — it stores nothing
- **Target cost**: $0/month infrastructure

## Project Structure

```
src/
├── components/          # React components
│   ├── compose/         # Message composer (emoji, GIF, voice, reply)
│   ├── messages/        # Message type renderers (image, video, file, etc.)
│   ├── shared/          # Reusable UI primitives
│   └── form/            # Form components
├── hooks/               # Custom hooks (mobile, intervals, WebSocket, typing)
├── services/            # Business logic (conversations, media, Giphy)
├── store/               # Zustand store (auth, access groups, classification)
└── utils/               # Helpers, constants, types, ExtraData conventions
```

## Contributing

Contributions are welcome. Fork the repo, create a branch, and open a PR.

```bash
git checkout -b feature/your-feature
npm run lint:fix
git commit -m "Add your feature"
git push origin feature/your-feature
```

## License

Open source. Built by [@nathanwells](https://focus.xyz/nathanwells).
