// The ask box, without an AI key. It recognises a known set of questions and commands
// by pattern, answers from live state, and says plainly when it does not understand.
// People in replies are tokens such as {A2}; the screen shows the reader's name for them.

import { DAYS, DAYS_SHORT, dayOf, minuteOf, fmtTime } from './time.js';
import { parseCapture } from './parse.js';
import { levelOf } from './pantry.js';
import { brief } from './brief.js';

const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const inSentence = (title) => title.replace(/^(\{\w+\}), (.+)$/, "$1's $2");
const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

export const CAN_DO = [
  'Answer: who collects, who cooks, what is for dinner, what is on a day, where someone is, when an activity is',
  'Record: type what is happening, such as "Netball Fri 3pm"',
  'Act: add to the grocery list, say we are out of something, move an appointment, ask the cook for a dish',
];

function findPeople(text, people) {
  const found = [];
  for (const m of people) {
    const aliases = [...new Set([m.name, ...(m.aliases || [])])].filter(Boolean);
    if (aliases.some((a) => new RegExp(`\\b${escapeRe(a)}(?:'s)?\\b`, 'i').test(text))) found.push(m.id);
  }
  return found;
}

function findDay(text, today) {
  const t = text.toLowerCase();
  if (/\b(today|tonight|this (afternoon|evening|morning)|now)\b/.test(t)) return today;
  if (/\b(tomorrow|tmr)\b/.test(t)) return (today + 1) % 7;
  for (let i = 0; i < 7; i += 1) if (new RegExp(`\\b(${DAYS[i]}|${DAYS_SHORT[i]})\\b`, 'i').test(t)) return i;
  return null;
}

// Find a commitment by the words in its title, such as "dentist" or "violin".
function findCommitment(text, s, fromDay = 0) {
  const t = text.toLowerCase();
  const words = (c) => c.title.replace(/\{\w+\},?\s*/g, '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const pool = s.commitments.filter((c) => c.status !== 'cancelled' && !['school', 'rest'].includes(c.type));
  const hits = pool.filter((c) => words(c).some((w) => new RegExp(`\\b${escapeRe(w)}\\b`).test(t)) || (c.activity && t.includes(c.activity)));
  return hits.sort((a, b) => (a.day < fromDay) - (b.day < fromDay) || a.day - b.day || a.start - b.start)[0] || null;
}

function findDish(text, s) {
  const t = text.toLowerCase();
  return s.dinner.dishes.find((d) => t.includes(d.name.toLowerCase()) || (d.words || []).some((w) => t.includes(w))) || null;
}

const answer = (text) => ({ kind: 'answer', text });

export function ask(input, s, v, people = s.members) {
  const text = input.trim().replace(/[?!.]+$/, '');
  const t = text.toLowerCase();
  const today = dayOf(s.now);
  const nowMin = minuteOf(s.now);
  if (!text) return answer('Type or say something, or tap one of the examples.');
  const dayIn = findDay(t, today);
  const day = dayIn ?? today;
  const dayWord = day === today ? 'today' : day === (today + 1) % 7 ? 'tomorrow' : `on ${DAYS[day]}`;
  const mentioned = findPeople(text, people);
  const on = (d) => s.commitments.filter((c) => c.day === d && c.status !== 'cancelled').sort((a, b) => a.start - b.start);

  // What can you do?
  if (/^(help|what can you do|what do you do|how does this work)/.test(t)) return { kind: 'answer', text: 'Here is what I can do for now.', bullets: CAN_DO };

  // Commands.
  let m = t.match(/^(?:please\s+)?(?:add|put|buy|we need|get)\s+(?:some\s+|more\s+)?(.+?)(?:\s+(?:to|on)\s+(?:the\s+|our\s+)?(?:grocery\s+|shopping\s+)?list)?$/);
  if (m && !/\b(mon|tue|wed|thu|fri|sat|sun|tomorrow|today|\d(am|pm))\b/.test(m[1])) {
    const item = m[1].trim();
    return { kind: 'action', do: { type: 'addGrocery', item }, text: `Added ${item} to the grocery list.` };
  }
  m = t.match(/(?:we(?:'re| are| have run| ran)?|i am|i'm)?\s*(?:run\s+)?out of\s+(.+)$/);
  if (m) {
    const word = m[1].trim();
    const item = s.dinner.pantry.find((p) => p.key === word || p.label.toLowerCase().includes(word) || word.includes(p.key));
    if (item) return { kind: 'action', do: { type: 'markOut', key: item.key, alsoList: true }, text: `Noted: out of ${item.label.toLowerCase()}. I have added it to the grocery list.` };
    return { kind: 'action', do: { type: 'addGrocery', item: word }, text: `I was not tracking ${word}, so I have added it to the grocery list.` };
  }
  if (/^(i have it|i('| wi)ll (take|do|get) it|got it|on it|i am on it|i'm on it)\b/.test(t)) {
    const c = on(today).find((x) => x.ack === 'pending' && x.end >= nowMin && (x.owner === v || x.backup.includes(v)));
    if (c) return { kind: 'action', do: { type: 'ack', cid: c.id }, text: `Confirmed: ${inSentence(c.title).replace(/^./, (ch) => ch.toLowerCase())} at ${fmtTime(c.start)}. Nobody else will be asked.` };
    return answer('Nothing is waiting for you to confirm right now.');
  }
  m = text.match(/^(?:please\s+)?(?:move|shift|reschedule|change|push)\s+(.+?)\s+to\s+(.+)$/i);
  if (m) {
    const c = findCommitment(m[1], s, today);
    const target = parseCapture(`x ${m[2]}`, people, today);
    if (!c) return answer(`I could not find "${m[1]}" in the week. Try the name of the activity, such as "the dentist" or "violin".`);
    if (target.day == null && target.start == null) return answer(`Move ${inSentence(c.title)} to when? Give a day, a time, or both.`);
    const patch = {};
    if (target.day != null) patch.day = target.day;
    if (target.start != null) patch.start = target.start;
    return { kind: 'action', do: { type: 'openRipple', cid: c.id, patch }, text: `Here is what moving ${inSentence(c.title)} would touch. Nothing changes until it is confirmed.` };
  }
  if (/^(can|could|may) (we|i) have\b|^i(?:'d| would) like\b|^ask for\b|^request\b|\bfor dinner\b/.test(t) && !/^(what|who)/.test(t)) {
    const dish = findDish(t, s);
    if (dish) {
      const planned = s.dinner.plan.filter((p) => p.day >= today);
      const plan = planned.find((p) => p.day === (dayIn ?? (nowMin < 16 * 60 ? today : today + 1))) || planned[0];
      if (!plan) return answer('There are no more home dinners planned this week.');
      if (plan.cook === v) return { kind: 'action', do: { type: 'setDish', day: plan.day, dish: dish.id }, text: `You cook on ${DAYS[plan.day]}, so it is set: ${dish.name.toLowerCase()}.` };
      return { kind: 'action', do: { type: 'askDish', day: plan.day, dish: dish.id }, text: `I have asked {${plan.cook}} for ${dish.name.toLowerCase()} on ${DAYS[plan.day]}. The cook decides.` };
    }
    if (/^(can|could|may) (we|i) have\b|^ask for\b|^request\b/.test(t)) return answer(`I do not know that dish yet. The ones I know: ${list(s.dinner.dishes.map((d) => d.name.toLowerCase()))}.`);
  }
  m = t.match(/^(?:go to|open|show(?: me)?)\s+(?:the\s+)?(.+)$/);
  if (m) {
    const routes = { week: 'week', dinner: 'dinner', pantry: 'dinner', groceries: 'dinner', 'grocery list': 'dinner', 'my day': 'today', today: 'today', triage: 'triage', inbox: 'triage', board: 'board', rota: 'rota', swaps: 'rota', ripple: 'ripple', seasons: 'seasons', classes: 'seasons', mirror: 'mirror', history: 'history', names: 'names', simulator: 'simulator', notifications: 'notifications', 'what you know': 'know', 'what i know': 'know' };
    const key = Object.keys(routes).find((k) => m[1].includes(k));
    if (key) return { kind: 'action', do: { type: 'go', route: routes[key] }, text: 'Opening it.' };
  }

  // Questions.
  if (/\bwho\b.*\b(collect|collects|collecting|picks? up|picking up|fetch|fetches|fetching)\b/.test(t)) {
    const c = on(day).find((x) => x.type === 'pickup');
    if (!c) return answer(`Nobody needs collecting ${dayWord}.`);
    const child = c.people.find((p) => p !== c.owner);
    const state = day === today ? (c.ack === 'acked' ? ' It is confirmed.' : c.end < nowMin ? '' : ' Not confirmed yet.') : '';
    const lower = (x) => x.charAt(0).toLowerCase() + x.slice(1);
    return answer(`${c.owner === v ? 'You collect' : `{${c.owner}} collects`} ${child === v ? 'you' : `{${child}}`} ${dayWord} at ${fmtTime(c.start)}, ${lower(c.place)}.${state}`);
  }
  if (/\bwho(?:'s| is)?\s+(?:is\s+)?cook(?:s|ing)?\b|\bwho makes dinner\b/.test(t)) {
    const plan = s.dinner.plan.find((p) => p.day === day);
    if (!plan) return answer(`No home dinner is planned ${dayWord}.`);
    const dish = s.dinner.dishes.find((d) => d.id === plan.dish);
    return answer(`${plan.cook === v ? 'You cook' : `{${plan.cook}} cooks`} ${dayWord}${dish ? `: ${dish.name.toLowerCase()}` : '; nothing is chosen yet'}.`);
  }
  if (/\bwho(?:'s| is| will be)?\s+(?:is\s+)?(home|in|here|around|eating|at dinner)\b/.test(t)) {
    const block = on(day).find((x) => x.id === `dinner-${day}`);
    if (!block) return answer(`No home dinner is planned ${dayWord}.`);
    const away = s.members.filter((mm) => !block.people.includes(mm.id));
    if (!away.length) return answer(`Everyone is home for dinner ${dayWord}, at ${fmtTime(block.start)}.`);
    const why = away.map((mm) => { const c = on(day).find((x) => x.people.includes(mm.id) && x.start < block.end && x.end > block.start); return `{${mm.id}}${c ? ` (${c.title.replace(/\{\w+\},?\s*/, '')})` : ''}`; });
    return answer(`${list(block.people.map((p) => (p === v ? 'you' : `{${p}}`)))} ${block.people.length === 1 && block.people[0] !== v ? 'is' : 'are'} home for dinner ${dayWord}. Away: ${list(why)}.`.replace(/^./, (ch) => ch.toUpperCase()));
  }
  if (/\bwhat(?:'s| is| are)?\b.*\b(for dinner|we eating|to eat|dinner)\b|^dinner\b/.test(t)) {
    const plan = s.dinner.plan.find((p) => p.day === day);
    if (!plan) return answer(`No home dinner is planned ${dayWord}.`);
    const dish = s.dinner.dishes.find((d) => d.id === plan.dish);
    const block = on(day).find((x) => x.id === `dinner-${day}`);
    return answer(`${dish ? dish.name : 'Nothing is chosen yet'} ${dayWord}${block ? ` at ${fmtTime(block.start)}` : ''}. ${plan.cook === v ? 'You cook' : `{${plan.cook}} cooks`}.`);
  }
  if (/\b(do|have) we (have|got)\b|\bis there (any|some)\b|\bany\s+\w+\s+(left|in the house)\b|\bhave we got\b/.test(t)) {
    const item = s.dinner.pantry.find((p) => t.includes(p.key) || t.includes(p.label.toLowerCase()) || (p.key.endsWith('s') && t.includes(p.key.slice(0, -1))));
    if (!item) return answer('I am not tracking that. If we need it, say "add it to the list".');
    const level = item.out ? 'unlikely' : levelOf(item, today);
    const age = today - item.bought;
    const when = item.out ? 'It was marked as out.' : `Bought ${age <= 0 ? 'today' : `${age} days ago`}.`;
    const verdict = { likely: 'Probably yes.', maybe: 'Maybe; worth a look.', unlikely: 'Probably not.' }[level];
    return answer(`${item.label}: ${verdict} ${when}`);
  }
  if (/\bwhere(?:'s| is)\b/.test(t) && mentioned.length) {
    const who = mentioned[0];
    const c = on(today).find((x) => x.people.includes(who) && x.start <= nowMin && nowMin < x.end);
    if (!c) return answer(`Nothing is in the diary for {${who}} right now, so I do not know.`);
    return answer(`{${who}} is at ${c.type === 'school' ? 'school' : (c.place || c.title).replace(/^./, (ch) => ch.toLowerCase())} until ${fmtTime(c.end)}, by the diary.`);
  }
  if (/\bwhen(?:'s| is| does| do)\b/.test(t)) {
    const c = findCommitment(t, s, today);
    if (c) return answer(`${inSentence(c.title)} is ${c.day === today ? 'today' : `on ${DAYS[c.day]}`} at ${fmtTime(c.start)}${c.place ? `, ${c.place}` : ''}.${c.driver ? (c.driver === v ? ' You drive.' : ` {${c.driver}} drives.`) : ''}`);
    return answer('I could not find that in this week. Try the name of the activity.');
  }
  if (/\bwho(?:'s| is)?\s+(?:is\s+)?(driving|drives|taking|takes)\b/.test(t)) {
    const runs = on(day).filter((x) => x.driver && !x.people.includes(x.driver) && (!mentioned.length || x.people.some((p) => mentioned.includes(p))));
    if (!runs.length) return answer(`No driving runs ${dayWord}${mentioned.length ? ` for {${mentioned[0]}}` : ''}.`);
    return { kind: 'answer', text: `Driving ${dayWord}:`, bullets: runs.map((c) => `${fmtTime(c.start)}: ${c.driver === v ? 'you take' : `{${c.driver}} takes`} ${list(c.people.map((p) => (p === v ? 'you' : `{${p}}`)))} to ${c.title.replace(/\{\w+\},?\s*/, '')}${c.car ? '' : ', by taxi'}`) };
  }
  if (/\b(what needs me|what do i need to do|anything for me|what should i do|what is waiting)\b/.test(t)) {
    const b = brief(s, v);
    if (!b.cards.length) return answer(b.lead);
    return { kind: 'answer', text: `${b.cards.length} ${b.cards.length === 1 ? 'thing needs' : 'things need'} you:`, bullets: b.cards.slice(0, 5).map((c) => c.title) };
  }
  if (/\bwhat(?:'s| is| are)?\b.*\b(on|happening|planned|plan|schedule|diary)\b|\bwhat do (i|we) have\b|^(today|tomorrow|tonight)$/.test(t) || (dayIn != null && /^(what|anything)/.test(t))) {
    const mineOnly = /\b(i|my|me)\b/.test(t) && !mentioned.length;
    const who = mineOnly ? [v] : mentioned;
    const items = on(day).filter((c) => c.type !== 'school' && (!who.length || c.people.some((p) => who.includes(p)) || who.includes(c.driver)));
    const whose = who.length ? ` for ${who[0] === v && mineOnly ? 'you' : `{${who[0]}}`}` : '';
    if (!items.length) return answer(`Nothing in the diary ${dayWord}${whose}.`);
    return { kind: 'answer', text: `${dayWord.replace(/^./, (ch) => ch.toUpperCase()).replace(/^On /, '')}${whose}:`, bullets: items.map((c) => `${fmtTime(c.start)}: ${c.title}${c.driver && !c.people.includes(c.driver) ? (c.driver === v ? ' (you drive)' : ` ({${c.driver}} drives)`) : ''}`) };
  }

  // A plain statement of something happening: record it as a proposal to confirm.
  const parsed = parseCapture(text, people, today);
  if (parsed.day != null && parsed.start != null) return { kind: 'proposal', parsed, text: 'I read that as this. Add it to the week?' };

  return { kind: 'unknown', text: 'I cannot answer that yet. Until the assistant is connected, I understand a fixed set of things:', bullets: CAN_DO, original: text };
}

// Three examples to teach by doing, chosen for the person and the moment.
export function examples(s, v) {
  const today = dayOf(s.now);
  const me = s.members.find((m) => m.id === v);
  const pickup = s.commitments.find((c) => c.day === today && c.type === 'pickup');
  const child = pickup ? pickup.people.find((p) => p !== pickup.owner) : null;
  if (!me.adult) return ['What is on today?', 'When is violin?', 'Can we have chicken rice on Friday?'];
  return [child ? `Who collects {${child}} today?` : 'What is on today?', 'What is for dinner?', 'Add eggs to the list'];
}
