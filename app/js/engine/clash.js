// Deterministic clash detection. Code decides; no model is involved.

import { abs, overlaps } from './time.js';

const DROP_BEFORE = 25;
const DROP_AFTER = 5;
const PICK_BEFORE = 5;
const PICK_AFTER = 25;

// The two driving legs of a commitment, in absolute minutes.
export function legsOf(c) {
  if (!c.driver || !c.legs) return [];
  const s = abs(c.day, c.start);
  const e = abs(c.day, c.end);
  const out = [];
  if (c.legs === 'both' || c.legs === 'drop') out.push({ cid: c.id, kind: 'drop', driver: c.driver, car: c.car, day: c.day, from: s - DROP_BEFORE, to: s + DROP_AFTER });
  if (c.legs === 'both' || c.legs === 'pick') out.push({ cid: c.id, kind: 'pick', driver: c.driver, car: c.car, day: c.day, from: e - PICK_BEFORE, to: e + PICK_AFTER });
  return out;
}

// Every interval during which a person or a car is taken.
export function busyIntervals(commitments) {
  const people = new Map();
  const cars = new Map();
  const push = (map, key, item) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  };
  for (const c of commitments) {
    if (c.status === 'cancelled') continue;
    const from = abs(c.day, c.start);
    const to = abs(c.day, c.end);
    for (const p of c.people) push(people, p, { cid: c.id, role: 'attending', from, to });
    for (const leg of legsOf(c)) {
      // Someone who drives to their own commitment is not double booked by it.
      if (!c.people.includes(leg.driver)) push(people, leg.driver, { cid: c.id, role: `driving, ${leg.kind}`, from: leg.from, to: leg.to });
      if (leg.car) push(cars, leg.car, { cid: c.id, role: leg.kind, from: leg.from, to: leg.to });
    }
  }
  return { people, cars };
}

// A soft block (family dinner) is flexible until its hardening time on the day.
export function isHard(c, now) {
  if (!c.soft) return true;
  if (now == null || c.hardensAt == null) return false;
  return now >= abs(c.day, c.hardensAt);
}

export function findClashes(commitments, now = null) {
  const byId = new Map(commitments.map((c) => [c.id, c]));
  const { people, cars } = busyIntervals(commitments);
  const out = [];
  const seen = new Set();
  const scan = (map, kind) => {
    for (const [who, list] of map) {
      list.sort((a, b) => a.from - b.from);
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i];
          const b = list[j];
          if (b.from >= a.to) break;
          if (a.cid === b.cid || !overlaps(a, b)) continue;
          const key = [kind, who, ...[a.cid, b.cid].sort()].join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          const ca = byId.get(a.cid);
          const cb = byId.get(b.cid);
          const severity = isHard(ca, now) && isHard(cb, now) ? 'hard' : 'soft';
          out.push({ key, kind, who, a: a.cid, b: b.cid, roleA: a.role, roleB: b.role, from: Math.max(a.from, b.from), to: Math.min(a.to, b.to), severity });
        }
      }
    }
  };
  scan(people, 'person');
  scan(cars, 'car');
  return out;
}

export function isFree(intervals, who, window, ignoreCid = null) {
  const list = intervals.get(who) || [];
  return !list.some((i) => i.cid !== ignoreCid && overlaps(i, window));
}
