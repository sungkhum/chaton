# Chaton Landing Page Copy

## Navigation
- **Logo**: Chaton (with icon)
- **Nav links**: Features | Technology | Scale
- **CTA button**: LAUNCH APP

---

## Hero Section

**Badge**: Built on DeSo Blockchain (with pulsing green dot)

**Headline**: Messaging that no one can shut down.

**Subheadline**: Chaton is end-to-end encrypted messaging on the DeSo blockchain. Your message content is unreadable to everyone except you and your recipients. **Built to scale. Impossible to censor.**

**Primary CTA**: Start Messaging — Free
**Secondary CTA**: See how it works

### Mockup Chat Preview
- **Username**: Satoshi_N
- **Status badge**: Encrypted
- **Floating label**: ON-CHAIN VERIFIED

**Chat bubbles**:
1. "Messages stored on-chain, encrypted with your private key. Only we can read them."
2. "The blockchain knows we talked. But only we know what we said."
3. "Exactly how messaging should work."

---

## Features Section (Problems)

**Headline**: Your conversations don't belong on **someone else's server.**

**Subheadline**: Traditional messengers store your data on servers one company controls. One breach, one policy change, one outage — and your conversations are gone. Chaton stores encrypted messages across independent DeSo nodes.

### Feature Cards

1. **Content Stays Private** (red shield icon)
   Messages are encrypted in your browser before touching the blockchain. The network can see that you sent a message — but never what you said.

2. **No Single Point of Failure** (wifi-off icon, emerald)
   Messages live across thousands of independent nodes. No single outage, company, or government can take the network offline.

3. **Censorship Resistant** (ban icon, gold/yellow)
   Your account is a cryptographic key pair you control. No platform can suspend, delete, or lock you out.

4. **Full Portability** (refresh icon, purple)
   Your identity and contacts work across every DeSo app. No platform lock-in, ever.

---

## Scale Section

**Headline**: Scale that **defies gravity.**

**Subheadline**: Most blockchains weren't built for social data. DeSo was — with purpose-built indexes, 1-second finality, and storage costs low enough to put every message on-chain.

### Cost Comparison: "Cost to store 1GB of social data"

| Chain | Cost |
|-------|------|
| Ethereum | $393M |
| Solana | $1.3M |
| DeSo + Chaton | **$80** |

**DeSo label**: Native on-chain scale

---

## Technology Section

**Headline**: Math is the **new trust.**

**Subheadline**: Don't trust us. Verify it.

### Code Preview (E2E_ENCRYPTION.ts)
```
async function encryptMessage(content: string, recipientKey: string) {
  // AES-128-CTR + ECDH key exchange — runs in your browser
  const shared = deriveSharedSecret(myKey, recipientKey);
  const encrypted = aes128ctr(content, shared);

  // Only ciphertext reaches the blockchain
  await deso.sendDMMessage(encrypted);

  // Anyone can see this transaction happened.
  // No one can read what it says.
}
```

### On-chain Transparency Explainer

**Visible on-chain**:
- Sender and recipient account IDs
- Timestamp of the message
- That a message was sent
- *Like a postal service: the addresses on the envelope are visible.*

**Encrypted & private**:
- Your actual message content
- Images, files, and media
- Group encryption keys
- *The letter inside is sealed. Only sender and recipient hold the keys.*

**Paragraph**: DeSo is a public blockchain — anyone can run a node and verify that message content is stored as ciphertext, and that no one (including Chaton) can decrypt it without your private key. This is how we prove our privacy claims instead of just asking you to believe them.

---

## Final CTA Section

**Headline**: Messaging should be yours.

**CTA button**: Start Messaging — Free

### Trust Badges (bottom row)
- E2E Encrypted (shield icon, emerald)
- Open Source (code icon, violet)
- Zero Ads (ban icon, gold)
- No Lock-in (user-check icon, blue)
- Global Network (globe icon, green)

---

## Footer

- **Logo**: Chaton
- **Links**: Protocol | GitHub | Security
- **Copyright**: &copy; 2026 CHATTRA. END-TO-END ENCRYPTED MESSAGING ON DESO BLOCKCHAIN.
