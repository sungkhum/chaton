import { BlogPostLayout } from "../blog-post-layout";

const NearZeroInfrastructure = () => (
  <BlogPostLayout
    title="How We Run a Messaging App for Near-Zero Cost"
    description="Most messaging apps spend millions on servers. ChatOn uses the DeSo blockchain as its entire backend — no database, no custom API, no server bill."
    date="2026-04-03"
    readTime="6 min read"
    tags={["engineering", "architecture", "deso"]}
    slug="near-zero-infrastructure"
  >
    <p>
      Signal spent{" "}
      <a
        href="https://signal.org/blog/signal-is-expensive/"
        target="_blank"
        rel="noreferrer"
      >
        $50 million in 2023
      </a>{" "}
      keeping its servers running. WhatsApp operates thousands of servers across
      multiple data centers. Telegram has built an entire distributed
      infrastructure to handle 900 million users. Running a messaging app is
      expensive — unless you rethink what &quot;running&quot; means.
    </p>

    <p>
      ChatOn&apos;s infrastructure cost is near zero. Not &quot;we got a good
      deal on AWS.&quot; Not &quot;we&apos;re on a startup plan.&quot; Our
      monthly server bill rounds to almost nothing because we don't have servers
      in the traditional sense. The DeSo blockchain is our entire backend.
    </p>

    <p>Here is how that works, and why it matters.</p>

    <h2>The traditional messaging stack</h2>

    <p>
      A typical messaging app needs a lot of infrastructure. At minimum, you're
      looking at:
    </p>

    <ul>
      <li>
        <strong>Application servers</strong> to handle API requests and message
        routing
      </li>
      <li>
        <strong>A database</strong> (usually multiple — one for messages, one
        for user profiles, one for media metadata)
      </li>
      <li>
        <strong>A message queue</strong> for reliable delivery and push
        notifications
      </li>
      <li>
        <strong>Object storage</strong> for media files (images, videos, GIFs)
      </li>
      <li>
        <strong>An authentication system</strong> with session management, token
        rotation, and rate limiting
      </li>
      <li>
        <strong>WebSocket infrastructure</strong> for real-time delivery
      </li>
    </ul>

    <p>
      Each of these components needs to be provisioned, scaled, monitored, and
      paid for. As your user base grows, costs grow with it — often faster than
      revenue. This is why messaging apps are notoriously difficult to monetize.
      The infrastructure bill comes due every month whether you have a business
      model or not.
    </p>

    <h2>What if the database already existed?</h2>

    <p>
      DeSo is a public blockchain designed specifically for social applications.
      Unlike general-purpose blockchains like Ethereum (which are optimized for
      financial transactions), DeSo was built to store social data — posts,
      profiles, follows, and messages — cheaply and at scale.
    </p>

    <p>
      When we decided to build ChatOn, we asked a simple question:{" "}
      <strong>
        what if we used the blockchain as the database instead of building our
        own?
      </strong>
    </p>

    <p>
      The answer turned out to be: you eliminate most of your infrastructure.
    </p>

    <h2>What DeSo replaces</h2>

    <p>
      Here is what ChatOn delegates to the DeSo blockchain instead of building
      ourselves:
    </p>

    <ul>
      <li>
        <strong>Message storage:</strong> Every message is a DeSo transaction.
        The blockchain stores it, replicates it across nodes, and serves it back
        via API. We write zero database code.
      </li>
      <li>
        <strong>User authentication:</strong> DeSo Identity handles account
        creation, key management, and session handling. Users can sign up with a
        seed phrase, Google account, or MetaMask wallet. We don't store
        passwords, manage sessions, or handle password resets.
      </li>
      <li>
        <strong>Encryption:</strong> Message encryption and decryption happen
        client-side using DeSo's key infrastructure. ECDH key exchange derives a
        shared secret; AES-128-CTR encrypts the content. Only ciphertext reaches
        the chain.
      </li>
      <li>
        <strong>Social graph:</strong> Follows, blocking, contact discovery —
        all on-chain via DeSo's User Associations. ChatOn reads this data
        instead of maintaining its own social database.
      </li>
      <li>
        <strong>Group management:</strong> DeSo Access Groups handle group
        creation, membership, and per-member key distribution. Each member gets
        an individually encrypted copy of the group key.
      </li>
      <li>
        <strong>Media hosting:</strong> Images and videos are uploaded via
        DeSo's built-in media endpoints and served from their CDN.
      </li>
    </ul>

    <h2>What we actually run</h2>

    <p>
      ChatOn is not completely serverless. We run a small Cloudflare Worker that
      handles two things:
    </p>

    <ul>
      <li>
        <strong>WebSocket relay:</strong> A Durable Object that relays real-time
        &quot;new message&quot; notifications between connected clients. This
        makes messages feel instant — the sender's client pushes a notification
        via WebSocket, and the recipient's client fetches the new message from
        the blockchain. The Durable Object stores no message content. It is a
        notification pipe.
      </li>
      <li>
        <strong>Push notification backup:</strong> A cron job that polls the
        blockchain every 60 seconds for new messages and sends push
        notifications to offline users. This uses a Cloudflare D1 database (for
        push subscription records) and a Queue (for reliable delivery).
      </li>
    </ul>

    <p>
      The Cloudflare Workers free tier covers most of this. The Queue requires a
      paid plan — that&apos;s the &quot;near-zero&quot; part rather than
      literally zero. But compared to running application servers, databases,
      and message infrastructure, the cost difference is orders of magnitude.
    </p>

    <h2>The cost per message</h2>

    <p>
      Every ChatOn message is a DeSo blockchain transaction. Each transaction
      costs roughly <strong>$0.000017</strong> — less than two-thousandths of a
      penny. This fee is paid by the sender in DESO tokens.
    </p>

    <p>
      For context: a new user receives free starter DESO during signup (just a
      CAPTCHA — no phone number required), enough for thousands of messages. The
      cost is real but negligible. There is no subscription fee, no premium
      tier, and no ads.
    </p>

    <h2>What this architecture makes possible</h2>

    <p>
      Near-zero infrastructure cost isn't just a nice line item. It changes what
      kind of product you can build.
    </p>

    <ul>
      <li>
        <strong>Monetization on your terms:</strong> When your server bill is
        negligible, you don&apos;t need to sell ads, harvest data, or gate
        features behind a paywall. ChatOn earns revenue through a small platform
        fee on in-chat tips — but that funds development, not infrastructure. If
        that revenue disappeared, the app would still run.
      </li>
      <li>
        <strong>No shutdown risk from costs:</strong> Messaging apps die when
        funding runs out and the servers get turned off. ChatOn's messages live
        on the blockchain regardless of what happens to us as a company. If we
        disappeared tomorrow, the messages would still be there — any
        DeSo-compatible client could read them.
      </li>
      <li>
        <strong>One developer can build it:</strong> Without backend
        infrastructure to design, deploy, and maintain, a single developer can
        build and operate a full-featured messaging app. ChatOn is primarily
        built by one person.
      </li>
    </ul>

    <h2>The tradeoffs</h2>

    <p>This architecture isn't free of downsides. Here is what we give up:</p>

    <ul>
      <li>
        <strong>Simpler encryption model:</strong> DeSo uses ECDH + AES-128-CTR
        without forward secrecy. The Signal Protocol (used by Signal and
        WhatsApp) provides stronger cryptographic guarantees, but requires
        centralized key servers that we'd have to build and run.
      </li>
      <li>
        <strong>Blockchain confirmation time:</strong> DeSo transactions take
        1-3 seconds to confirm. We solve this with optimistic updates — messages
        appear instantly in the UI, and the blockchain confirms in the
        background. Users never feel the delay.
      </li>
      <li>
        <strong>Dependency on DeSo:</strong> Our infrastructure is simple
        because DeSo exists. ChatOn does not run a DeSo node — it uses the
        existing network through public APIs, the same way a website uses the
        internet without running backbone routers. DeSo&apos;s node
        infrastructure is self-sustaining: validators earn block rewards through{" "}
        <a href="https://revolution.deso.com" target="_blank" rel="noreferrer">
          Revolution Proof of Stake
        </a>
        , token holders stake DESO with validators for yield, and transaction
        fees are burned to create deflationary pressure. If DeSo had reliability
        issues, ChatOn would too — but the network is public and permissionless,
        anyone can run a node, and no single entity can shut it down.
      </li>
      <li>
        <strong>Transaction fees:</strong> Messages aren't technically free. The
        cost is negligible ($0.000017 per message), but users do need a small
        DESO balance.
      </li>
    </ul>

    <h2>Could this work for other apps?</h2>

    <p>
      The &quot;use a blockchain as your backend&quot; approach works well for
      social applications where the data is inherently public or encrypted, and
      where the value of decentralization outweighs the tradeoffs. Messaging,
      social media, community platforms, and identity systems are good fits.
    </p>

    <p>
      It works less well for applications that need low-latency writes, complex
      queries, or private data that shouldn't exist on any public ledger even in
      encrypted form.
    </p>

    <p>
      For ChatOn, the fit is natural. A messaging app is a frontend that reads
      and writes data. If the data layer already exists as a public utility, the
      frontend is all you need to build.
    </p>

    <hr />

    <p>
      ChatOn is open source at{" "}
      <a
        href="https://github.com/sungkhum/chaton"
        target="_blank"
        rel="noreferrer"
      >
        github.com/sungkhum/chaton
      </a>
      . If you want to see exactly how this architecture works, the code is
      there. If you want to try the product, open <a href="/">getchaton.com</a>{" "}
      in any browser — no download required.
    </p>
  </BlogPostLayout>
);

export default NearZeroInfrastructure;
