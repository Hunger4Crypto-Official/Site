import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  discordId: { type: String, unique: true, index: true },
  username: String,
  walletAddress: { type: String, index: true },   // Algorand
  walletVerified: { type: Boolean, default: false, index: true },
  ethAddress: { type: String, index: true },
  solAddress: { type: String, index: true },
  badges: [{ type: String }],
  email: String,
  emailCollectedAt: Date
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
