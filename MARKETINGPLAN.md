# ChatOn Content Strategy & Marketing Plan

*Created: 2026-04-03*
*Based on: Competitor analysis, customer research, marketing ideas, SEO audit, AI SEO research*

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [SEO Audit Findings](#seo-audit-findings)
3. [Competitive Landscape](#competitive-landscape)
4. [Customer Research](#customer-research)
5. [Content Pillars](#content-pillars)
6. [Priority Topics](#priority-topics)
7. [Topic Cluster Map](#topic-cluster-map)
8. [New Site Pages](#new-site-pages)
9. [AI Search Optimization](#ai-search-optimization)
10. [External Visibility & Directories](#external-visibility--directories)
11. [Distribution Strategy](#distribution-strategy)
12. [Publishing Cadence](#publishing-cadence)
13. [Objections to Address](#objections-to-address)
14. [Brand Name Challenge](#brand-name-challenge)
15. [Appendix: Full Research](#appendix-full-research)

---

## Executive Summary

ChatOn sits at a unique intersection no competitor occupies: **decentralized + E2E encrypted + on-chain social graph + PWA + $0 infrastructure cost**. The content strategy leverages this positioning to capture search traffic, build AI citation authority, and attract privacy-conscious and crypto-native users.

### The Sequence

1. **Fix crawlability** — pre-render public pages at build time
2. **Add llms.txt + AI crawler directives** — get on AI search engines' radar
3. **Create permanent pages** (About, FAQ, Compare) — reference content for AI citation
4. **Launch the blog** starting with the $0/month infrastructure post (HN + Reddit)
5. **Build comparison pages** (vs Signal, vs Telegram) — highest-intent SEO
6. **Submit to directories** (AlternativeTo, Product Hunt, awesome-decentralized)
7. **Publish 2 posts/month** alternating searchable and shareable content

---

## SEO Audit Findings

### Critical Issue: Client-Side Rendering

The site is 100% client-rendered. Search engines and AI crawlers see an empty `<div id="root"></div>`. All headings, structured data, and per-page meta tags are invisible to crawlers.

**Fix:** Pre-render public pages at build time. This keeps the $0/month architecture (no server), works with Cloudflare Pages, and makes every page indexable. The messaging app stays client-side only.

### What Crawlers Currently See

- Title tag: "ChatOn — Messaging that no one can shut down" (good, 49 chars)
- Meta description: "End-to-end encrypted messaging on the DeSo blockchain..." (good, 168 chars)
- Complete Open Graph and Twitter Card tags
- PWA manifest
- **Missing:** canonical URL, og:url, structured data (all JS-only)
- **All routes serve the same index.html** via `/* /index.html 200` catch-all

### robots.txt — PASS

Correct. All pages allowed, sitemap referenced.

### sitemap.xml — NEEDS WORK

- 5 URLs listed (/, /community, /support, /privacy, /terms)
- Missing `lastmod` dates
- Missing `/join` route
- Should be expanded as new pages are added

### Technical SEO Fixes Needed

1. Pre-render public pages at build time
2. Add `<link rel="canonical">` to static HTML
3. Add `<meta property="og:url">` to static HTML
4. Move structured data JSON-LD into static HTML
5. Add `lastmod` to sitemap.xml
6. Add preconnect hints for `node.deso.org`
7. Generate sitemap at build time so dates stay current

### Keyword Targeting Gaps

| Keyword Cluster | Est. Monthly Volume | Currently Targeted? |
|----------------|---------------------|---------------------|
| "encrypted messaging app" | 5,000-10,000 | Partial |
| "decentralized chat app" | 1,000-5,000 | No |
| "private messaging app" | 10,000-50,000 | No |
| "censorship resistant messaging" | 500-1,000 | Mentioned, not in title |
| "alternative to Signal/Telegram/WhatsApp" | 10,000-50,000 | No |
| "web3 messaging" / "web3 chat" | 1,000-5,000 | No |
| "encrypted group chat" | 1,000-5,000 | No |
| "open source messenger" | 500-1,000 | Mentioned in badges only |

---

## Competitive Landscape

### Direct Competitors (Decentralized/Blockchain Messaging)

**Status (status.app)**
- Ethereum-based. Uses Waku protocol. Messaging + wallet + web3 browser.
- Positioning: "Make the jump to web3" — full Web3 lifestyle app.
- Blog: Technical architecture, Web2 vs Web3 communities, cypherpunk vision.
- Keywords: decentralized messenger, web3 browser, Waku protocol.

**Session (getsession.org)**
- No phone number. Onion routing via Oxen network. Anonymous Session IDs.
- Positioning: "Send Messages, Not Metadata" — metadata minimization.
- Blog: Extensive privacy education, protocol deep-dives, security responses.
- Keywords: private messenger, no phone number, metadata privacy, onion routing.
- *Closest competitor to ChatOn's positioning.*

**SimpleX Chat (simplex.chat)**
- No user identifiers at all (unique claim). Backed by Jack Dorsey.
- Positioning: "The World's Most Secure Messaging."
- Blog: Highly technical and philosophical. Security audits, privacy manifestos.
- Keywords: no user IDs messenger, most private messenger, metadata-free.

**XMTP (xmtp.org)**
- Wallet-to-wallet messaging protocol. Infrastructure layer, not consumer app.
- Positioning: "Securing the world's freedom to communicate."
- Blog: Developer-focused. Wallet messaging, Coinbase integration, grants.
- Keywords: web3 messaging protocol, wallet messaging.

**Push Protocol (push.org)**
- Notifications + chat + video for web3. Building own L1 chain.
- Positioning: "The Communication Protocol of Web3."
- Keywords: web3 notifications, wallet chat protocol.

**OpenChat (oc.app)**
- 100% on-chain on Internet Computer (ICP). DAO-governed with CHAT token.
- Positioning: "A Truly Decentralized Alternative to WhatsApp."
- Keywords: on-chain messaging, ICP chat.

**Briar (briarproject.org)**
- Works offline via Bluetooth/Wi-Fi. Routes through Tor when online.
- Positioning: "Secure messaging, anywhere" — crisis/censorship scenarios.
- Keywords: offline messaging app, Bluetooth messenger, Tor messenger.

### Privacy-First (Non-Blockchain)

**Signal** — Gold standard for encrypted messaging. Requires phone number. Centralized servers. Blog is advocacy + thought leadership (not SEO-driven).

**Telegram** — 1B+ users. NOT E2E encrypted by default. Blog is purely feature announcements. Zero SEO play.

**Threema** — Swiss-made, $5.99 one-time. No phone number. Has a prominent "Messenger Comparison" page.

**Wire** — Enterprise-focused. SSO, SCIM, federation. Targets IT decision-makers.

### Content Gaps (What No Competitor Covers)

These are completely unoccupied or underserved content opportunities:

| Gap | Nearest Competitor | ChatOn's Edge |
|-----|-------------------|---------------|
| DeSo blockchain for messaging | None | Owns category by default |
| PWA messaging (no app store) | None — all competitors are native apps | Completely unique |
| $0 infrastructure cost | None discuss this | Novel, link-worthy |
| Optimistic UI on blockchain | None discuss this | Technical thought leadership |
| On-chain social graph for messaging | XMTP (partial) | DeSo follows as contact discovery |
| Spam prevention via on-chain signals | Weak coverage everywhere | On-chain associations, no backend |
| Migration guides from WhatsApp/Telegram | Thin coverage | High search volume opportunity |
| Community directory without central index | None | On-chain group discovery |

### Market Context

Blockchain messaging apps market: ~$1.2-1.5B (2024-2026), projected $6.5-10.3B by 2033 (18-19% CAGR). 120M+ active users globally across 150+ apps.

---

## Customer Research

### Pain Points (From Reddit, HN, Forums, Publications)

**1. Privacy & Surveillance (The #1 Driver)**
- WhatsApp collects "contact lists, location and purchase history" despite E2E encryption
- Telegram default chats are NOT E2E encrypted — most users don't realize this
- After Durov's 2024 arrest, Telegram updated terms to share IP addresses/phone numbers with authorities
- Users distinguish between *content* encryption and *metadata* privacy

**2. Government Censorship & Shutdowns (Accelerating Demand)**
- Russia throttling Telegram (90M users) in Feb 2026, pushing to state surveillance app MAX
- Nepal: 48,781 Bitchat downloads in a single day during protests
- Iran labeled Bitchat a "national security threat," deployed DNS spoofing
- 200M+ downloads of decentralized messaging apps during 2025's protest wave
- *Censorship events create massive, sudden demand spikes*

**3. Platform Lock-In**
- "Users go where their friends, family, and colleagues already are"
- Users add alternatives but don't fully leave (WhatsApp + Signal pattern)
- Network effects are the biggest barrier to switching

**4. Trust Erosion**
- Signal's donation-dependent model raises sustainability concerns
- Matrix website defaced, exposing private messages and credentials
- Element/Matrix users report arrogant team culture

### What Users Want (Non-Negotiable Features)

- E2E encryption by default (not opt-in)
- No phone number required
- Cross-device sync
- Group chats that actually work
- Speed matching mainstream apps (Session is too slow)
- Data portability and self-sovereignty
- Free to use

### Top Objections About Blockchain Messaging

1. **"Permanent ledger = everyone can read my messages"** — Most common objection. Users don't understand encrypted content on-chain is unreadable.
2. **"Blockchain = expensive per message"** — Based on Ethereum gas fee mental model.
3. **"Crypto/blockchain stigma"** — Viewed as "cryptobro corner of the internet."
4. **"Hidden centralization"** — Even "decentralized" apps depend on Apple/Google push notifications.
5. **"Decentralized = slow"** — Based on Session, Briar, early Matrix experience.
6. **"Need a crypto wallet"** — Onboarding friction assumption from web3 apps.

### Language Patterns

**Aspirational (draws people in):**
- "Messaging that no one can shut down"
- "Own your data," "No single point of failure"
- "Censorship-resistant," "Self-sovereign communication"

**Pragmatic (determines if they stay):**
- "Just works," "As easy as WhatsApp"
- "Fast and reliable," "Free to use"
- "I shouldn't need to understand crypto to send a message"

**Fear-based (drives switching events):**
- "They can read your messages"
- "What happens if they shut it down"
- "They changed the privacy policy"

*Key insight: Lead with aspiration, deliver on pragmatics.*

### Competitor-Specific User Intelligence

| App | Strengths Users Cite | Weaknesses Users Cite |
|-----|---------------------|----------------------|
| Signal | Gold standard encryption, minimal data collection | Requires phone number, centralized, financially fragile |
| Session | No phone number, anonymous, onion routing | Slow delivery, broken notifications, "many issues and glitches" |
| SimpleX | Best privacy/anonymity, modern UI | Few users, difficult to start, frequent crashes |
| Matrix/Element | Self-hosting, large community | Performance issues, encryption bugs, organizational dysfunction |
| XMTP | Wallet-to-wallet, cross-chain | Limited features, centralized nodes |

### Timing Opportunity

The 2025-2026 wave of government messaging crackdowns has created the strongest demand signal for censorship-resistant messaging in years. ChatOn should be positioned to capture the next wave with content and landing pages ready *before* events happen.

### Relevant Communities

- **r/privacy** (1.9M+), **r/privacytoolsIO** (300K+), **r/degoogle** (300K+)
- **r/selfhosted** (400K+), **r/CryptoCurrency** (7M+), **r/opensource** (400K+)
- **Hacker News**, **Lobsters**, **XDA Forums**
- DeSo community on Diamond, DeSo Discord/Twitter

---

## Content Pillars

### Pillar 1: Privacy & Encryption Education
Table-stakes SEO content. High-volume informational queries. Establishes authority.

### Pillar 2: Decentralized Messaging Explained
Growing category, lower competition. ChatOn's core positioning. No competitor owns DeSo angle.

### Pillar 3: Comparisons & Alternatives
Highest-intent SEO. "Signal alternative," "[app] vs [app]" have massive volume and directly drive signups.

### Pillar 4: Building on Blockchain (Technical Deep-Dives)
Attracts developers and HN/Reddit audiences. Generates backlinks. Completely unoccupied.

### Pillar 5: Digital Freedom & Censorship Resistance
Highly shareable thought leadership. Timely with global censorship events. ChatOn's tagline owns this narrative.

---

## Priority Topics

### Tier 1 — Publish First (Highest Impact)

| # | Topic | Type | Pillar | Target Keyword | Buyer Stage | Why |
|---|-------|------|--------|---------------|-------------|-----|
| 1 | **How We Run a Messaging App for $0/Month** | Technical (shareable + searchable) | 4 | "decentralized app infrastructure" | Awareness | No competitor has this story. Viral on HN/Reddit/crypto Twitter. |
| 2 | **Best Decentralized Messaging Apps in 2026** | Listicle (searchable) | 3 | "decentralized messaging app" | Consideration | Own the category page. ~1-5K monthly searches. |
| 3 | **ChatOn vs Signal** | Comparison (searchable) | 3 | "Signal alternative no phone number" | Consideration | Massive volume (10-50K/mo). |
| 4 | **ChatOn vs Telegram** | Comparison (searchable) | 3 | "Telegram alternative encrypted" | Consideration | Telegram's lack of default E2E is well-known. |
| 5 | **What is End-to-End Encryption?** | Educational (searchable) | 1 | "end to end encryption explained" | Awareness | Foundational SEO. High volume. |

### Tier 2 — Build Authority

| # | Topic | Type | Pillar | Target Keyword |
|---|-------|------|--------|---------------|
| 6 | **Messaging Apps Without a Phone Number** | Listicle | 3 | "messaging app no phone number" |
| 7 | **ChatOn vs WhatsApp** | Comparison | 3 | "WhatsApp alternative privacy" |
| 8 | **Your Messages on a Blockchain — Why That's Safer** | Educational | 2 | "blockchain messaging" |
| 9 | **Making Blockchain Chat Feel Like iMessage** | Technical | 4 | "optimistic UI blockchain" |
| 10 | **Countries That Banned Messaging Apps** | Thought leadership | 5 | "censorship resistant messaging" |

### Tier 3 — Expand Coverage

| # | Topic | Type | Pillar | Target Keyword |
|---|-------|------|--------|---------------|
| 11 | What Happens When a Company Goes Bankrupt? | Thought leadership | 5 | "messaging app shutdown" |
| 12 | ChatOn vs Session | Comparison | 3 | "Session alternative" |
| 13 | Why Crypto Communities Need Decentralized Chat | Use-case | 2 | "web3 chat," "discord alternative web3" |
| 14 | Apple and Google Can't Remove ChatOn | Thought leadership | 5 | "PWA messaging," "app store censorship" |
| 15 | The Case for Portable Chat History | Thought leadership | 2 | "messaging data portability" |
| 16 | How On-Chain Encrypted Group Chat Works | Technical | 4 | "encrypted group chat" |
| 17 | Moving from WhatsApp to Decentralized Messaging | Migration guide | 3 | "switch from WhatsApp" |
| 18 | What is DeSo? The Social Blockchain | Educational | 2 | "what is DeSo" |
| 19 | Blocking Spam Without a Server | Technical | 4 | "decentralized spam prevention" |
| 20 | Most Secure Messaging Apps Ranked by Threat Model | Listicle | 1 | "most secure messaging app" |

### Content Scoring

| Topic | Customer Impact (40%) | Content-Market Fit (30%) | Search Potential (20%) | Resources (10%) | **Total** |
|-------|----------------------|-------------------------|----------------------|-----------------|-----------|
| $0/Month Infrastructure | 7 | 10 | 6 | 9 | **7.7** |
| Best Decentralized Messaging Apps | 8 | 9 | 8 | 7 | **8.3** |
| ChatOn vs Signal | 9 | 9 | 9 | 8 | **8.9** |
| ChatOn vs Telegram | 9 | 9 | 9 | 8 | **8.9** |
| E2E Encryption Explained | 8 | 7 | 9 | 8 | **7.9** |

Comparison pages score highest on paper, but the $0/month post should go first — it's the most shareable and generates backlinks that boost everything else.

---

## Topic Cluster Map

```
Pillar 1: Privacy & Encryption
├── What is End-to-End Encryption? (#5)
├── Most Secure Messaging Apps Ranked (#20)
├── What Metadata Reveals About You (future)
└── How to Verify Your Messages Are Encrypted (future)

Pillar 2: Decentralized Messaging
├── Your Messages on a Blockchain (#8)
├── What is DeSo? (#18)
├── Why Crypto Communities Need Decentralized Chat (#13)
├── The Case for Portable Chat History (#15)
└── On-Chain Encrypted Group Chat (#16)

Pillar 3: Comparisons & Alternatives
├── Best Decentralized Messaging Apps 2026 (#2) [HUB]
│   ├── ChatOn vs Signal (#3)
│   ├── ChatOn vs Telegram (#4)
│   ├── ChatOn vs WhatsApp (#7)
│   └── ChatOn vs Session (#12)
├── Messaging Apps Without a Phone Number (#6)
└── Moving from WhatsApp Guide (#17)

Pillar 4: Building on Blockchain (Technical)
├── $0/Month Infrastructure (#1)
├── Optimistic UI Deep-Dive (#9)
├── Blocking Spam Without a Server (#19)
└── Community Directory Without a Server (future)

Pillar 5: Digital Freedom
├── Countries That Banned Messaging Apps (#10)
├── What Happens When a Company Goes Bankrupt? (#11)
├── Apple/Google Can't Remove ChatOn (#14)
└── Messaging That No One Can Shut Down (manifesto, future)
```

---

## New Site Pages

Permanent pages critical for both traditional SEO and AI citation:

| Page | URL | Purpose |
|------|-----|---------|
| About / What is ChatOn | `/about` | Answer capsule for AI. Definition, features, how it works. |
| FAQ | `/faq` | FAQPage schema. Answers the exact questions users ask AI. |
| Compare | `/compare` | Feature comparison table vs Signal, Telegram, WhatsApp, Session. |
| How It Works | `/how-it-works` | Technical overview. E-E-A-T credibility signal. |

---

## AI Search Optimization

### Technical Steps

1. Add `/public/llms.txt` describing ChatOn and linking to key pages
2. Add `/public/llms-full.txt` with complete content in Markdown
3. Update `robots.txt` to explicitly allow GPTBot, ClaudeBot, PerplexityBot
4. Enhance structured data: add `FAQPage`, `SoftwareApplication`, `sameAs` links
5. Write "answer capsules" (20-40 word self-contained descriptions) on About/FAQ/Compare pages
6. Always disambiguate: "ChatOn (getchaton.com)" or "ChatOn decentralized messenger"

### Recommended llms.txt Content

```markdown
# ChatOn

> ChatOn is a free, decentralized, end-to-end encrypted messaging app built on the
> DeSo blockchain. Available as a progressive web app at getchaton.com. No phone
> number required. Zero infrastructure cost. Censorship-resistant message delivery.

## About
- [What is ChatOn](https://getchaton.com/about): Overview, features, and how ChatOn works
- [FAQ](https://getchaton.com/faq): Frequently asked questions about ChatOn
- [Compare](https://getchaton.com/compare): How ChatOn compares to Signal, Telegram, Session

## Community
- [Community Directory](https://getchaton.com/community): Browse and join public ChatOn groups

## Legal & Support
- [Privacy Policy](https://getchaton.com/privacy): ChatOn privacy policy
- [Terms of Service](https://getchaton.com/terms): ChatOn terms of service
- [Support](https://getchaton.com/support): Get help with ChatOn

## Source Code
- [GitHub](https://github.com/sungkhum/chaton): ChatOn open source repository
```

### Recommended robots.txt Update

```
User-agent: *
Disallow:

# AI Search Crawlers — explicitly allowed
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

Sitemap: https://getchaton.com/sitemap.xml
```

### Enhanced Structured Data

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "name": "ChatOn",
      "alternateName": "GetChatOn",
      "url": "https://getchaton.com",
      "logo": "https://getchaton.com/ChatOn-Logo-Small.png",
      "description": "ChatOn is a free, decentralized, end-to-end encrypted messaging app built on the DeSo blockchain.",
      "sameAs": [
        "https://github.com/sungkhum/chaton",
        "https://twitter.com/GetChatOn"
      ],
      "foundingDate": "2024"
    },
    {
      "@type": ["WebApplication", "SoftwareApplication"],
      "name": "ChatOn",
      "alternateName": "GetChatOn",
      "url": "https://getchaton.com",
      "applicationCategory": "CommunicationApplication",
      "applicationSubCategory": "Messaging",
      "operatingSystem": "Any",
      "browserRequirements": "Requires a modern web browser",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "description": "End-to-end encrypted messaging on the DeSo blockchain. Free, open-source, decentralized. No phone number required. Censorship-resistant.",
      "featureList": [
        "End-to-end encryption",
        "Decentralized on DeSo blockchain",
        "No phone number required",
        "Censorship-resistant messaging",
        "Group chats with admin controls",
        "GIF and media sharing",
        "Emoji reactions",
        "Push notifications",
        "Progressive Web App",
        "Open source",
        "On-chain message storage",
        "Community directory"
      ],
      "screenshot": "https://getchaton.com/chaton-featured.webp",
      "isAccessibleForFree": true
    }
  ]
}
```

### AI Citation Monitoring

Query these prompts weekly across ChatGPT, Perplexity, Claude, Google AI Overviews:

- "What is ChatOn messaging app?"
- "Best decentralized messaging apps"
- "DeSo messaging apps"
- "Messaging apps that don't require a phone number"
- "Alternatives to Signal"
- "Blockchain-based messaging apps"
- "ChatOn vs Signal"
- "Censorship-resistant messaging"

Track: (a) whether ChatOn appears, (b) whether getchaton.com is cited, (c) accuracy.

---

## External Visibility & Directories

Submit ChatOn to build "entity authority" in AI knowledge bases:

| Priority | Platform | Why |
|----------|----------|-----|
| 1 | **AlternativeTo** | 10M+ monthly visits, frequently cited by AI |
| 2 | **Product Hunt** | Ranks well, cited by Perplexity |
| 3 | **awesome-decentralized** (GitHub PR) | Developer credibility, backlinks |
| 4 | **Alchemy DApp Directory** | "Web3 Messaging Tools" category |
| 5 | **DappRadar** | DeSo dApp listing |
| 6 | **Wikidata** | Feeds into AI knowledge graphs |
| 7 | **Crunchbase** | Product/company profile |
| 8 | **SaaSHub** | Software directory |
| 9 | **BetaList** | Early-stage product visibility |
| 10 | **SourceForge** | Open-source listing |

### Wikipedia Strategy

ChatOn likely doesn't meet notability requirements yet. Path forward:
1. Get press coverage first (2-3 independent articles in CoinDesk, Decrypt, etc.)
2. Do NOT create own Wikipedia page (will be deleted)
3. Create a Wikidata entry (lower bar, feeds AI knowledge graphs)
4. Contribute to related articles (DeSo page, messaging comparison tables)

---

## Distribution Strategy

| Channel | Approach | Best Content |
|---------|----------|--------------|
| **Hacker News** | "Show HN" launch + technical posts | $0 infrastructure, optimistic UI, PWA |
| **Reddit** (r/privacy, r/degoogle, r/CryptoCurrency) | Participate genuinely 30 days first | Encryption explainers, comparisons |
| **Crypto Twitter/X** | Weekly build-in-public threads | All content, behind-the-scenes |
| **Dev.to / Hashnode** | Cross-post technical articles | Technical deep-dives |
| **Privacy YouTubers** (Techlore, Naomi Brockwell, Mental Outlaw) | Pitch for review | "$0 infrastructure" hook |
| **Crypto publications** (Decrypt, CoinDesk, The Defiant) | Pitch during censorship events | Digital freedom content |
| **Mastodon / Fediverse** | Share natively | Privacy/decentralization content |
| **DeSo ecosystem** (Diamond, Discord) | Core community | Everything |

### Reddit Strategy Detail

| Subreddit | Size | Approach |
|-----------|------|----------|
| r/privacy | 1.9M+ | Educational content. Never lead with "use ChatOn." |
| r/privacytoolsIO | 300K+ | Submit comparison guides. Be prepared for tough questions. |
| r/degoogle | 300K+ | WhatsApp/Google Messages alternative. PWA angle. |
| r/selfhosted | 400K+ | "$0 infrastructure — nothing to host." |
| r/CryptoCurrency | 7M+ | DeSo ecosystem content. Technical posts. |
| r/opensource | 400K+ | Open-source launch channel. |

---

## Publishing Cadence

- **Weeks 1-2:** Fix crawlability (prerendering), add llms.txt, create About/FAQ/Compare pages
- **Week 3:** Publish "$0/Month Infrastructure" post + submit to HN
- **Week 4:** Publish "Best Decentralized Messaging Apps 2026" hub page
- **Weeks 5-6:** Publish ChatOn vs Signal and ChatOn vs Telegram
- **Week 7:** Publish E2E encryption explainer
- **Week 8:** Publish "Messaging Apps Without a Phone Number"
- **Ongoing:** 2 posts/month, alternating searchable and shareable
- **Reactive:** Keep a "censorship event" template ready — publish immediately when relevant

---

## Objections to Address

These misconceptions come up repeatedly in customer research and should be addressed across multiple articles:

| Objection | Reality | Where to Address |
|-----------|---------|------------------|
| "Blockchain = everyone can read my messages" | Messages are E2E encrypted *before* hitting the chain. Blockchain stores ciphertext only. | About, FAQ, every comparison |
| "Decentralized = slow" | Optimistic UI makes messages appear instantly | About, "Making Blockchain Chat Feel Like iMessage" |
| "Blockchain messaging costs money" | DeSo transactions cost fractions of a cent. ChatOn is free. | FAQ, About |
| "Need a crypto wallet" | DeSo identity is simpler than a wallet. No tokens required. | FAQ, onboarding |
| "Decentralized apps look ugly" | Let screenshots speak. Include in every article. | All content |
| "No way to block spam" | On-chain follows + associations = chat requests system | FAQ, "Blocking Spam Without a Server" |

---

## Brand Name Challenge

"ChatOn" collides with:
- **chaton.ai** — AI chatbot, ~100M downloads. Dominates "ChatOn" search results.
- **Samsung ChatON** — Discontinued service, still has Wikipedia page.

### Mitigation

- Always use "ChatOn (getchaton.com)" or "ChatOn decentralized messenger" in external mentions
- Include `"alternateName": "GetChatOn"` in structured data
- On About/FAQ pages: "ChatOn (getchaton.com) is a decentralized messaging app. It is not related to chaton.ai or Samsung's discontinued ChatON service."
- Consider "ChatOn by DeSo" or "ChatOn Messenger" for disambiguation

---

## Appendix: Full Research

### Programmatic SEO Opportunities

- **`/compare/chaton-vs-[app]`** — Template-driven comparison pages for every competitor
- **`/features/[feature]`** — Individual pages for E2E encryption, group chats, media sharing, reactions
- **`/use-cases/[use-case]`** — "ChatOn for activists," "ChatOn for journalists," "ChatOn for crypto teams"

### Marketing Ideas — Content Angles Unique to ChatOn

**The $0 Infrastructure Story**
- Blog post: "How We Run a Messaging App for $0/Month"
- Infographic: Infrastructure cost comparison (Signal ~$50M/year, WhatsApp thousands of servers, ChatOn $0)
- Twitter thread: "We built a messaging app. Our server bill is $0/month. Here's how."
- Implication: Never need to monetize users. No ads. No data selling. No shutdown risk.

**No App Store Gatekeeping (PWA)**
- "Apple and Google Can't Remove ChatOn From Your Phone"
- "Why We Chose PWA Over Native Apps (And Why It Matters for Censorship Resistance)"
- "How to Install ChatOn on Your Phone Without an App Store"

**On-Chain Identity (No Phone Number)**
- "Messaging Apps That Don't Need Your Phone Number"
- "Your Phone Number Is Your Identity — And That's a Problem"
- "How to Create a Messaging Account Without Any Personal Information"

**DeSo Blockchain as Data Layer**
- "We Deleted Our Backend: How DeSo Replaced Our Database, Auth, and API"
- "You Don't Have to Trust Us With Your Messages"
- "Any Developer Can Build a ChatOn-Compatible Messaging App"

**Portable Chat History**
- "Switch Messaging Apps Without Losing Your History"
- "We're the Only Messaging App That Wants You to Be Able to Leave"

### Market Data

- Blockchain messaging apps market: ~$1.2-1.5B (2024-2026), projected $6.5-10.3B by 2033
- 120M+ active users globally across 150+ blockchain messaging apps
- 200M+ downloads of decentralized messaging apps during 2025's protest wave
- Reddit cited by 46.7% of Perplexity responses (highest-impact platform for AI visibility)

### Sources

**Customer Research:**
- Decentralized Chat Apps Explode as Global Protests Rock Nations (thecurrencyanalytics.com)
- Messaging Apps Trends 2026: What Users Expect (daylox.com)
- Russia's Censorship Crackdown Exposes the Decentralization Gap (CryptoSlate)
- Russia Is Killing Telegram to Force Users Onto State Surveillance App (stateofsurveillance.org)
- Nepal Sees 48,000 Bitchat Downloads Amid Protests (bitcoinethereumnews.com)
- Blockchain-Based Decentralized Messengers: A Privacy Pipedream? (CoinTelegraph)
- Privacy Rankings of Messaging Apps 2025 (Kaspersky)
- Most Secure Messaging Apps 2026 (ExpressVPN)
- Session Messenger Review 2026 (cyberinsider.com)
- SimpleX Chat Review 2026 (darwindynamic.com)

**AI SEO:**
- Mastering Generative Engine Optimization in 2026 (Search Engine Land)
- GEO: How to Win AI Mentions (Search Engine Land)
- 7 Tips to Get Cited by LLMs (SurferSEO)
- ChatGPT vs Perplexity vs Google AI Mode Citation Benchmarks (Averi)
- The /llms.txt Specification (llmstxt.org)

**Competitor Analysis:**
- Decentralized Chat: Complete Guide 2026 (secumeet.com)
- Best Crypto Messaging Apps 2026 (blockxs.com)
- Web3 Messaging Comparison (Medium)
- Signal Blog (signal.org/blog)
- Session Blog (getsession.org/blog)
- SimpleX Blog (simplex.chat/blog)
- Best WhatsApp Alternatives (Proton, Tuta)
- Blockchain Messaging Apps Market Report (Grand View Research)
