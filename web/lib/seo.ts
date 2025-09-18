export const siteConfig = {
  name: "Hunger4Crypto",
  title: "H4C | $MemO Collective - Crypto Education",
  description: "Learn about crypto, blockchain, and the $MemO Collective ecosystem through comprehensive guides covering Bitcoin, Ethereum, Algorand, NFTs, and more.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://hunger4crypto.com",
  ogImage: "/og-image.png",
  creator: "@MemOCollective",
  keywords: [
    "cryptocurrency",
    "blockchain", 
    "Bitcoin",
    "Ethereum", 
    "Algorand",
    "NFTs",
    "DeFi",
    "Web3",
    "$MemO",
    "crypto education",
    "real world assets",
    "RWA"
  ]
};

export function generateMetadata(page: {
  title?: string;
  description?: string;
  image?: string;
  noIndex?: boolean;
}) {
  const title = page.title 
    ? `${page.title} | ${siteConfig.name}`
    : siteConfig.title;
    
  const description = page.description || siteConfig.description;
  const image = page.image || siteConfig.ogImage;
  const url = siteConfig.url;

  return {
    title,
    description,
    keywords: siteConfig.keywords.join(", "),
    authors: [{ name: siteConfig.creator }],
    creator: siteConfig.creator,
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: siteConfig.name,
      images: [
        {
          url: `${url}${image}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${url}${image}`],
      creator: siteConfig.creator,
    },
    robots: page.noIndex ? "noindex, nofollow" : "index, follow",
    alternates: {
      canonical: url,
    },
  };
}
