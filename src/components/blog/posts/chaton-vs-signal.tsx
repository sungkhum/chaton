import { BlogPostLayout } from "../blog-post-layout";

const ChatonVsSignal = () => (
  <BlogPostLayout
    title="ChatOn vs Signal: An Honest Comparison"
    description="Signal has the strongest encryption available. ChatOn requires no phone number and no central servers. An honest comparison of where each wins and loses."
    date="2026-04-07"
    readTime="10 min read"
    tags={["privacy", "comparison", "signal"]}
    slug="chaton-vs-signal"
  >
    <p>
      <a href="https://signal.org" target="_blank" rel="noreferrer">
        Signal
      </a>{" "}
      is the most trusted name in encrypted messaging. The Signal Protocol is
      the gold standard — adopted by WhatsApp, Google Messages, and Facebook
      Messenger for their encrypted modes. If you want the best-audited
      encryption available and don&apos;t mind giving up your phone number,
      Signal is an excellent choice.
    </p>

    <p>So why would anyone look for an alternative?</p>

    <p>
      The most common answer: Signal requires a phone number to sign up. Even
      after adding{" "}
      <a
        href="https://signal.org/blog/phone-number-privacy-usernames/"
        target="_blank"
        rel="noreferrer"
      >
        usernames in February 2024
      </a>
      , a phone number is still mandatory for registration. For people in
      countries where SIM cards are tied to national IDs, or for anyone who
      wants pseudonymous messaging, that is a dealbreaker.
    </p>

    <p>
      But phone numbers are just the surface. The deeper question is
      architectural: should your messaging infrastructure depend on a single
      nonprofit organization, or should it run on a decentralized network that
      no one entity controls?
    </p>

    <p>
      <a href="/">ChatOn</a> and Signal give different answers. This post
      compares them honestly — including where Signal is the better choice.
    </p>

    <hr />

    <h2>At a glance</h2>

    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Signal</th>
            <th>ChatOn</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Encryption</strong>
            </td>
            <td>Signal Protocol (X3DH + Double Ratchet)</td>
            <td>ECDH + AES-128-CTR</td>
          </tr>
          <tr>
            <td>
              <strong>Forward secrecy</strong>
            </td>
            <td className="cell-yes">&#10003; Yes</td>
            <td className="cell-no">&#10005; No</td>
          </tr>
          <tr>
            <td>
              <strong>Post-quantum</strong>
            </td>
            <td className="cell-yes">&#10003; PQXDH (ML-KEM)</td>
            <td className="cell-no">&#10005; No</td>
          </tr>
          <tr>
            <td>
              <strong>Phone number required</strong>
            </td>
            <td className="cell-no">&#10005; Yes, required</td>
            <td className="cell-yes">&#10003; No</td>
          </tr>
          <tr>
            <td>
              <strong>Infrastructure</strong>
            </td>
            <td>Centralized (Signal Foundation)</td>
            <td>Decentralized (DeSo blockchain)</td>
          </tr>
          <tr>
            <td>
              <strong>Operating cost</strong>
            </td>
            <td>~$40–50M/year (donations)</td>
            <td>Near-zero</td>
          </tr>
          <tr>
            <td>
              <strong>Data portability</strong>
            </td>
            <td className="cell-no">&#10005; Locked to Signal</td>
            <td className="cell-yes">&#10003; On-chain, app-independent</td>
          </tr>
          <tr>
            <td>
              <strong>Voice/video calls</strong>
            </td>
            <td className="cell-yes">&#10003; Yes</td>
            <td className="cell-no">&#10005; No</td>
          </tr>
          <tr>
            <td>
              <strong>Platforms</strong>
            </td>
            <td>Android, iOS, Windows, macOS, Linux</td>
            <td>PWA (any browser, any device)</td>
          </tr>
          <tr>
            <td>
              <strong>License</strong>
            </td>
            <td>AGPL-3.0</td>
            <td>AGPL-3.0</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2>The fundamental difference</h2>

    <p>
      Signal is a centralized service. All messages route through servers
      operated by the Signal Foundation — a nonprofit based in Mountain View,
      California. The Foundation designs the protocol, maintains the
      infrastructure, and decides what features to build. This tight control is
      why Signal&apos;s encryption is so good: one team, one protocol, one set
      of servers they fully manage.
    </p>

    <p>
      ChatOn has no servers for message storage. It uses the{" "}
      <a href="https://deso.com" target="_blank" rel="noreferrer">
        DeSo blockchain
      </a>{" "}
      as its entire backend — messages, user identity, social graph, and group
      management all live on-chain. ChatOn doesn&apos;t control where your
      messages are stored, can&apos;t unilaterally shut down access to them, and
      can&apos;t be compelled to hand them over — because it doesn&apos;t have
      them.
    </p>

    <p>
      Neither approach is universally better. The right choice depends on your
      threat model — what you are trying to protect against, and who you are
      trying to protect it from.
    </p>

    <h2>Encryption: Signal is stronger</h2>

    <p>
      Signal uses the{" "}
      <a
        href="https://signal.org/docs/specifications/doubleratchet/"
        target="_blank"
        rel="noreferrer"
      >
        Signal Protocol
      </a>{" "}
      — X3DH for initial key agreement and the Double Ratchet algorithm for
      ongoing message encryption. Every message uses ephemeral keys that are
      deleted after use. If someone compromises your private key tomorrow, they
      cannot decrypt messages you sent today. This is called{" "}
      <strong>forward secrecy</strong>, and it is the most important
      cryptographic property that ChatOn lacks.
    </p>

    <p>
      In September 2023, Signal added{" "}
      <a href="https://signal.org/blog/pqxdh/" target="_blank" rel="noreferrer">
        PQXDH
      </a>
      , a post-quantum upgrade to their key exchange using CRYSTALS-Kyber
      (ML-KEM). This protects against the future possibility of quantum
      computers breaking today&apos;s key agreements — making Signal one of the
      first major messengers to ship post-quantum protections in production.
    </p>

    <p>
      ChatOn uses ECDH key exchange with AES-128-CTR encryption. Messages are
      encrypted on your device before reaching the blockchain — only ciphertext
      is stored on-chain. But the shared secret between two users is derived
      from their long-term keys and <strong>does not change per message</strong>
      . There is no forward secrecy and no post-quantum protection.
    </p>

    <p>
      What this means in practice: if your DeSo seed phrase is compromised at
      any point — now or years from now — an attacker could download your
      encrypted messages from the public blockchain and decrypt your entire
      history. They would not need access to your device. With Signal, even if
      your keys are compromised, past messages remain protected because those
      ephemeral keys no longer exist.
    </p>

    <p>
      We do not minimize this. For threat models where key compromise is a
      serious risk — journalists communicating with sources, activists under
      state surveillance — Signal&apos;s encryption provides meaningfully
      stronger guarantees.
    </p>

    <h2>Identity: no phone number required</h2>

    <p>
      Signal requires a phone number to create an account. The username feature
      launched in 2024 lets you hide your number from contacts and share a
      username-based link instead. But registration still requires a phone
      number. You cannot create a Signal account without one.
    </p>

    <p>
      This matters more than convenience. In many countries, SIM cards are
      registered to government-issued IDs. Providing a phone number means tying
      your messaging account to your legal identity. Even in countries without
      SIM registration, a phone number is personally identifiable information
      that can be linked to you through carrier records, data brokers, or
      previous breaches.
    </p>

    <p>
      ChatOn requires no phone number, email address, or personal information.
      You create a DeSo account with a seed phrase, a Google account, or a
      MetaMask wallet. A CAPTCHA during signup provides free starter DESO tokens
      — enough for thousands of messages. Your identity on the network is a
      cryptographic public key, not a phone number.
    </p>

    <h2>Metadata: Signal reveals less</h2>

    <p>
      Encryption protects what you say. Metadata reveals who you talk to, when,
      and how often. This is where Signal and ChatOn diverge most sharply.
    </p>

    <p>
      Signal has invested heavily in minimizing metadata. &quot;Sealed
      sender&quot; hides the sender&apos;s identity from Signal&apos;s own
      servers for most messages. Private Contact Discovery uses cryptographic
      enclaves so Signal never sees your contact list. When subpoenaed, Signal
      has{" "}
      <a href="https://signal.org/bigbrother/" target="_blank" rel="noreferrer">
        repeatedly stated
      </a>{" "}
      it can only provide two data points: account creation date and last
      connection date.
    </p>

    <p>
      ChatOn messages live on a public blockchain. The message content is
      encrypted, but the transaction metadata is not. An observer running a DeSo
      node can see sender and recipient public keys, nanosecond-precision
      timestamps, and approximate message size from ciphertext length. ChatOn
      encrypts media URLs and sensitive ExtraData at the app level, but the
      communication graph — who talks to whom and when — is visible on-chain.
    </p>

    <p>
      This is a genuine tradeoff inherent to blockchain architecture.
      Immutability and transparency are the properties that make
      decentralization work, but they come at the cost of metadata exposure. For
      users whose primary concern is hiding communication patterns —
      whistleblowers, sources working with journalists — Signal provides
      significantly better metadata protection.
    </p>

    <h2>Censorship resistance</h2>

    <p>
      Signal depends on the Signal Foundation to operate. Governments have
      blocked Signal in China, Iran, Russia, and several other countries. Signal
      has responded with circumvention tools — built-in proxy support, TLS
      proxies that anyone can run, and censorship detection that automatically
      routes around blocks. These tools work well in many cases.
    </p>

    <p>
      But the architectural vulnerability remains. Signal is a single
      organization that can be pressured, sanctioned, or shut down. If the
      Signal Foundation ceased operations — from financial failure, legal
      action, or government pressure — the service would stop. Your message
      history, stored on Signal&apos;s servers, would become inaccessible.
    </p>

    <p>
      ChatOn runs on a permissionless blockchain network. When DeSo&apos;s own
      founder was{" "}
      <a
        href="https://www.justice.gov/usao-sdny/pr/founder-bitclout-digital-asset-charged-fraud-connection-sale-bitclout-tokens"
        target="_blank"
        rel="noreferrer"
      >
        arrested on fraud charges
      </a>{" "}
      in July 2024, the blockchain continued running without interruption —
      every node, every message, unaffected. (The charges were{" "}
      <a
        href="https://www.coindesk.com/policy/2026/03/16/sec-drops-case-against-bitclout-s-nader-al-naji"
        target="_blank"
        rel="noreferrer"
      >
        later dropped
      </a>
      .) Individual DeSo nodes can choose what content to display, but the data
      layer — the blockchain itself — replicates across all validators and
      cannot be censored by any single party.
    </p>

    <p>
      The honest caveat: DeSo&apos;s validator network is still growing, and the
      DeSo Foundation has significant influence over protocol development. The
      ecosystem is younger and less battle-tested than Signal&apos;s decade-plus
      track record. But the architectural guarantee is real: there is no single
      server to block, no single company to shut down, and no single person
      whose arrest can stop the network.
    </p>

    <h2>Sustainability: who pays for the infrastructure?</h2>

    <p>
      Every messaging app needs infrastructure — servers to store messages,
      bandwidth to deliver them, compute to handle encryption. Someone has to
      pay for it. The question is who, and whether that funding model can
      survive long-term.
    </p>

    <p>
      Signal published a{" "}
      <a
        href="https://signal.org/blog/signal-is-expensive/"
        target="_blank"
        rel="noreferrer"
      >
        detailed cost breakdown
      </a>{" "}
      in late 2023, projecting roughly $50 million per year by 2025.
      Infrastructure alone — servers, storage, SMS verification, bandwidth for
      voice and video calls — accounts for about $14 million. The rest goes to a
      team of roughly 50 people, legal costs, and operations. Revenue: zero. No
      ads, no subscriptions, no data sales. The entire operation depends on
      donations and the initial funding from WhatsApp co-founder Brian Acton.
    </p>

    <p>
      Signal president Meredith Whittaker has been transparent about this
      tension. Sustainability through donations alone, at the scale Signal
      operates, is an unsolved problem. Signal has introduced more prominent
      in-app donation prompts, but structural dependence on philanthropy is a
      real vulnerability for a service hundreds of millions of people rely on.
    </p>

    <p>
      ChatOn&apos;s model is fundamentally different — it doesn&apos;t pay for
      infrastructure because it doesn&apos;t run any. ChatOn does not operate a
      DeSo node. It builds on top of the existing DeSo network the same way a
      website builds on the internet: the backbone is maintained and funded by
      others, and anyone can build on it.
    </p>

    <p>
      DeSo&apos;s blockchain infrastructure is self-sustaining through its own
      economics. Validators — the nodes that store data and process transactions
      — earn block rewards through DeSo&apos;s{" "}
      <a href="https://revolution.deso.com" target="_blank" rel="noreferrer">
        Revolution Proof of Stake
      </a>{" "}
      consensus. DESO holders stake tokens with validators to secure the network
      and earn yield. Transaction fees from every on-chain action are burned,
      creating deflationary pressure that benefits all token holders. This
      creates an economic flywheel: validators are incentivized to run nodes,
      stakers are incentivized to fund them, and apps like ChatOn use the
      resulting infrastructure for free through public APIs.
    </p>

    <p>
      ChatOn&apos;s only direct cost is a small Cloudflare Worker that provides
      the WebSocket relay for real-time push notifications — a{" "}
      <a href="/blog/near-zero-infrastructure">near-zero expense</a>. Message
      storage, user identity, group management, and the social graph all live on
      the DeSo blockchain, maintained by its validator network. Users pay the
      tiny per-message transaction fee (~$0.000017) directly to the blockchain.
      ChatOn itself doesn&apos;t touch it.
    </p>

    <p>
      The result: ChatOn doesn&apos;t need ads, data harvesting, or premium
      tiers to keep the lights on. The app does generate revenue — a 10%
      platform fee on in-chat tips of $0.10 or more — but that funds ongoing
      development, not infrastructure. If nobody tipped, the app would still
      run. That is a fundamentally different position from needing $50 million
      in annual donations to keep servers online.
    </p>

    <h2>Features</h2>

    <p>
      Signal has features ChatOn does not: voice and video calls (individual and
      group), disappearing messages with configurable timers, stories, a
      standalone desktop app, and &quot;Note to Self.&quot; Signal also has a
      significantly larger user base — the people you want to talk to are more
      likely to be on Signal already.
    </p>

    <p>
      ChatOn has features Signal does not: in-chat tipping with DESO and USDC, a{" "}
      <a href="/community">public community directory</a> for discovering group
      chats, GIFs and stickers via Klipy, invite links for groups, and on-chain
      data portability — your messages belong to you and are accessible from any
      DeSo-compatible app.
    </p>

    <p>
      Both support encrypted DMs and group chats, emoji reactions, media sharing
      (images, video, files), reply threads, and push notifications. Both are
      open source under AGPL-3.0.
    </p>

    <p>
      One structural difference: Signal requires installing native apps — a
      mobile app for registration, plus desktop apps for Windows, macOS, and
      Linux. There is no web client. ChatOn is a progressive web app — open{" "}
      <a href="/">getchaton.com</a> in any browser and start messaging. No
      download, no app store approval, no gatekeeper that can remove it. You can
      install it to your home screen for a native app experience with push
      notifications and full-screen mode.
    </p>

    <h2>Who should use Signal</h2>

    <ul>
      <li>
        You need the strongest available encryption with forward secrecy and
        post-quantum protection
      </li>
      <li>
        Metadata privacy is your primary concern — you need to hide who you
        communicate with, not just what you say
      </li>
      <li>You need voice and video calls</li>
      <li>You don&apos;t mind providing a phone number</li>
      <li>
        Network effects matter — the people you want to message are already on
        Signal
      </li>
    </ul>

    <h2>Who should use ChatOn</h2>

    <ul>
      <li>
        You don&apos;t want to provide a phone number or any personal
        information to create an account
      </li>
      <li>
        Censorship resistance matters — you need messaging that no single
        company can shut down
      </li>
      <li>
        Data portability matters — you want your chat history to survive if the
        app disappears
      </li>
      <li>
        Sustainability matters — you want an app that doesn&apos;t depend on
        donations to keep running
      </li>
      <li>
        You are in the DeSo ecosystem and want messaging that uses your existing
        on-chain identity
      </li>
    </ul>

    <hr />

    <h2>The honest summary</h2>

    <p>
      Signal has better encryption. That is not a close call — the Signal
      Protocol with forward secrecy and post-quantum protection is in a
      different league from ECDH + AES-128-CTR. Signal also minimizes metadata
      far more effectively than any blockchain-based messenger can.
    </p>

    <p>
      ChatOn has a fundamentally different architecture — one where no phone
      number is needed, no company controls your messages, and the service can
      run indefinitely at near-zero cost. Your messages persist on-chain
      regardless of what happens to any single app, company, or government.
    </p>

    <p>
      These are different answers to the same question: how should private
      messaging work? Signal answers with the best possible encryption on
      centralized infrastructure. ChatOn answers with decentralized
      infrastructure that no one controls. Both are legitimate approaches. The
      right choice depends on what you are protecting against.
    </p>

    <p>
      If your threat model is &quot;a sophisticated adversary who might
      compromise my keys,&quot; use Signal. If your threat model is &quot;a
      company or government that might shut down my messaging service or demand
      my phone number,&quot; use ChatOn. If both concerns apply, consider using
      both.
    </p>

    <hr />

    <p>
      Want to try ChatOn? Open <a href="/">getchaton.com</a> in any browser — no
      download, no phone number, no app store. The{" "}
      <a
        href="https://github.com/sungkhum/chaton"
        target="_blank"
        rel="noreferrer"
      >
        source code is on GitHub
      </a>{" "}
      if you want to verify any of this yourself.
    </p>
  </BlogPostLayout>
);

export default ChatonVsSignal;
