import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const BADGES_DIR = path.join(process.cwd(), 'web', 'public', 'badges');

const badgeSchema = new mongoose.Schema({
  badgeId: { type: String, unique: true, index: true },
  name: String,
  description: String,
  category: { type: String, index: true },
  rarity: String,
  iconUrl: String
}, { collection: 'badges' });

const Badge = mongoose.models.Badge || mongoose.model('Badge', badgeSchema);

function inferMeta(file) {
  const id = file.replace(/\.png$/i, '');
  const name = id.split('-').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
  let category = id.startsWith('hodl') ? 'hodl' : 'general';
  let rarity = 'common';
  if (/legendary|titan|mythic/i.test(id)) rarity = 'legendary';
  else if (/epic|shark/i.test(id)) rarity = 'epic';
  else if (/rare|fish|dolphin/i.test(id)) rarity = 'rare';
  else if (/uncommon|crab/i.test(id)) rarity = 'uncommon';
  return { id, name, category, rarity };
}

async function main() {
  const mongo = process.env.MONGODB_URI;
  if (!mongo) throw new Error('MONGODB_URI missing');
  await mongoose.connect(mongo);

  if (!fs.existsSync(BADGES_DIR)) {
    console.log('No badges directory at', BADGES_DIR);
    await mongoose.disconnect();
    process.exit(0);
  }

  const files = fs.readdirSync(BADGES_DIR).filter(f => f.endsWith('.png'));
  for (const f of files) {
    const { id, name, category, rarity } = inferMeta(f);
    const iconUrl = `/badges/${f}`;
    await Badge.findOneAndUpdate(
      { badgeId: id },
      { badgeId: id, name, category, rarity, description: name, iconUrl },
      { upsert: true, new: true }
    );
    console.log('Seeded', id);
  }
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
