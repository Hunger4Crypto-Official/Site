import Head from "next/head";
import type { GetStaticProps } from "next";

import InteractiveDashboard, { DashboardProps } from "../components/InteractiveDashboard";

type DashboardPageProps = {
  dashboard: DashboardProps;
};

export default function DashboardPage({ dashboard }: DashboardPageProps) {
  return (
    <>
      <Head>
        <title>Community Dashboard | $MemO Collective</title>
        <meta
          name="description"
          content="Overview of $MemO Collective community activity, streaks, and achievements."
        />
      </Head>
      <InteractiveDashboard {...dashboard} />
    </>
  );
}

export const getStaticProps: GetStaticProps<DashboardPageProps> = async () => {
  const dashboard: DashboardProps = {
    user: {
      discordId: "123456789",
      username: "CryptoEnthusiast",
      badges: ["hodl-whale", "lp-gold", "community-champion"],
      reputation: {
        total: 847,
        breakdown: {
          Ethereum: 320,
          Solana: 287,
          Algorand: 240,
        },
      },
      memoBalance: 750000,
      lpValue: 12500,
      streak: { current: 23, longest: 45 },
      totalXP: 15420,
      level: 12,
      nextLevelXP: 16000,
    },
    achievements: [
      { id: 1, title: "First Wallet Connected", icon: "🔗", unlocked: true, xp: 100 },
      { id: 2, title: "HODL Whale", icon: "🐋", unlocked: true, xp: 500 },
      { id: 3, title: "LP Provider", icon: "💰", unlocked: true, xp: 300 },
      { id: 4, title: "Community Helper", icon: "🤝", unlocked: false, xp: 250 },
      { id: 5, title: "Article Master", icon: "📚", unlocked: false, xp: 400 },
    ],
    dailyActivity: [
      { day: "Mon", xp: 120, actions: 5 },
      { day: "Tue", xp: 180, actions: 8 },
      { day: "Wed", xp: 240, actions: 12 },
      { day: "Thu", xp: 160, actions: 6 },
      { day: "Fri", xp: 300, actions: 15 },
      { day: "Sat", xp: 220, actions: 9 },
      { day: "Sun", xp: 280, actions: 11 },
    ],
  };

  return {
    props: { dashboard },
    revalidate: 60 * 60, // Refresh hourly in case stats change
  };
};
