# ChatOn — Social Media Posts & Copy

Ready-to-use social posts, descriptions, and copy for promoting ChatOn.

---

## Twitter/X

### Launch Post

> I wanted to see if AI could help me build a real chat app on the DeSo blockchain. Not a demo — a fully usable one.
>
> ChatOn: encrypted DMs, group chats, GIFs, reactions, typing indicators, push notifications. All on-chain.
>
> Forked from the DeSo core team's chat protocol. Built with Claude.
>
> Cost per message: $0.000002
> Monthly server bill: $0
>
> github.com/sungkhum/chaton

### Builder Thread (1/)

> I used Claude to build a production-grade encrypted messaging app on the DeSo blockchain.
>
> No backend. No database. $0/month to run. Cross-chain with Ethereum.
>
> Here's the full story — what worked, what didn't, and what AI-assisted development actually looks like on a non-trivial project. (thread)

### (2/)

> It started with the DeSo core team's open-source chat protocol (deso-chat-protocol). Solid foundation — blockchain messaging, access groups, encryption primitives.
>
> But it needed a lot of work to become something people would actually want to use as a daily chat app.

### (3/)

> I used Claude to build out: real-time WebSocket relay via Cloudflare Durable Objects, typing indicators, push notifications, emoji reactions, GIF search, image/file sharing, chat request filtering, unread badges, and a Telegram-style mobile UX.
>
> All on-chain. All encrypted.

### (4/)

> The architecture is wild: there's no backend.
>
> The DeSo blockchain stores every message. Identity, follows, access control — all on-chain. The only server is a Cloudflare Worker that relays WebSocket pings. It stores nothing.
>
> Infrastructure cost: $0/month.

### (5/)

> What surprised me: AI didn't just help with boilerplate. It shaped architecture decisions, handled complex blockchain SDK integration, and kept the UX at a level where the app actually feels good to use.
>
> This isn't a toy demo. It's a chat app you can use right now.
>
> chaton.social

### (6/)

> It's fully open source.
>
> Fork it. Add token-gated group chats. Build paid DMs. Ship ENS avatars. The data layer is a public blockchain. The frontend is on GitHub.
>
> github.com/sungkhum/chaton

### Technical Post

> What if your chat app had no backend?
>
> ChatOn stores every message on-chain (DeSo), encrypts end-to-end, and runs on zero infrastructure. The only server is a Cloudflare Worker that relays WebSocket pings. It stores nothing.
>
> Forked from @deaborhq's chat protocol. Built with Claude + React 19 + TypeScript.
>
> github.com/sungkhum/chaton

### Cross-Chain Feature

> You can message someone using their ETH address, ENS name, or DeSo username. Same app. Same encrypted thread.
>
> ChatOn bridges DeSo and Ethereum for censorship-resistant messaging.
>
> chaton.social

### Rich Media

> On-chain messaging doesn't have to feel like 2015.
>
> ChatOn supports GIFs, image sharing, file attachments, emoji reactions, replies, typing indicators, and push notifications. All encrypted. All on-chain.
>
> chaton.social

### Censorship-Resistance (Loss Aversion Frame)

> What happens to your messages when a platform gets acquired? Gets banned in your country? Decides to pivot?
>
> On ChatOn, nothing. They're on-chain.
>
> chaton.social

### Short / Punchy

> Your messages belong on a blockchain, not someone else's server.
>
> chaton.social | github.com/sungkhum/chaton

### Open Source Invite

> ChatOn is fully open source. Fork it. Add ENS avatars. Build token-gated group chats. Create paid DMs.
>
> The entire data layer is a public blockchain. The entire frontend is on GitHub.
>
> github.com/sungkhum/chaton

### AI Angle (Surprise Reveal)

> Encrypted messaging on DeSo with group chats, cross-chain Ethereum support, GIFs, reactions, and push notifications.
>
> Built with Claude. Seriously.
>
> github.com/sungkhum/chaton

---

## LinkedIn

### Builder Story

> I had a question: could AI help me build a real, production-grade messaging app on the DeSo blockchain?
>
> Not a prototype. Not a weekend hack. A fully usable chat app with encrypted DMs, group chats, GIF sharing, emoji reactions, typing indicators, and push notifications.
>
> I started with the DeSo core team's open-source chat protocol — a solid foundation for blockchain messaging with access groups and encryption primitives. Then I used Claude to extend it into something people would actually want to use every day.
>
> The result is ChatOn.
>
> Every message is end-to-end encrypted and stored on-chain. There's no backend. No database. The monthly infrastructure cost is $0. Users sign in with DeSo or Ethereum wallets and message anyone across both chains.
>
> AI didn't just help with boilerplate — it shaped architecture decisions, handled complex blockchain SDK integration, and kept the UX at a level where the app feels like a native experience.
>
> It's fully open source: github.com/sungkhum/chaton
>
> If you're curious about what AI-assisted development looks like on a non-trivial project — or interested in decentralized infrastructure and the DeSo protocol — take a look.
>
> #opensource #web3 #deso #ai #claudeai

### Technical Architecture Post

> Most chat apps need: a database, a message queue, a WebSocket server, auth infrastructure, and storage for media.
>
> ChatOn needs: a React frontend and a Cloudflare Worker.
>
> That's it.
>
> The DeSo blockchain handles message storage, encryption, identity, access control, and cross-chain addressing. The Worker just relays real-time pings — it stores zero state.
>
> The result is a messaging app that costs $0/month to run, can't be censored, and is fully open source. Forked from the DeSo core team's chat protocol and extended with AI-assisted development.
>
> Sometimes the best architecture decision is using someone else's infrastructure as your database.
>
> github.com/sungkhum/chaton

### AI + Open Source Post

> I used Claude to turn the DeSo core team's open-source chat protocol into a full messaging app.
>
> What I learned about AI-assisted development:
>
> 1. It's not "AI writes the code." It's a conversation. Architecture decisions, trade-off analysis, and implementation happen together.
>
> 2. The DeSo blockchain SDK has real complexity — access groups, encryption, cross-chain identity. AI handled that integration better than I expected.
>
> 3. The UX gap between "technically works" and "feels good to use" is where AI helped most. Optimistic UI, real-time indicators, mobile-first design — things that make a chat app feel like a chat app.
>
> The whole thing is open source. Fork it, extend it, build on it.
>
> github.com/sungkhum/chaton

---

## Short Descriptions

**One-liner:**
> Encrypted messaging on the DeSo blockchain — cross-chain, open source, AI-built, zero infrastructure.

**Tagline:**
> Encrypted messaging that no one can shut down.

**Product Hunt (short):**
> End-to-end encrypted DMs and group chats stored entirely on-chain. Sign in with DeSo or Ethereum. GIFs, reactions, image sharing, typing indicators, push notifications. Forked from the DeSo core team's chat protocol and built with Claude. $0/month to run. Fully open source.

**Bio / Directory:**
> ChatOn is a decentralized messaging app forked from the DeSo core team's chat protocol and extended with AI-assisted development (Claude). Messages are end-to-end encrypted and stored on-chain at ~$0.000002 each. Cross-chain messaging between DeSo and Ethereum users, group chats, GIFs, reactions, and push notifications. No backend, no database, fully open source.

**GitHub Description:**
> Open-source encrypted messaging on DeSo. Cross-chain DMs and group chats with E2E encryption, GIFs, reactions, typing indicators, and push notifications. Forked from deso-chat-protocol.

---

## Framing Notes

These posts are built on four psychological principles:

1. **Authority + Reciprocity** — "Forked from the DeSo core team's chat protocol" borrows credibility from the source, then immediately shows what was added on top.

2. **Availability Heuristic** — Most "AI-built" examples are demos and screenshots. A real, usable product is surprising and concrete — that's what makes it shareable.

3. **Loss Aversion** — "Messaging that no one can shut down" frames censorship-resistance as protection against loss, not a political stance. Appeals beyond crypto audiences.

4. **Unity + IKEA Effect** — "Fork it. Build token-gated group chats. Create paid DMs." invites contribution with specific, achievable ideas. Turns readers into potential builders.
