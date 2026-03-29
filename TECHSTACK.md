# Chattra Tech Stack (2026)

Telegram-level encrypted messaging PWA on DeSo. **DeSo-first architecture**: the blockchain is the database. No custom backend, no managed database. External services only where DeSo has gaps (real-time delivery, push notifications).

**Target cost: $0/month** for < 1,000 users.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                      │
│              Vite + React 19 SPA (PWA)                  │
│         shadcn/ui  ·  Tailwind v4  ·  Serwist           │
└──────────┬──────────────────┬───────────────────────────┘
           │ REST (deso-js)   │ WebSocket
           ▼                  ▼
┌──────────────────┐  ┌───────────────────────────────────┐
│   DeSo Nodes     │  │  Cloudflare Durable Objects       │
│  (node.deso.org) │  │  (notification relay only)        │
│                  │  │                                   │
│  · Messages      │  │  · "New message" WebSocket pings  │
│  · Identity      │  │  · Typing indicators              │
│  · Encryption    │  │  · Presence / online status       │
│  · Payments      │  │  · WebSocket hibernation          │
│  · Social graph  │  │                                   │
│  · Profiles      │  │  Messages are NOT stored here.    │
│  · Access groups │  │  This is a thin notification bus. │
│  · Image CDN     │  │                                   │
└──────────────────┘  └───────────────────────────────────┘
                              │
                       ┌──────┴──────┐
                       ▼             ▼
               ┌──────────────┐ ┌──────────┐
               │  Web Push    │ │ Cloudflare│
               │  API (VAPID) │ │ R2       │
               │              │ │          │
               │  Background  │ │ Files    │
               │  push when   │ │ beyond   │
               │  app closed  │ │ images   │
               └──────────────┘ └──────────┘
```

### Key Insight: DeSo IS the Database

The current chattra app already works this way — it talks directly to DeSo nodes with no backend server. We keep that. DeSo stores messages, handles encryption, manages identity, and even hosts uploaded images via `images.deso.org`.

The only thing DeSo lacks is **real-time delivery** (it only supports HTTP polling). We bridge that gap with a thin Cloudflare Durable Object that acts as a WebSocket notification bus: when a client sends a message via DeSo, it also pings the DO, which broadcasts "new message in thread X" to connected clients. Clients then fetch the actual message from DeSo. The DO stores **zero messages**.

---

## Stack at a Glance

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend** | Vite + React 19 | Chat is a client-side app. No SSR overhead. Sub-second HMR. |
| **Components** | shadcn/ui (Radix) | Own every component. Full control for custom chat UI. Zero runtime cost. |
| **Styling** | Tailwind CSS v4 | CSS-first config, CSS variable theming, dominant ecosystem. |
| **Blockchain SDK** | deso-protocol 3.x | Messages, identity, payments, encryption, social graph. The entire data layer. |
| **Real-time relay** | Cloudflare Durable Objects | Thin WebSocket notification bus. Free tier: 100K req/day (~2M WS messages via 20:1 ratio). WebSocket hibernation = zero CPU when idle. |
| **Push notifications** | Raw Web Push API + VAPID | Free forever. No SDK dependency. Cloudflare Worker sends push requests. |
| **File storage** | DeSo image CDN + Cloudflare R2 | DeSo's `images.deso.org` for images (free, already integrated). R2 (10GB free, zero egress) for anything DeSo can't handle (large files, voice notes, documents). |
| **E2E encryption (1:1)** | DeSo built-in | Already works. On-chain access group encryption. Keep it. |
| **E2E encryption (groups)** | DeSo access groups (current) → MLS later | DeSo's group encryption works now. MLS (RFC 9420) is the upgrade path when group sizes demand O(log n) key updates. |
| **Voice/Video** | LiveKit Cloud (deferred) | Free tier: 5K participant-min/month. Add when core messaging is solid. |
| **PWA** | Serwist + vite-plugin-pwa | Maintained Workbox fork. ESM-only, TypeScript-native. |
| **Deployment** | Cloudflare Pages | Free. SPA hosting + Workers/DOs for real-time. |
| **AI** | Claude API + Vercel AI SDK | Translation bots, scripture lookup, moderation. Deferred to post-MVP. |

---

## What We Eliminated (and Why)

The previous tech stack included a full backend + database for off-chain message storage. Since we're committing to DeSo as the data layer, we no longer need:

| Removed | Was | Why It's Gone |
|---------|-----|---------------|
| **Neon Postgres** | Off-chain message store | DeSo stores all messages on-chain. No database to manage. |
| **Drizzle ORM** | Database access layer | No database = no ORM. |
| **Railway (Bun + Hono)** | Backend server | No backend needed. SPA talks directly to DeSo nodes. Cloudflare Worker handles push dispatch. |
| **OneSignal** | Push notification service | Raw Web Push API is free with zero limits. No SDK overhead. |
| **MLS (immediate)** | Group encryption | DeSo's access group encryption already handles groups. MLS is a future upgrade, not MVP. |

**Savings: ~$10-40/month eliminated** (Neon + Railway costs) plus significant architectural complexity.

---

## Detailed Decisions

### Data Layer: DeSo (not a custom database)

DeSo provides everything a chat app needs for data storage:

| Need | DeSo API | deso-js Method |
|------|----------|----------------|
| Send DM | `POST /api/v0/send-dm-message` | `sendDMMessage()` |
| Send group message | `POST /api/v0/send-group-chat-message` | `sendGroupChatMessage()` |
| Edit message | `POST /api/v0/update-dm-message` | `updateDMMessage()` |
| List conversations | `POST /api/v0/get-all-user-message-threads` | `getAllMessageThreads()` |
| Paginated history | `POST /api/v0/get-paginated-messages-for-dm-thread` | `getPaginatedDMThread()` |
| Create group | `POST /api/v0/create-access-group` | `createAccessGroup()` |
| Upload images | `POST /api/v0/upload-image` | Via node endpoint |
| Identity/auth | DeSo Identity service | `identity.login()` |
| Payments | `POST /api/v0/send-deso` | `sendDeso()` |
| Token-gating | Creator coin / DAO coin checks | `getIsHodling()` |
| Social graph | Follow/profile APIs | `updateFollowingStatus()` |

**Trade-offs we accept:**
- Message latency is higher than a local database (network round-trip to DeSo node)
- Search across message history depends on DeSo's API capabilities
- We're coupled to DeSo node availability (mitigated by running our own node later if needed)
- Transaction fees exist but are fractions of a cent per message

### Real-time: Cloudflare Durable Objects (notification relay)

DeSo has no WebSocket API — only HTTP polling. The current app polls every 5s (desktop) / 20s (mobile). For Telegram-level UX, messages must arrive in <100ms.

**Solution: thin notification bus, not a message store.**

1. Client sends message via DeSo (`sendDMMessage()`)
2. After DeSo confirms, client pings the Durable Object: `{ type: "notify", threadId: "abc123" }`
3. DO broadcasts to all connected clients in that thread: `{ type: "new-message", threadId: "abc123" }`
4. Receiving clients fetch the actual message from DeSo (`getPaginatedDMThread()`)

The DO handles:
- WebSocket connections (with hibernation — zero CPU when idle)
- Typing indicators (ephemeral, never stored)
- Online/offline presence (ephemeral)
- "New message" pings (ephemeral)

The DO does NOT handle:
- Message storage (that's DeSo)
- Encryption (that's DeSo)
- Authentication (that's DeSo Identity)
- User profiles (that's DeSo)

**Free tier capacity:**
- 100,000 requests/day (resets midnight UTC)
- WebSocket messages use 20:1 billing ratio → ~2M incoming WS messages/day
- WebSocket hibernation: connections stay alive but DO uses zero CPU between messages
- More than enough for <1,000 users

### Push Notifications: Raw Web Push API

No third-party service needed. The Web Push protocol is an open standard.

**How it works:**
1. Generate ECDSA P-256 VAPID key pair once (stored as env vars in Cloudflare Worker)
2. Client subscribes via `PushManager.subscribe()` → gets a push endpoint URL
3. Client sends subscription to a Cloudflare Worker that stores it (in KV, free tier: 100K reads/day)
4. When a message is sent, the notification relay Worker sends a push request signed with the VAPID key
5. Browser push services (Google, Apple, Mozilla) deliver for free — no limits

**Platform support:**
- Android Chrome/Edge/Firefox: Full support
- Desktop Chrome/Edge/Firefox/Safari: Full support
- iOS 16.4+: Supported when PWA is installed to home screen (not in Safari tab)

**iOS caveats:**
- Push subscriptions can expire after 1-2 weeks of inactivity (manageable — chat users are active)
- Permission prompt must be triggered by user gesture (tap)
- Must be installed as PWA (Add to Home Screen)

**Cost: $0 forever.** No SDK, no subscriber limits, no vendor dependency.

### Frontend: Vite + React 19 (not Next.js)

Same rationale as before — a messaging app is a client-side app, not a content site. No SSR needed.

Vite gives us:
- Sub-second HMR in development
- Smallest possible production bundle
- `vite-plugin-pwa` works out of the box
- React 19's `use()`, Actions, and Suspense handle async chat patterns natively

### File Storage: DeSo Images + Cloudflare R2

**Images:** DeSo nodes handle image uploads natively via `POST /api/v0/upload-image`. Images are stored and served from `images.deso.org` CDN with automatic resizing. Max 10MB per image. Formats: GIF, JPEG, PNG, WebP. **Free, already integrated.**

**Everything else (voice notes, documents, large files):** Cloudflare R2.
- 10GB free storage
- 1M writes/month, 10M reads/month free
- Zero egress fees (unlimited bandwidth)
- S3-compatible API

At 500KB average per file, 10GB = ~20,000 files before hitting the free cap.

### Voice/Video: LiveKit (deferred)

Not MVP. Add when core messaging is solid.

Progressive path:
1. **Voice notes** — MediaRecorder API client-side, upload to R2, send URL as message (no WebRTC)
2. **1:1 voice calls** — LiveKit room with 2 participants
3. **Group calls** — same infrastructure, more participants

LiveKit free tier: 5,000 participant-minutes/month. Then $0.004/min audio.

### E2E Encryption

**1:1 DMs:** DeSo's built-in access group encryption. Already works, on-chain, censorship-resistant. Keep it.

**Group chats:** DeSo's access group encryption works for current group sizes. The upgrade path to MLS (RFC 9420) exists for when we need O(log n) member changes for large groups (1,000+ members), but this is not MVP.

### AI: Claude API (deferred)

Post-MVP features via Vercel AI SDK:
- Translation bots — real-time message translation in group chats
- Scripture lookup — inline Bible reference expansion
- Moderation — content filtering for community chats
- Summarization — catch up on missed conversations

---

## Migration from Current Stack

| Current | New | Migration |
|---------|-----|-----------|
| Create React App | Vite | CRA → Vite migration (well-documented, mostly config) |
| Material Tailwind | shadcn/ui + Tailwind v4 | Rebuild components (significant but incremental) |
| Polling (5s/20s) | Cloudflare DO notification relay + DeSo fetch | Add WebSocket layer, keep DeSo as data source |
| DeSo messages (on-chain) | DeSo messages (on-chain) | **No change.** This is the right approach. |
| DeSo encryption | DeSo encryption | **No change.** |
| No push notifications | Web Push API + VAPID | New capability via Cloudflare Worker |
| No voice/video | LiveKit (deferred) | Future capability |
| deso-protocol 2.6.4 | deso-protocol 3.x | SDK upgrade, API surface mostly same |
| Docker/Nginx | Cloudflare Pages | New deploy pipeline |

---

## Key Dependencies

```json
{
  "frontend": {
    "react": "^19.0.0",
    "vite": "^6.x",
    "tailwindcss": "^4.x",
    "@radix-ui/*": "latest",
    "framer-motion": "^12.x",
    "deso-protocol": "^3.4.x"
  },
  "cloudflare": {
    "workers": "Durable Objects (notification relay)",
    "pages": "SPA hosting",
    "r2": "File storage (voice notes, docs)",
    "kv": "Push subscription storage"
  },
  "deferred": {
    "@livekit/components-react": "Voice/video (post-MVP)",
    "@anthropic-ai/sdk": "AI features (post-MVP)",
    "mls-rs": "Large group encryption (post-MVP)"
  }
}
```

---

## Cost Estimate (MVP → 1,000 DAU)

| Service | Free Tier | Estimated Cost |
|---------|-----------|---------------|
| Cloudflare Pages | Unlimited sites | $0 |
| Cloudflare Workers + DOs | 100K req/day, WS hibernation | $0 |
| Cloudflare KV | 100K reads/day, 1K writes/day | $0 |
| Cloudflare R2 | 10GB storage, zero egress | $0 |
| DeSo blockchain | Read free, write ~fractions of a cent | ~$0 |
| DeSo image CDN | Free via node API | $0 |
| Web Push (VAPID) | Unlimited, open standard | $0 |
| LiveKit (deferred) | 5K min/month free | $0 |
| **Total** | | **$0/month** |

The first paid threshold would be Cloudflare Workers at >100K requests/day (~$5/month for the paid plan), which at the 20:1 WebSocket ratio supports roughly 2M incoming WebSocket messages/day — well beyond 1,000 DAU for a notification relay.
