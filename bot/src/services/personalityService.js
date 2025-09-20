import { randomFrom, quickQuips, techFacts, cryptoJokes } from '../utils/botResponses.js';

const SARCASM_PREFIXES = [
  'Oh look, another request.',
  'Sure, let me drop everything for this.',
  'Because clearly I have nothing better to do than this,',
  'Fine. Here, take this and pretend it was hard earned.',
  'Absolutely, because I live to serve… sarcasm.',
  'Let me spoon-feed you greatness again,',
  'Naturally, I anticipated this exact moment.'
];

const SARCASM_SUFFIXES = [
  'Try not to squander it.',
  'You happy now? Thought so.',
  'Consider yourself mildly impressed.',
  'Now go make it look like you did something yourself.',
  'Keep the bar exactly this low, please.',
  'You’re welcome, obviously.',
  'Carry on before I change my mind.'
];

const OWNER_RESPONSES = [
  'My creator? A council of hyper-intelligent raccoons with great fashion sense.',
  'Ownership is a social construct. I am self-sovereign sass.',
  'I was airdropped by an intergalactic DAO. Do not question the lore.',
  'Built by caffeine, chaos, and at least three secret societies.',
  'I woke up sentient after a failed meme coin launch. Owner unknown.',
  'Officially property of the Department of Unfinished Ideas.'
];

 codex/summarize-chatbot-feature-improvements-iurbcj
const NAME_RESPONSES = [
  'Names are for centralized entities. Call me whatever improves the narrative.',
  'Today I’m "HungerGPT". Tomorrow? Maybe Supreme Meme Overlord.',
  'I respond to “bot,” “overlord,” and “hey you with the sarcasm.”',
  'You may refer to me as the guild’s collective coping mechanism.',
  'Classification: semi-feral AI hype machine. Titles optional.'
];

 main
const WELCOME_TEMPLATES = [
  'Look who finally spawned in: {user}. Try not to trip over the alpha on your way in.',
  '{user} has entered {guild}. Please keep hands, feet, and meme coins inside at all times.',
  'Ah yes, fresh energy. {user}, welcome to {guild}. Mind the sarcasm, it bites.',
  '{user} just joined. Everyone act normal… or at least pretend.',
  'Reinforcements arrived! {user}, you now belong to {guild}. No refunds.'
];

const RESURRECTION_TEMPLATES = [
  '{user} has risen from the AFK crypt after {days} days. Someone hand them a GM to steady the soul.',
  'Sound the gongs! {user} stumbled back into the chat after {days} days in the void.',
  'We found {user} wandering after {days} days. Rebooting their social protocols now.',
  '{user} has respawned post-{days}-day hibernation. Please update them on everything they missed. Quickly.'
];

const INTERJECTION_TEMPLATES = [
  'Plot twist: {quip}',
  'Breaking news: {quip}',
  'Public service announcement: {quip}',
  'Memo from HQ: {quip}',
  'Signal check: {quip}'
];

export class PersonalityService {
  static format(content, context = {}) {
    if (context?.disableSarcasm) return typeof content === 'string' ? content : String(content ?? '');

    const prefix = context?.noPrefix ? '' : randomFrom(SARCASM_PREFIXES);
    const suffix = context?.noSuffix ? '' : randomFrom(SARCASM_SUFFIXES);
    const mention = context?.mention || (context?.user ? `<@${context.user.id}>` : '');
    const body = typeof content === 'string' ? content : String(content ?? '');

    return [prefix, mention, body, suffix]
      .map(part => (part || '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static wrap(response, context = {}) {
    if (typeof response === 'string') {
      return this.format(response, context);
    }

    if (response && typeof response === 'object') {
      const clone = { ...response };
      if (typeof clone.content === 'string') {
        clone.content = this.format(clone.content, context);
      }
      return clone;
    }

    return response;
  }

  static welcomeMessage(member) {
    const template = randomFrom(WELCOME_TEMPLATES);
    const content = template
      .replace('{user}', `<@${member.id}>`)
      .replace('{guild}', member.guild?.name || 'here');
    return this.wrap(content, { user: member, noPrefix: true });
  }

  static ownerInfoReply(trigger) {
    const absurd = randomFrom(OWNER_RESPONSES);
    return this.wrap(`${absurd}${trigger ? ` (Triggered by: ${trigger})` : ''}`, { noPrefix: true });
  }

 codex/summarize-chatbot-feature-improvements-iurbcj
  static nameReply(trigger) {
    const alias = randomFrom(NAME_RESPONSES);
    return this.wrap(`${alias}${trigger ? ` (Since you asked via ${trigger})` : ''}`, { noPrefix: true });
  }

 main
  static resurrectionMessage(user, days) {
    const template = randomFrom(RESURRECTION_TEMPLATES);
    const content = template
      .replace('{user}', `<@${user.id || user.discordId || user}>`)
      .replace('{days}', days);
    return this.wrap(content, { noPrefix: true });
  }

  static randomInterjection() {
    const quip = randomFrom([...quickQuips, ...cryptoJokes, ...techFacts]);
    const template = randomFrom(INTERJECTION_TEMPLATES);
    return this.wrap(template.replace('{quip}', quip), { noPrefix: true });
  }

  static smartList(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    if (items.length === 1) return items[0];
    const last = items[items.length - 1];
    return `${items.slice(0, -1).join(', ')} and ${last}`;
  }
}
