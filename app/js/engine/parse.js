// Plain language capture, parsed deterministically. "Swim Tue 5pm Leo" becomes a proposal.
// The result is always shown for confirmation before anything is saved.

import { DAYS, DAYS_SHORT } from './time.js';

const TYPE_WORDS = [
  ['medical', ['dentist', 'doctor', 'clinic', 'polyclinic', 'checkup', 'vaccination', 'physio', 'orthodontist']],
  ['pickup', ['pickup', 'pick up', 'collect', 'fetch']],
  ['social', ['party', 'birthday', 'playdate', 'sleepover', 'wedding']],
  ['errand', ['groceries', 'shopping', 'bank', 'post office']],
  ['meal', ['dinner', 'lunch', 'breakfast', 'brunch']],
  ['study', ['study', 'revision', 'homework']],
  ['activity', ['swim', 'swimming', 'football', 'piano', 'tuition', 'class', 'training', 'match', 'lesson', 'art', 'ballet', 'coding']],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseClock(h, m, suffix) {
  let hour = Number(h);
  const minute = m ? Number(m) : 0;
  if (suffix) {
    const pm = suffix.toLowerCase().startsWith('p');
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  } else if (hour >= 1 && hour <= 6) {
    hour += 12; // A bare "4" in a family diary means the afternoon.
  }
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function parseCapture(text, members, today = 0) {
  const original = text.trim();
  let rest = ` ${original} `;
  const notes = [];
  const result = { title: '', type: 'activity', day: null, start: null, end: null, people: [], confident: true, notes };

  // People, by first name.
  // A person can be named by any alias: a code, a given name or a pet name.
  for (const m of members) {
    const aliases = [...new Set([m.name, ...(m.aliases || [])])].filter(Boolean).sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const re = new RegExp('\\b' + escapeRe(alias) + "(?:'s)?\\b", 'i');
      if (re.test(rest)) {
        if (!result.people.includes(m.id)) result.people.push(m.id);
        rest = rest.replace(re, ' ');
      }
    }
  }

  // Day.
  const lower = rest.toLowerCase();
  if (/\btoday\b/.test(lower)) { result.day = today; rest = rest.replace(/\btoday\b/i, ' '); }
  else if (/\b(tomorrow|tmr)\b/.test(lower)) { result.day = (today + 1) % 7; rest = rest.replace(/\b(tomorrow|tmr)\b/i, ' '); }
  else {
    for (let i = 0; i < 7; i += 1) {
      const re = new RegExp(`\\b(?:on\\s+)?(?:next\\s+)?(${DAYS[i]}|${DAYS_SHORT[i]}|${DAYS[i].slice(0, 4)}s?)\\b`, 'i');
      if (re.test(rest)) { result.day = i; rest = rest.replace(re, ' '); break; }
    }
  }

  // Time: a range ("5 to 6pm", "5-6.30pm") or a single start, with an optional duration.
  const clock = '(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?';
  const range = new RegExp(`\\b(?:from\\s+|at\\s+)?${clock}\\s*(?:to|until|-|\u2013)\\s*${clock}\\b`, 'i');
  const single = new RegExp(`\\b(?:at\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)\\b|\\b(?:at\\s+)(\\d{1,2})(?:[:.](\\d{2}))?\\b|\\b(\\d{1,2})[:.](\\d{2})\\b`, 'i');
  let m = rest.match(range);
  if (m && (m[3] || m[6])) {
    const endSuffix = m[6] || m[3];
    const end = parseClock(m[4], m[5], endSuffix);
    let start = parseClock(m[1], m[2], m[3] || endSuffix);
    if (start != null && end != null && start > end && !m[3]) start -= 720;
    result.start = start;
    result.end = end;
    rest = rest.replace(range, ' ');
  } else {
    m = rest.match(single);
    if (m) {
      result.start = m[1] ? parseClock(m[1], m[2], m[3]) : m[4] ? parseClock(m[4], m[5], null) : parseClock(m[6], m[7], null);
      rest = rest.replace(single, ' ');
    }
  }
  const dur = rest.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)\b/i);
  if (dur) {
    const n = Number(dur[1]);
    const minutes = /^h/i.test(dur[2]) ? Math.round(n * 60) : Math.round(n);
    if (result.start != null) result.end = result.start + minutes;
    rest = rest.replace(dur[0], ' ');
  }
  if (result.start != null && result.end == null) {
    result.end = result.start + 60;
    notes.push('No end time given, so one hour is assumed');
  }

  // Type, from the words that remain.
  const words = rest.toLowerCase();
  for (const [type, list] of TYPE_WORDS) {
    if (list.some((w) => new RegExp(`\\b${w}\\b`).test(words))) { result.type = type; break; }
  }

  const title = rest.replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s+(for|with|at|on|to)$/i, '').replace(/^(for|with)\s+/i, '');
  const names = result.people.map((id) => `{${id}}`);
  const bare = title ? title.charAt(0).toUpperCase() + title.slice(1) : '';
  result.title = names.length && bare ? `${names.join(' and ')}, ${bare.charAt(0).toLowerCase()}${bare.slice(1)}` : bare || original;

  if (result.day == null) { notes.push('No day given'); result.confident = false; }
  if (result.start == null) { notes.push('No time given'); result.confident = false; }
  if (!result.people.length) notes.push('No one named, so it is yours');
  return result;
}
