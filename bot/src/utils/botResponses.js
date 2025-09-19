import fs from 'fs';
import path from 'path';

function loadJson(file) {
  // Loads from bot/src/bot responses/
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, '../bot responses/', file), 'utf-8'));
}

export const chaosEvents = loadJson('chaos_events.json').ChaosEvents;
export const loreDrops = loadJson('lore_drops.json').LoreDrops;
export const quickQuips = loadJson('quick_quips.json').QuickQuips;
export const storyJabs = loadJson('story_jabs.json').StoryJabs;

export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
