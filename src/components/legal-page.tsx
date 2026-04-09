import { FC } from "react";
import { usePageMeta } from "../hooks/usePageMeta";

const LAST_UPDATED = "April 8, 2026";

const PrivacyContent: FC = () => (
  <>
    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
      Privacy Policy
    </h1>
    <p className="text-gray-500 text-sm mb-12">Last updated: {LAST_UPDATED}</p>

    <Section title="What ChatOn Is">
      <p>
        ChatOn is a messaging app built on the{" "}
        <a
          href="https://deso.com"
          target="_blank"
          rel="noreferrer"
          className="text-[#34F080] hover:underline"
        >
          DeSo blockchain
        </a>
        . All message data lives on the DeSo blockchain, encrypted end-to-end.
        ChatOn is a client that reads and writes to that blockchain on your
        behalf.
      </p>
      <p className="mt-3">
        We also operate a Cloudflare Worker with a small database to support
        push notifications, real-time delivery, read receipts, and online
        status. This infrastructure stores no message content — only the
        operational data described below.
      </p>
    </Section>

    <Section title="Data We Do Not Collect">
      <p>
        ChatOn does not use analytics SDKs, tracking pixels, or advertising
        tools. We do not install client-side tracking scripts in the app. We do
        not collect:
      </p>
      <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
        <li>Usage analytics or behavioral profiles</li>
        <li>Device fingerprints</li>
        <li>Advertising identifiers</li>
        <li>Cookies (we set none)</li>
      </ul>
      <p className="mt-3 text-gray-500 text-xs">
        Cloudflare, our hosting provider, processes IP addresses as part of
        serving web requests and provides us with aggregate traffic statistics
        (page views, visitor counts). We do not have access to individual IP
        logs.
      </p>
    </Section>

    <Section title="Data on the DeSo Blockchain">
      <p>
        When you send a message, ChatOn encrypts it end-to-end using your DeSo
        keys and submits the encrypted payload as a transaction on the DeSo
        blockchain. This data is governed by the DeSo protocol, not by ChatOn.
      </p>
      <p className="mt-3">Blockchain data includes:</p>
      <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
        <li>Your DeSo public key (your identity on the network)</li>
        <li>Encrypted message content (unreadable without your private key)</li>
        <li>Message timestamps</li>
        <li>Access group memberships (for group chats)</li>
        <li>User associations (chat approvals and blocks)</li>
      </ul>
      <p className="mt-3">
        ChatOn does not access the plaintext of your messages. Blockchain data
        is permanent and public by design, though message content is encrypted
        and only readable by conversation participants. The DeSo protocol does
        support update transactions, but ChatOn does not provide a mechanism to
        edit or delete sent messages.
      </p>
    </Section>

    <Section title="Data We Store on Our Server">
      <p>
        Our Cloudflare Worker and its D1 database store the following
        operational data, linked to your DeSo public key:
      </p>
      <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">
            Push notification subscriptions
          </strong>{" "}
          — your browser push endpoint URL and encryption keys (if you opt in)
        </li>
        <li>
          <strong className="text-gray-300">Online status</strong> — whether you
          are currently connected and when you were last seen
        </li>
        <li>
          <strong className="text-gray-300">Read cursors</strong> —
          per-conversation timestamps so unread counts stay in sync across
          devices
        </li>
        <li>
          <strong className="text-gray-300">Thread state</strong> — which
          conversations have new messages, used to trigger push notifications
        </li>
        <li>
          <strong className="text-gray-300">Feedback and bug reports</strong> —
          if you submit feedback or a bug report, we store what you wrote along
          with your browser type, platform, app version, and current page for
          debugging purposes
        </li>
      </ul>
      <p className="mt-3">
        None of this includes message content, conversation history, or your
        contact list.
      </p>
    </Section>

    <Section title="Data Stored on Your Device">
      <p>
        ChatOn uses your browser&rsquo;s local storage and IndexedDB to keep the
        app fast. This data never leaves your device and can be cleared through
        your browser settings. It includes:
      </p>
      <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
        <li>Cached profile information and authentication state</li>
        <li>Draft messages you have not yet sent</li>
        <li>Conversation history cache and unread timestamps</li>
        <li>Contact classification (approved, blocked, archived, muted)</li>
        <li>
          Preferences (language, tip currency, privacy mode, translation
          settings)
        </li>
        <li>Avatar image cache and onboarding progress</li>
        <li>Pending unsent messages (stored temporarily until delivered)</li>
      </ul>
      <p className="mt-3 text-gray-500 text-xs">
        Pending and draft messages are stored as plaintext on your device. They
        are encrypted before being sent to the blockchain.
      </p>
    </Section>

    <Section title="Authentication">
      <p>
        ChatOn uses{" "}
        <a
          href="https://identity.deso.org"
          target="_blank"
          rel="noreferrer"
          className="text-[#34F080] hover:underline"
        >
          DeSo Identity
        </a>{" "}
        for authentication. We never see, store, or handle your private keys or
        seed phrase. Authentication is managed entirely by the DeSo Identity
        service.
      </p>
    </Section>

    <Section title="Push Notifications">
      <p>
        If you enable push notifications, your browser generates a push
        subscription endpoint (a URL and encryption keys). This subscription is
        stored on our Cloudflare Worker so we can deliver notifications when new
        messages arrive.
      </p>
      <p className="mt-3">
        You can revoke push notification access at any time through your browser
        settings. Inactive subscriptions are automatically removed after 30
        days. We do not use push subscriptions for any purpose other than
        delivering message notifications.
      </p>
    </Section>

    <Section title="Message Translation">
      <p className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200/80">
        When you translate a message, the decrypted message text is sent to
        MyMemory (a third-party translation API operated by Translated S.r.l.)
        for processing. This means translated messages leave the end-to-end
        encrypted channel. Only messages you choose to translate are affected —
        untranslated messages remain fully encrypted.
      </p>
      <p className="mt-3">
        Translation is always initiated by you — ChatOn never sends message text
        to MyMemory automatically. Translations are cached in memory so the same
        message is only sent once per session.
      </p>
    </Section>

    <Section title="Third-Party Services">
      <p className="mb-3">
        ChatOn connects to the following external services:
      </p>
      <ul className="list-disc list-inside space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">DeSo Blockchain</strong> — stores
          all message data, profiles, and social graph
        </li>
        <li>
          <strong className="text-gray-300">DeSo Identity</strong> — handles
          authentication and key management
        </li>
        <li>
          <strong className="text-gray-300">Cloudflare</strong> — hosts our
          Worker, database, and static assets; provides aggregate traffic
          analytics and serves video/audio via Cloudflare Stream
        </li>
        <li>
          <strong className="text-gray-300">KLIPY</strong> — provides GIF and
          sticker search when you use the content picker (subject to{" "}
          <a
            href="https://klipy.com/support/api-terms"
            target="_blank"
            rel="noreferrer"
            className="text-[#34F080] hover:underline"
          >
            KLIPY&rsquo;s API terms
          </a>
          )
        </li>
        <li>
          <strong className="text-gray-300">
            MyMemory / Translated S.r.l.
          </strong>{" "}
          — provides message translation when you request it (see Message
          Translation above)
        </li>
        <li>
          <strong className="text-gray-300">HeroSwap</strong> — embedded widget
          for purchasing cryptocurrency when adding funds for tipping (subject
          to{" "}
          <a
            href="https://heroswap.com"
            target="_blank"
            rel="noreferrer"
            className="text-[#34F080] hover:underline"
          >
            HeroSwap&rsquo;s terms
          </a>
          )
        </li>
        <li>
          <strong className="text-gray-300">
            Google Fonts &amp; Noto Emoji
          </strong>{" "}
          — fonts and animated emoji assets loaded from Google CDN (
          <code className="text-xs">fonts.googleapis.com</code>,{" "}
          <code className="text-xs">fonts.gstatic.com</code>)
        </li>
      </ul>
      <p className="mt-3 text-gray-500 text-xs">
        When you share links in chat, our Worker may fetch metadata (title,
        image, description) from the linked URL to generate a link preview.
      </p>
    </Section>

    <Section title="Legal Basis for Processing (GDPR)">
      <p>
        If you are in the European Economic Area or the United Kingdom, we
        process your data under the following legal bases:
      </p>
      <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Contract performance</strong> —
          delivering the messaging service you signed up for (message delivery,
          push notifications, read receipts, online status)
        </li>
        <li>
          <strong className="text-gray-300">Legitimate interest</strong> —
          maintaining service reliability, debugging via feedback/bug reports,
          and aggregate traffic monitoring
        </li>
        <li>
          <strong className="text-gray-300">Consent</strong> — push
          notifications (opt-in) and message translation (on-demand)
        </li>
      </ul>
    </Section>

    <Section title="Data Retention">
      <ul className="list-disc list-inside space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">Push subscriptions</strong> —
          automatically removed after 30 days of inactivity
        </li>
        <li>
          <strong className="text-gray-300">
            Online status &amp; read cursors
          </strong>{" "}
          — kept while your account is active; removed on request
        </li>
        <li>
          <strong className="text-gray-300">Feedback &amp; bug reports</strong>{" "}
          — retained for debugging purposes until manually deleted
        </li>
        <li>
          <strong className="text-gray-300">Blockchain data</strong> — permanent
          by design; governed by the DeSo protocol
        </li>
        <li>
          <strong className="text-gray-300">Device storage</strong> — cleared
          automatically on logout or when you clear browser data
        </li>
      </ul>
    </Section>

    <Section title="International Transfers">
      <p>
        ChatOn uses Cloudflare&rsquo;s global edge network, which means your
        requests may be processed in data centers outside your country of
        residence. DeSo blockchain nodes also operate globally. We rely on
        Cloudflare&rsquo;s data processing agreements and standard contractual
        clauses for any transfers outside the EEA/UK.
      </p>
    </Section>

    <Section title="Your Rights">
      <p>
        Depending on your location, you may have the right to access, correct,
        delete, or export the personal data we hold about you. You may also
        object to or restrict certain processing.
      </p>
      <p className="mt-3">
        For server-side data (push subscriptions, read cursors, online status,
        feedback), contact us at the address below to request access or
        deletion. Device-stored data is under your control — clear it through
        your browser settings at any time.
      </p>
      <p className="mt-3">
        Blockchain data cannot be deleted by ChatOn or any single party. This is
        an inherent property of the DeSo protocol.
      </p>
      <p className="mt-3 text-gray-500 text-xs">
        <strong className="text-gray-400">
          California residents (CCPA/CPRA):
        </strong>{" "}
        We do not sell or share your personal information as defined by
        California law. We do not use your data for cross-context behavioral
        advertising. You may contact us to request disclosure of the categories
        of personal information we collect and their purposes.
      </p>
    </Section>

    <Section title="Children's Privacy">
      <p>
        ChatOn is not intended for anyone under 13 years of age. We do not
        knowingly collect information from children. If you believe a child
        under 13 has used ChatOn, contact us and we will delete any server-side
        data associated with their account.
      </p>
    </Section>

    <Section title="Changes to This Policy">
      <p>
        We may update this policy to reflect changes in the app or applicable
        law. The &ldquo;Last updated&rdquo; date at the top will change when we
        do. Continued use of ChatOn after changes constitutes acceptance of the
        updated policy.
      </p>
    </Section>

    <Section title="Contact">
      <p>
        Questions about this policy or requests regarding your data? Reach out
        to{" "}
        <a
          href="mailto:privacy@getchat.on"
          className="text-[#34F080] hover:underline"
        >
          privacy@getchat.on
        </a>{" "}
        or contact{" "}
        <a
          href="https://focus.xyz/nathanwells"
          target="_blank"
          rel="noreferrer"
          className="text-[#34F080] hover:underline"
        >
          @nathanwells
        </a>{" "}
        on DeSo.
      </p>
    </Section>
  </>
);

const TermsContent: FC = () => (
  <>
    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
      Terms of Service
    </h1>
    <p className="text-gray-500 text-sm mb-12">Last updated: {LAST_UPDATED}</p>

    <Section title="Agreement">
      <p>
        By using ChatOn, you agree to these terms. If you do not agree, do not
        use the app.
      </p>
    </Section>

    <Section title="What ChatOn Is">
      <p>
        ChatOn is a client application for the DeSo blockchain&rsquo;s messaging
        protocol. It provides a user interface for sending and receiving
        end-to-end encrypted messages. Message data lives on the DeSo
        blockchain. ChatOn operates a Cloudflare Worker for push notifications,
        real-time delivery, and read receipts — see our Privacy Policy for
        details.
      </p>
    </Section>

    <Section title="Your Account">
      <p>
        You authenticate through DeSo Identity using your DeSo account. ChatOn
        does not create accounts or manage credentials. You are responsible for
        the security of your DeSo keys and seed phrase. If you lose access to
        your DeSo account, ChatOn cannot recover it.
      </p>
    </Section>

    <Section title="Blockchain Permanence">
      <p>
        Messages sent through ChatOn are submitted as transactions on the DeSo
        blockchain. Blockchain transactions are permanent. ChatOn cannot delete,
        edit, or recall messages after they are submitted. While message content
        is encrypted, the fact that a transaction occurred (sender, recipient,
        timestamp) is publicly visible on the blockchain.
      </p>
    </Section>

    <Section title="Acceptable Use">
      <p>You agree not to use ChatOn to:</p>
      <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
        <li>Send spam or unsolicited bulk messages</li>
        <li>Harass, threaten, or abuse other users</li>
        <li>Distribute malware or phishing links</li>
        <li>Impersonate other individuals or entities</li>
        <li>Violate any applicable law or regulation</li>
        <li>
          Attempt to interfere with the app's operation or the DeSo network
        </li>
      </ul>
    </Section>

    <Section title="Content Responsibility">
      <p>
        You are solely responsible for the content you send. Because messages
        are end-to-end encrypted, ChatOn cannot monitor, moderate, or access
        message content. You acknowledge that you bear full responsibility for
        anything you transmit.
      </p>
    </Section>

    <Section title="Availability">
      <p>
        ChatOn is provided on an &ldquo;as available&rdquo; basis. We do not
        guarantee uninterrupted access. The app depends on the DeSo blockchain
        and third-party infrastructure (Cloudflare, DeSo nodes) which are
        outside our control. We may modify, suspend, or discontinue the app at
        any time.
      </p>
    </Section>

    <Section title="No Warranty">
      <p>
        ChatOn is provided &ldquo;as is&rdquo; without warranties of any kind,
        express or implied, including but not limited to warranties of
        merchantability, fitness for a particular purpose, or non-infringement.
      </p>
    </Section>

    <Section title="Limitation of Liability">
      <p>
        To the maximum extent permitted by law, ChatOn and its creators shall
        not be liable for any indirect, incidental, special, consequential, or
        punitive damages, or any loss of profits or data, arising from your use
        of the app.
      </p>
    </Section>

    <Section title="Intellectual Property">
      <p>
        ChatOn is open source software. The source code is available on{" "}
        <a
          href="https://github.com/sungkhum/chaton"
          target="_blank"
          rel="noreferrer"
          className="text-[#34F080] hover:underline"
        >
          GitHub
        </a>
        . Your messages and content belong to you.
      </p>
    </Section>

    <Section title="Changes to These Terms">
      <p>
        We may update these terms at any time. The &ldquo;Last updated&rdquo;
        date at the top will reflect the most recent revision. Continued use of
        ChatOn after changes constitutes acceptance of the updated terms.
      </p>
    </Section>

    <Section title="Contact">
      <p>
        Questions about these terms? Reach out to{" "}
        <a
          href="https://focus.xyz/nathanwells"
          target="_blank"
          rel="noreferrer"
          className="text-[#34F080] hover:underline"
        >
          @nathanwells
        </a>{" "}
        on DeSo.
      </p>
    </Section>
  </>
);

const Section: FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="mb-10">
    <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
    <div className="text-gray-400 text-sm leading-relaxed">{children}</div>
  </section>
);

export const LegalPage: FC<{ type: "privacy" | "terms" }> = ({ type }) => {
  usePageMeta({
    title:
      type === "privacy"
        ? "Privacy Policy — ChatOn"
        : "Terms of Service — ChatOn",
    description:
      type === "privacy"
        ? "ChatOn does not collect analytics, tracking pixels, or advertising data. Learn how your privacy is protected."
        : "Terms of Service for ChatOn, an end-to-end encrypted messaging app on the DeSo blockchain.",
    path: type === "privacy" ? "/privacy" : "/terms",
  });

  return (
    <div className="min-h-screen bg-[#0A0E17] text-white">
      <header className="border-b border-white/5 bg-[#0F1520]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img
              src="/ChatOn-Logo-Small.png"
              alt="ChatOn"
              className="w-8 h-8 rounded-xl"
            />
            <span className="font-black tracking-tight text-lg">ChatOn</span>
          </a>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
      </main>
      <footer className="border-t border-white/5 bg-[#0F1520]">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <p>
            &copy; {new Date().getFullYear()} ChatOn. End-to-end encrypted
            messaging on DeSo.
          </p>
          <div className="flex gap-6">
            <a
              href="/privacy"
              className={`hover:text-gray-400 transition-colors ${
                type === "privacy" ? "text-gray-400" : ""
              }`}
            >
              Privacy
            </a>
            <a
              href="/terms"
              className={`hover:text-gray-400 transition-colors ${
                type === "terms" ? "text-gray-400" : ""
              }`}
            >
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
