import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema({
  key: { type: String, index: true },
  label: String,
  description: String,
  unlockedAt: { type: Date, default: Date.now },
  meta: mongoose.Schema.Types.Mixed
}, { _id: false });

const communityStatsSchema = new mongoose.Schema({
  gmCount: { type: Number, default: 0 },
  gnCount: { type: Number, default: 0 },
  gmStreak: { type: Number, default: 0 },
  gnStreak: { type: Number, default: 0 },
  longestGmStreak: { type: Number, default: 0 },
  longestGnStreak: { type: Number, default: 0 },
  lastGMAt: Date,
  lastGNAt: Date,
  memesPosted: { type: Number, default: 0 },
  lastMemeAt: Date,
  lastInteractionAt: Date,
  lastResurrectionAt: Date,
  resurrectionCount: { type: Number, default: 0 },
  chatterOptOut: { type: Boolean, default: false }
}, { _id: false });

const userSchema = new mongoose.Schema({
  discordId: { type: String, unique: true, index: true, sparse: true }, // Make sparse for web-only users
  username: String,
  walletAddress: { type: String, index: true },   // Algorand
  walletVerified: { type: Boolean, default: false, index: true },
  ethAddress: { type: String, index: true },
  solAddress: { type: String, index: true },
  badges: [{ type: String }],
  achievements: { type: [achievementSchema], default: [] },
  community: { type: communityStatsSchema, default: () => ({}) },
  shadowbanned: { type: Boolean, default: false, index: true },
  autoPostOptOut: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now, index: true },
  email: { type: String, index: true, sparse: true },
  emailCollectedAt: Date,
  emailSources: [{
    source: String, // 'discord', 'web', 'api', etc.
    collectedAt: Date,
    userAgent: String,
    ip: String
  }]
}, { timestamps: true, collection: 'users' });

userSchema.path('badges').validate(arr => !arr || (Array.isArray(arr) && new Set(arr).size === arr.length), 'Badges must be unique');

const badgeSchema = new mongoose.Schema({
  badgeId: { type: String, unique: true, index: true },
  name: String,
  description: String,
  category: { type: String, index: true },
  rarity: String,
  iconUrl: String
}, { collection: 'badges' });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Badge = mongoose.models.Badge || mongoose.model('Badge', badgeSchema);
