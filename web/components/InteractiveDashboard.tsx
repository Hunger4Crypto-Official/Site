import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#8dd1e1"] as const;

export type DashboardUser = {
  discordId: string;
  username: string;
  badges: string[];
  reputation: {
    total: number;
    breakdown: Record<string, number>;
  };
  memoBalance: number;
  lpValue: number;
  streak: { current: number; longest: number };
  totalXP: number;
  level: number;
  nextLevelXP: number;
};

export type DashboardAchievement = {
  id: number | string;
  title: string;
  icon: string;
  unlocked: boolean;
  xp: number;
};

export type DashboardActivity = {
  day: string;
  xp: number;
  actions: number;
};

export type DashboardProps = {
  user: DashboardUser;
  achievements: DashboardAchievement[];
  dailyActivity: DashboardActivity[];
};

function clampProgress(progress: number): number {
  if (Number.isNaN(progress)) {
    return 0;
  }
  return Math.min(100, Math.max(0, progress));
}

export default function InteractiveDashboard({ user, achievements, dailyActivity }: DashboardProps) {
  const levelProgress = useMemo(() => {
    if (!user.nextLevelXP) {
      return 0;
    }
    const ratio = (user.totalXP / user.nextLevelXP) * 100;
    return clampProgress(ratio);
  }, [user.nextLevelXP, user.totalXP]);

  const xpLabel = useMemo(() => {
    if (!user.nextLevelXP) {
      return `${user.totalXP.toLocaleString()} XP`;
    }
    return `${user.totalXP.toLocaleString()}/${user.nextLevelXP.toLocaleString()} XP`;
  }, [user.totalXP, user.nextLevelXP]);

  const reputationData = useMemo(() => {
    return Object.entries(user.reputation.breakdown || {}).map(([name, value], index) => ({
      name,
      value,
      color: COLORS[index % COLORS.length],
    }));
  }, [user.reputation.breakdown]);

  const unlockedAchievements = useMemo(
    () => achievements.filter((achievement) => achievement.unlocked),
    [achievements],
  );

  const lockedAchievements = useMemo(
    () => achievements.filter((achievement) => !achievement.unlocked),
    [achievements],
  );

  const chartTooltipStyle = {
    backgroundColor: "#1F2937",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#E5E7EB",
  } as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-2xl font-bold">
                  {user.username.charAt(0)}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-slate-800" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{user.username}</h1>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Level {user.level}</span>
                  <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-300"
                      style={{ width: `${levelProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{xpLabel}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-400">{user.streak.current} 🔥</div>
              <div className="text-slate-400 text-sm">Day Streak</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">$MemO Balance</p>
                <p className="text-2xl font-bold text-white">{user.memoBalance.toLocaleString()}</p>
              </div>
              <div className="text-3xl">💎</div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">LP Value</p>
                <p className="text-2xl font-bold text-green-400">
                  $
                  {user.lpValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Reputation</p>
                <p className="text-2xl font-bold text-purple-400">{user.reputation.total.toLocaleString()}</p>
              </div>
              <div className="text-3xl">⭐</div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Badges</p>
                <p className="text-2xl font-bold text-yellow-400">{user.badges.length}</p>
              </div>
              <div className="text-3xl">🏆</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Weekly Activity</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number) => [`${value} XP`, "XP"]}
                  labelFormatter={(label, payload) => {
                    const point = payload?.[0]?.payload as DashboardActivity | undefined;
                    return point ? `${label} — ${point.actions} actions` : label;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke="#8B5CF6"
                  strokeWidth={3}
                  dot={{ fill: "#8B5CF6", strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Reputation by Chain</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={reputationData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {reputationData.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value: number, name: string) => [`${value}`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-6">Achievements</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-green-400 font-semibold mb-4">Unlocked ({unlockedAchievements.length})</h4>
              <div className="space-y-3">
                {unlockedAchievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center space-x-3 p-3 bg-green-900/20 rounded-lg border border-green-700/30"
                  >
                    <span className="text-2xl">{achievement.icon}</span>
                    <div className="flex-1">
                      <p className="text-white font-medium">{achievement.title}</p>
                      <p className="text-green-400 text-sm">+{achievement.xp} XP</p>
                    </div>
                    <div className="text-green-400">✓</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-slate-400 font-semibold mb-4">Locked ({lockedAchievements.length})</h4>
              <div className="space-y-3">
                {lockedAchievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center space-x-3 p-3 bg-slate-700/20 rounded-lg border border-slate-600/30"
                  >
                    <span className="text-2xl grayscale">{achievement.icon}</span>
                    <div className="flex-1">
                      <p className="text-slate-300 font-medium">{achievement.title}</p>
                      <p className="text-slate-500 text-sm">+{achievement.xp} XP</p>
                    </div>
                    <div className="text-slate-500">🔒</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
