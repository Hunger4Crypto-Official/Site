// scripts/mongo-init.js
db = db.getSiblingDB('h4c');
db.createCollection('users');
db.createCollection('badges');

// Create indexes
db.users.createIndex({ discordId: 1 }, { unique: true, sparse: true });
db.users.createIndex({ walletAddress: 1 });
db.badges.createIndex({ badgeId: 1 }, { unique: true });

print('H4C database initialized');
