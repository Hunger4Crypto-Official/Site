import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const responsesDir = path.resolve(__dirname, '../bot responses');

function loadJson(file, key) {
  try {
    const filePath = path.join(responsesDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Bot response file not found: ${filePath}`);
      return [];
    }

    const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (key && payload[key]) return payload[key];
    if (key && payload[key.toLowerCase()]) return payload[key.toLowerCase()];

    const firstKey = Object.keys(payload)[0];
    return firstKey ? payload[firstKey] : [];
  } catch (error) {
    console.error(`Error loading bot response file ${file}:`, error.message);
    return [];
  }
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
  if (!Array.isArray(arr) || arr.length === 0) {
    return undefined;
  }
  return arr[Math.floor(Math.random() * arr.length)];
}
