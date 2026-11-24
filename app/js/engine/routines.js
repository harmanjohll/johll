// Routines: noticing what repeats. This is counting, not intelligence.
// The portal only ever offers; a person decides whether it becomes a routine.

import { DAYS, fmtTime } from './time.js';

// A repeat is the same thing, on the same weekday at the same time, in each of the
// most recent `min` weeks with no gap.
export function detectRoutines(log, { min = 3 } = {}) {
  const groups = new Map();
  for (const row of log) {
    const k = `${row.key}|${row.weekday}|${row.start}`;
    if (!groups.has(k)) groups.set(k, { ...row, weeks: new Set() });
    groups.get(k).weeks.add(row.weeksAgo);
  }
  const out = [];
  for (const g of groups.values()) {
    let run = 0;
    while (g.weeks.has(run + 1)) run += 1;
    if (run >= min) out.push({ id: `${g.key}-${g.weekday}`, key: g.key, title: g.title, who: g.who, owner: g.owner, weekday: g.weekday, start: g.start, count: run });
  }
  return out.sort((a, b) => b.count - a.count || a.weekday - b.weekday);
}

const inSentence = (title) => title.replace(/^(\{\w+\}), (.+)$/, "$1's $2");
export const describeRoutine = (r) => `${inSentence(r.title)}, every ${DAYS[r.weekday]} at ${fmtTime(r.start)}`;

// Offers still open: detected, and neither accepted nor declined.
export function openOffers(log, accepted = [], declined = []) {
  const closed = new Set([...accepted.map((r) => r.id), ...declined]);
  return detectRoutines(log).filter((r) => !closed.has(r.id));
}
