import { FC } from "react";
import { usePageMeta } from "../hooks/usePageMeta";

const LAST_UPDATED = "March 29, 2026";

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
        . We do not operate a backend server or database. All message data lives
        on the DeSo blockchain, encrypted end-to-end. ChatOn is a client that
        reads and writes to that blockchain on your behalf.
      </p>
    </Section>

    <Section title="Data We Do Not Collect">
      <p>ChatOn does not use analytics, tracking pixels, or advertising SDKs. We do not collect:</p>
      <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
        <li>Usage analytics or behavioral data</li>
        <li>Device fingerprints</li>
        <li>IP address logs</li>
        <li>Advertising identifiers</li>
        <li>Cookies (we use none)</li>
      </ul>
    </Section>

    <Section title="Data That Exists on the DeSo Blockchain">
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
        ChatOn cannot delete, modify, or access the plaintext of your messages.
        Blockchain data is permanent and public by design, though message
        content is encrypted and only readable by the conversation
        participants.
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
        messages arrive. We store only:
      </p>
      <ul className="list-disc list-inside mt-3 space-y-1.5 text-gray-400">
        <li>Your DeSo public key (to know which notifications are yours)</li>
        <li>Your browser push subscription object (endpoint URL and keys)</li>
      </ul>
      <p className="mt-3">
        You can revoke push notification access at any time through your browser
        settings. We do not use push subscriptions for any purpose other than
        delivering message notifications.
      </p>
    </Section>

    <Section title="WebSocket Relay">
      <p>
        ChatOn uses a Cloudflare Worker with Durable Objects to provide
        real-time message delivery via WebSockets. This relay is transient — it
        forwards notifications between connected clients and does not store
        message content, conversation history, or user data.
      </p>
    </Section>

    <Section title="Third-Party Services">
      <ul className="list-disc list-inside space-y-1.5 text-gray-400">
        <li>
          <strong className="text-gray-300">DeSo Blockchain</strong> — stores
          all message data, profiles, and social graph
        </li>
        <li>
          <strong className="text-gray-300">DeSo Identity</strong> —
          handles authentication and key management
        </li>
        <li>
          <strong className="text-gray-300">Cloudflare</strong> — hosts our
          WebSocket relay worker and serves static assets
        </li>
        <li>
          <strong className="text-gray-300">KLIPY</strong> — provides GIF
          and sticker search when you use the content picker (subject to{" "}
          <a
            href="https://klipy.com/support/api-terms"
            target="_blank"
            rel="noreferrer"
            className="text-[#34F080] hover:underline"
          >
            KLIPY's API terms
          </a>
          )
        </li>
      </ul>
    </Section>

    <Section title="Local Storage">
      <p>
        ChatOn stores minimal data in your browser's local storage for
        performance — cached profile information and your authentication state.
        This data never leaves your device and can be cleared through your
        browser settings.
      </p>
    </Section>

    <Section title="Children's Privacy">
      <p>
        ChatOn is not intended for anyone under 13 years of age. We do not
        knowingly collect information from children.
      </p>
    </Section>

    <Section title="Changes to This Policy">
      <p>
        We may update this policy to reflect changes in the app or applicable
        law. The "Last updated" date at the top will change when we do.
        Continued use of ChatOn after changes constitutes acceptance of the
        updated policy.
      </p>
    </Section>

    <Section title="Contact">
      <p>
        Questions about this policy? Reach out to{" "}
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
        ChatOn is a client application for the DeSo blockchain's messaging
        protocol. It provides a user interface for sending and receiving
        end-to-end encrypted messages. ChatOn does not operate its own servers
        for message storage — all data lives on the DeSo blockchain.
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
        ChatOn is provided on an "as available" basis. We do not guarantee
        uninterrupted access. The app depends on the DeSo blockchain and
        third-party infrastructure (Cloudflare, DeSo nodes) which are outside
        our control. We may modify, suspend, or discontinue the app at any
        time.
      </p>
    </Section>

    <Section title="No Warranty">
      <p>
        ChatOn is provided "as is" without warranties of any kind, express or
        implied, including but not limited to warranties of merchantability,
        fitness for a particular purpose, or non-infringement.
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
        We may update these terms at any time. The "Last updated" date at the
        top will reflect the most recent revision. Continued use of ChatOn
        after changes constitutes acceptance of the updated terms.
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
    title: type === "privacy" ? "Privacy Policy — ChatOn" : "Terms of Service — ChatOn",
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
        <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
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
