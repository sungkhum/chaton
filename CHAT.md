# Chaton

Decentralized, end-to-end encrypted chat application built on the DeSo blockchain. Users authenticate via DeSo Identity (no traditional username/password), and all messages are encrypted using DeSo's access groups cryptographic primitives. There is no backend server — the app connects directly to DeSo blockchain nodes.

**Production:** https://chat.deso.com
**Testnet:** https://chat-test.deso.com

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript (Create React App) |
| Styling | Tailwind CSS 3 + Material Tailwind |
| Blockchain SDK | deso-protocol 2.6.4 |
| Crypto | @noble/hashes, DeSo Identity encryption |
| ETH/ENS | ethers.js via Infura |
| State | React Context API (no Redux) |
| Deployment | Docker (Node 18 build, Nginx 1.17 serve) |
| Code Quality | ESLint, Prettier, Husky + lint-staged |

---

## Current Features

### Messaging
- **Direct Messages (DMs)** — encrypted 1-on-1 conversations between two DeSo users
- **Group Chats** — named group conversations with multiple members, also end-to-end encrypted
- **Infinite scroll** — paginated message history (25 messages per page)
- **Auto-refresh polling** — 5s on desktop, 20s on mobile
- **Auto-linkification** — URLs in messages are automatically converted to clickable links

### Identity & Authentication
- **DeSo Identity login** — blockchain-based authentication, no passwords
- **Multi-account support** — add and switch between multiple DeSo profiles
- **Derived key authorization** — secure transaction signing without exposing the main seed phrase
- **Non-custodial** — users maintain full control of their keys

### User Discovery
- Search by **DeSo username**
- Search by **DeSo public key**
- Search by **Ethereum address**
- Search by **ENS name**
- Profile preview with avatars during search

### Group Chat Management
- Create named group chats
- Add and remove members (owner only)
- View paginated member lists
- Group avatars with member count indicators

### UI/UX
- Dark theme with blue accents
- Responsive layout (mobile, tablet, desktop)
- Conversation list sidebar with Chats/Requests tabs
- Copy public key to clipboard
- View wallet balance and link to DeSo wallet
- Toast notifications for actions and errors
- Loading spinners for async operations

---

## Project Structure

```
src/
├── components/
│   ├── form/                        # Input fields, error labels
│   ├── shared/                      # Clipboard copy, alerts
│   ├── messaging-app.tsx            # Main messaging container
│   ├── header.tsx                   # Top nav with user menu
│   ├── messaging-bubbles.tsx        # Message display + infinite scroll
│   ├── messaging-conversation-accounts.tsx  # Conversation list sidebar
│   ├── send-message-button-and-input.tsx    # Message input + send
│   ├── search-users.tsx             # User search combobox
│   ├── start-group-chat.tsx         # Group creation dialog
│   └── manage-members-dialog.tsx    # Group member management
├── contexts/
│   ├── UserContext.ts               # User state, access groups
│   └── RefreshContext.ts            # Auto-refresh lock state
├── hooks/
│   ├── useInterval.ts               # Persistent polling interval
│   ├── useMobile.ts                 # Responsive breakpoint detection
│   ├── useMembers.ts               # Group member CRUD
│   └── useKeyDown.ts               # Keyboard event handling
├── services/
│   └── conversations.service.tsx    # Message encrypt/decrypt/send logic
├── utils/
│   ├── types.ts                     # TypeScript interfaces
│   ├── constants.ts                 # App config constants
│   └── helpers.ts                   # Utility functions
├── App.tsx                          # Root — Identity subscription, user state
└── index.tsx                        # React DOM entry point
```

---

## Environment Configuration

| Variable | Dev (testnet) | Prod (mainnet) |
|----------|--------------|----------------|
| `REACT_APP_NODE_URL` | test.deso.org | node.deso.org |
| `REACT_APP_PROFILE_URL` | test.deso.org | diamondapp.com |
| `REACT_APP_IS_TESTNET` | true | false |

---

## External Integrations

- **DeSo Protocol Node** — blockchain data, transactions, message storage
- **DeSo Identity** — authentication, key derivation, message encryption/decryption
- **Infura (Ethereum)** — ENS name resolution and ETH address lookup
- **DeSo Wallet** — external link for balance management

---

## Scripts

```
npm start       # Dev server on localhost:3000
npm run build   # Production build
npm test        # Run tests
npm run lint    # ESLint check
npm run format  # Prettier formatting
```

## Docker

```bash
# Build for production
docker build --build-arg environment=production -t chaton .

# Build for testnet
docker build --build-arg environment=development -t chaton .
```

Serves on port 80 via Nginx with SPA fallback routing.
