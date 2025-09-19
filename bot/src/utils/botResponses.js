import fs from 'fs';
import path from 'path';

function loadJson(file, key) {
  const payload = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../bot responses/', file), 'utf-8'));
  if (key && payload[key]) return payload[key];
  if (key && payload[key.toLowerCase()]) return payload[key.toLowerCase()];
  const firstKey = Object.keys(payload)[0];
  return firstKey ? payload[firstKey] : [];
}

export const chaosEvents = loadJson('chaos_events.json', 'ChaosEvents');
export const loreDrops = loadJson('lore_drops.json', 'LoreDrops');
export const quickQuips = loadJson('quick_quips.json', 'QuickQuips');
export const storyJabs = loadJson('story_jabs.json', 'StoryJabs');
export const gmResponses = loadJson('gmResponses.json', 'GMResponses');
export const cryptoJokes = loadJson('cryptoJokes.json', 'CryptoJokes');
export const techFacts = loadJson('techCryptoFacts.json', 'TechCryptoFacts');
export const memeVault = loadJson('memes.json', 'Memes');

export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
