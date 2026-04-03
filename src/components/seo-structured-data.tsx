const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "ChatOn",
      url: "https://getchaton.com",
      logo: "https://getchaton.com/ChatOn-Logo-Small.png",
      sameAs: ["https://github.com/sungkhum/chaton"],
    },
    {
      "@type": "WebApplication",
      name: "ChatOn",
      url: "https://getchaton.com",
      applicationCategory: "CommunicationApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "End-to-end encrypted messaging on the DeSo blockchain. Your message content is unreadable to everyone except you and your recipients. Built to scale. Impossible to censor.",
      featureList: [
        "End-to-end encryption",
        "Decentralized on DeSo blockchain",
        "Group chats",
        "GIF and media sharing",
        "Emoji reactions",
        "Push notifications",
        "Progressive Web App",
      ],
    },
  ],
};

export const SeoStructuredData = () => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
  />
);
