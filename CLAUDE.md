# Chattra

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

## ExtraData conventions

All rich message metadata uses namespaced keys in DeSo's `ExtraData` field:

- `chattra:type` — message type: `text`, `image`, `gif`, `voice-note`, `video`, `file`, `reaction`
- `chattra:replyTo` — `TimestampNanosString` of the message being replied to or reacted to
- `chattra:emoji` — emoji character for reactions
- `chattra:action` — `"add"` or `"remove"` for reaction toggling
- `chattra:imageUrl`, `chattra:gifUrl`, `chattra:videoUrl` — media URLs
- `chattra:duration`, `chattra:mediaWidth`, `chattra:mediaHeight` — media dimensions
- `chattra:fileName`, `chattra:fileSize`, `chattra:fileType` — file attachments
- `chattra:replyPreview` — truncated preview text of the replied-to message
- `chattra:gifTitle` — title of a GIF from Giphy

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Zustand (global store for auth/access groups only, conversations in component state)
- deso-protocol SDK for all blockchain interaction
- Sonner for toasts
- Cloudflare Workers + Durable Objects for WebSocket relay
