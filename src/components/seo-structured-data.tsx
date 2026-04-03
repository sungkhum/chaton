const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "ChatOn",
      alternateName: "GetChatOn",
      url: "https://getchaton.com",
      logo: "https://getchaton.com/ChatOn-Logo-Small.png",
      description:
        "ChatOn is a free, decentralized, end-to-end encrypted messaging app built on the DeSo blockchain.",
      sameAs: [
        "https://github.com/sungkhum/chaton",
        "https://twitter.com/GetChatOn",
      ],
    },
    {
      "@type": ["WebApplication", "SoftwareApplication"],
      name: "ChatOn",
      alternateName: "GetChatOn",
      url: "https://getchaton.com",
      applicationCategory: "CommunicationApplication",
      applicationSubCategory: "Messaging",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern web browser",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "End-to-end encrypted messaging on the DeSo blockchain. No phone number required. Free, open-source, decentralized. Censorship-resistant.",
      featureList: [
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
        "Community directory",
      ],
      screenshot: "https://getchaton.com/chaton-featured.webp",
      isAccessibleForFree: true,
    },
  ],
};

export const SeoStructuredData = () => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
  />
);
