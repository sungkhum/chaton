# Chaton Landing Page Copy

> Landing page sections in order. Each section includes headline, body, and notes for implementation.

---

## SECTION 1: Hero

**Headline:**
Messaging that no one can shut down.

**Subheadline:**
Chaton is encrypted messaging built on the DeSo blockchain. Your messages are end-to-end encrypted. Your identity is portable. And no company — including us — can read your conversations, lock your account, or take your data.

**CTA:**
Start Messaging — it's free

**Secondary CTA:**
See how it works

**Notes:** Hero should feel clean and fast, not "crypto." Avoid jargon in the first screen. The blockchain is the *how*, not the *what*. Lead with the benefit.

---

## SECTION 2: Problem / Why This Exists

**Headline:**
Your messages shouldn't live on someone else's server.

**Body:**
Every major messaging app stores your conversations on servers controlled by a single company. That means:

- **One company decides** who gets to message whom
- **One outage** takes your conversations offline
- **One policy change** can delete your history or ban your account
- **One breach** exposes everything

Chaton is different. Your messages live on the DeSo blockchain — distributed across thousands of independent nodes. No single point of failure. No single point of control.

---

## SECTION 3: How It Works (On-Chain Explainer)

**Headline:**
Built on blockchain. Encrypted by default.

**Body:**
Chaton runs on DeSo — a blockchain designed from the ground up for social applications. Here's what that means in practice:

**Your messages are encrypted before they leave your device.**
We use end-to-end encryption (AES-128-CTR + ECDH key exchange) for every conversation — DMs and group chats. Only you and your recipients hold the keys. The encrypted message is stored on-chain, but the content is unreadable to everyone else.

**Some metadata is visible. Message content is not.**
Like any messaging system, the network knows *that* a message was sent and *between which accounts*. Think of it like a postal service: the addresses on the envelope are visible, but the letter inside is sealed. The difference? Instead of one company holding those envelopes, they're distributed across a decentralized network with no central authority.

**What's on-chain (public):**
- Sender and recipient account identifiers
- Timestamp of the message
- The fact that a message was sent

**What's encrypted (private to you):**
- The actual message content
- Media and attachments
- Group encryption keys (encrypted per-member)

**Notes:** This section is critical for trust. Be honest about metadata visibility — it builds credibility. The postal analogy makes it accessible.

---

## SECTION 4: Features

**Headline:**
Real messaging. Not a crypto experiment.

**Body:**
Chaton has everything you expect from a modern messenger, plus things no centralized app can offer.

### Messaging
- **1:1 and group chats** — encrypted end-to-end by default
- **GIFs, images, and files** — share rich media inline
- **Replies and reactions** — thread conversations naturally
- **Typing indicators and read receipts** — know when someone's there
- **Real-time delivery** — messages arrive in under a second

### Only on Chaton
- **Portable identity** — your account works across every DeSo app, not just Chaton
- **Send money in-chat** — tip or pay anyone directly inside a conversation with $DESO
- **No platform lock-in** — if Chaton disappears tomorrow, your messages and contacts survive on the blockchain
- **Token-gated groups** — create communities where membership is tied to holding a social token
- **Censorship-resistant storage** — messages distributed across thousands of nodes worldwide

---

## SECTION 5: Why DeSo (Not Just Any Blockchain)

**Headline:**
Not all blockchains are equal. Most can't do this.

**Body:**
You wouldn't build a house with tools designed for a spaceship. Most blockchains (Ethereum, Solana) are general-purpose — they process financial transactions and run smart contracts. Social data is an afterthought.

DeSo is different. It's a Layer-1 blockchain built *exclusively* for social applications:

- **Purpose-built protocol** — Messages, profiles, follows, and groups are native data types, not smart contract hacks. This makes everything faster and cheaper by orders of magnitude.
- **10,000x cheaper storage** — Storing social data on DeSo costs ~$80/GB. On Solana, it's $1.3 million/GB. On Ethereum, $393 million/GB. This is why your messages can actually live on-chain.
- **Fractions of a cent per message** — Sending a message costs roughly $0.00002. Send 50,000 messages for a penny.
- **1-second finality** — Messages confirm on-chain in about one second. No waiting for block confirmations.
- **Built-in encryption** — E2E encryption for DMs and group chats is part of the protocol, not bolted on.
- **Open social graph** — Your followers, profile, and connections are stored on-chain and portable across every DeSo app.

**The result:** A messaging app that's as fast as Telegram, as private as Signal, and owned by no one.

---

## SECTION 6: Transparency Promise

**Headline:**
We can't read your messages. Verify it yourself.

**Body:**
Chaton isn't asking you to trust us. The DeSo blockchain is open and auditable. Anyone can run a node and verify that:

1. **Messages are encrypted** — the on-chain data is ciphertext, not plaintext
2. **Only participants hold the keys** — encryption happens client-side, in your browser
3. **No backdoors exist** — the protocol is open-source

This isn't a privacy policy. It's math.

If you want to look under the hood, every transaction is visible on-chain. You can verify that message content is encrypted — and that no one, not even Chaton, can decrypt it without your private key.

---

## SECTION 7: Your Identity, Your Rules

**Headline:**
One account. Every app. No lock-in.

**Body:**
When you create a Chaton account, you're not creating a Chaton account. You're creating a DeSo identity — a cryptographic key pair that you own.

- **Sign in with Google, MetaMask, or a seed phrase** — whatever you prefer
- **Your profile, contacts, and message history are portable** — accessible from any DeSo app
- **No company controls your account** — there's no "account suspended" because there's no central authority to suspend it
- **Free to start** — verify your phone number and get free starter $DESO to begin messaging immediately

Your identity travels with you. If a better DeSo messaging app comes along, take your entire social life with you. We're betting you'll stay because Chaton is great — not because we hold your data hostage.

---

## SECTION 8: Cost Transparency

**Headline:**
Messaging costs almost nothing. Literally.

**Body:**
Every message on Chaton is a blockchain transaction. The cost? Roughly **1/50,000th of a cent**.

| Action | Approximate Cost |
|--------|-----------------|
| Send a message | $0.00002 |
| Send 1,000 messages | $0.02 |
| Send 50,000 messages | $1.00 |

New users get free starter $DESO through phone verification — enough for thousands of messages to get started. After that, $DESO can be purchased in small amounts.

Chaton itself has **no subscription fees, no premium tiers, and no ads.** The only cost is the blockchain transaction fee — and it's practically invisible.

---

## SECTION 9: Send Money In Chat

**Headline:**
Tip, pay, and fund — without leaving the conversation.

**Body:**
$DESO is the native currency of the DeSo blockchain. In Chaton, you can send it to anyone in a conversation — instantly, with no intermediary and no fees beyond the standard transaction cost.

- Tip a friend for helpful advice
- Split a bill in a group chat
- Pay a creator for exclusive content
- Fund a project or community goal

No bank. No payment processor. No 3-day hold. Just send.

---

## SECTION 10: PWA / Install

**Headline:**
Install it. Use it everywhere.

**Body:**
Chaton is a Progressive Web App. No app store required.

- **Works on any device** — phone, tablet, desktop
- **Install to your home screen** — looks and feels like a native app
- **Push notifications** — never miss a message, even when the app is closed
- **Offline-ready** — browse your conversations without a connection
- **Always up to date** — no manual updates, ever

Just open Chaton in your browser and tap "Add to Home Screen."

---

## SECTION 11: Final CTA

**Headline:**
Messaging should be yours. Start using Chaton.

**Body:**
End-to-end encrypted. Built on an open blockchain. No company in control. No ads, no tracking, no lock-in.

**CTA:**
Start Messaging — Free

**Secondary text:**
No credit card. No app store. Just open and go.

---

## SECTION 12: Footer Proof Points (compact strip)

- End-to-end encrypted
- Open-source protocol
- Zero ads, zero tracking
- Built on DeSo blockchain
- Portable identity
- $0 subscription

---

## DESIGN & TONE NOTES

**Voice:** Confident, plain-spoken, slightly rebellious. Not corporate. Not crypto-bro. Think: "We built something better and we're being straight with you about it."

**Avoid:**
- "Web3" — too buzzy, alienates normies
- "Decentralized" as a lead — it's a means, not a benefit. Lead with what it *enables*
- Overpromising on privacy — be honest about metadata visibility
- Crypto jargon in headlines — save technical details for supporting copy

**Lean into:**
- Ownership and control
- Transparency and verifiability
- The postal analogy for encryption vs. metadata
- Speed and UX parity with mainstream apps
- Honesty as a differentiator ("we can't read your messages — verify it yourself")

**Visual direction:**
- Dark theme (matches the app)
- Minimal, fast-loading (the landing page should feel as fast as the product)
- Show the actual app UI in screenshots — prove it's real, not vaporware
- Consider a live on-chain explorer embed showing encrypted message data (proves the claim visually)
