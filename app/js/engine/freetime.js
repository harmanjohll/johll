// Free time: windows when a set of people are all free, for planning something together.

import { abs, DAY } from './time.js';
import { busyIntervals } from './clash.js';

// Windows on one day when none of the people is attending or driving anything.
export function freeWindows(commitments, people, day, { from = 9 * 60, to = 21 * 60, min = 90 } = {}) {
  const { people: busy } = busyIntervals(commitments);
  const start = abs(day, from);
  const end = abs(day, to);
  const taken = people.flatMap((p) => busy.get(p) || []).filter((i) => i.to > start && i.from < end).sort((a, b) => a.from - b.from);
  const out = [];
  let cursor = start;
  for (const i of taken) {
    if (i.from > cursor && i.from - cursor >= min) out.push({ day, from: cursor - day * DAY, to: i.from - day * DAY });
    cursor = Math.max(cursor, i.to);
  }
  if (end - cursor >= min) out.push({ day, from: cursor - day * DAY, to: end - day * DAY });
  return out;
}

const MEALS = [[11 * 60 + 30, 14 * 60], [17 * 60 + 30, 20 * 60]];
const overlap = (w, [a, b]) => Math.max(0, Math.min(w.to, b) - Math.max(w.from, a));

// The best coming window for an outing: prefer one that covers a mealtime, then the longest.
// Start times are rounded up to the quarter hour, since nobody leaves at 5:25pm.
export function bestWindow(commitments, people, days, options = {}) {
  const all = days.flatMap((d) => freeWindows(commitments, people, d, options)).map((w) => {
    const from = Math.ceil(w.from / 15) * 15;
    return { ...w, from, meal: Math.max(...MEALS.map((m) => overlap({ from, to: w.to }, m))) };
  }).filter((w) => w.to - w.from >= (options.min || 90));
  all.sort((a, b) => Number(b.meal >= 60) - Number(a.meal >= 60) || a.day - b.day || (b.to - b.from) - (a.to - a.from));
  return all[0] || null;
}
