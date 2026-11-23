// Load per person and pressure per day. Used by the week view and the mirror.

import { abs, dayOf } from './time.js';
import { legsOf, findClashes } from './clash.js';
import { eligibleDrivers } from './swap.js';

export function allLegs(commitments) {
  return commitments.filter((c) => c.status !== 'cancelled').flatMap(legsOf);
}

// Driving for someone else counts as load. Driving yourself does not.
export function drivingLoad(commitments, members) {
  const byId = new Map(commitments.map((c) => [c.id, c]));
  const out = {};
  for (const m of members) out[m.id] = { legs: 0, legsByDay: Array(7).fill(0), minutesByDay: Array(7).fill(0), owned: 0, over: false, max: m.maxLegs };
  for (const leg of allLegs(commitments)) {
    const c = byId.get(leg.cid);
    if (c.people.includes(leg.driver)) continue;
    const row = out[leg.driver];
    if (!row) continue;
    row.legs += 1;
    row.legsByDay[leg.day] += 1;
  }
  for (const c of commitments) {
    if (c.status === 'cancelled' || c.type === 'school' || c.type === 'rest') continue;
    for (const p of c.people) if (out[p]) out[p].minutesByDay[c.day] += c.end - c.start;
    if (c.owner && out[c.owner] && c.type !== 'work') out[c.owner].owned += 1;
  }
  for (const m of members) out[m.id].over = m.drives && out[m.id].legs > m.maxLegs;
  return out;
}

// One line per day: how many runs, how many clashes, how many runs with no one to cover.
export function dayPressure(commitments, members, cars, now = null) {
  const clashes = findClashes(commitments, now);
  const byId = new Map(commitments.map((c) => [c.id, c]));
  const days = [];
  for (let day = 0; day < 7; day += 1) {
    const todays = commitments.filter((c) => c.day === day && c.status !== 'cancelled');
    const runs = todays.filter((c) => c.driver && !c.people.includes(c.driver));
    const hard = clashes.filter((k) => dayOf(k.from) === day && k.severity === 'hard');
    const soft = clashes.filter((k) => dayOf(k.from) === day && k.severity === 'soft');
    const noCover = runs.filter((c) => !eligibleDrivers(commitments, members, cars, c.id).some((e) => e.ok));
    let level = 'calm';
    if (runs.length >= 3 || noCover.length || soft.length) level = 'busy';
    if (hard.length) level = 'red';
    const counts = {};
    for (const c of todays) {
      const k = c.type === 'pickup' ? 'pickup' : c.activity ? 'class' : c.type;
      counts[k] = (counts[k] || 0) + 1;
    }
    days.push({ day, runs: runs.length, legs: runs.length * 2, hard, soft, noCover: noCover.map((c) => c.id), level, counts, total: todays.filter((c) => c.type !== 'school').length });
  }
  return days;
}

export function describePressure(p, commitmentsById) {
  const parts = [];
  if (p.hard.length) parts.push(`${p.hard.length} clash${p.hard.length > 1 ? 'es' : ''}`);
  if (p.runs) parts.push(`${p.runs} driving run${p.runs > 1 ? 's' : ''}`);
  if (p.noCover.length) parts.push(`${p.noCover.length} with no cover`);
  if (p.soft.length) parts.push('dinner is squeezed');
  return parts.length ? parts.join(', ') : 'Nothing that needs a driver';
}

export const absStart = (c) => abs(c.day, c.start);
